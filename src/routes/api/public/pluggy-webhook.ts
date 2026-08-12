import { createFileRoute } from "@tanstack/react-router";

type PluggyWebhookPayload = {
  event?: string;
  eventId?: string;
  itemId?: string;
  clientId?: string;
  accountId?: string;
  transactionsIds?: string[];
  error?: unknown;
};

const HANDLED = new Set([
  "item/created",
  "item/updated",
  "item/error",
  "item/deleted",
  "item/login_succeeded",
  "item/waiting_user_input",
  "transactions/created",
  "transactions/updated",
  "transactions/deleted",
]);

async function handle(payload: PluggyWebhookPayload) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getPluggyApiKey, pluggyFetch, syncPluggyItem } = await import("@/lib/pluggy.server");

  const eventType = payload.event ?? "unknown";
  const itemId = payload.itemId ?? null;

  // Resolve the owner: local item row first, then Pluggy's clientUserId.
  let userId: string | null = null;
  if (itemId) {
    const { data: row } = await supabaseAdmin
      .from("pluggy_items")
      .select("user_id")
      .eq("pluggy_item_id", itemId)
      .maybeSingle();
    userId = row?.user_id ?? null;
  }

  if (!userId && itemId && eventType !== "item/deleted") {
    try {
      const apiKey = await getPluggyApiKey();
      const item = await pluggyFetch(`/items/${itemId}`, apiKey);
      const candidate = item?.clientUserId;
      if (typeof candidate === "string" && /^[0-9a-f-]{36}$/i.test(candidate)) userId = candidate;
    } catch (e) {
      console.error("pluggy-webhook: failed to resolve item owner", e);
    }
  }

  // Idempotency: unique index on event_id rejects replays.
  const { error: logErr } = await supabaseAdmin.from("pluggy_webhook_events").insert({
    user_id: userId,
    event_id: payload.eventId ?? null,
    event_type: eventType,
    item_id: itemId,
    payload: payload as never,
  });
  if (logErr) {
    if (logErr.code === "23505") {
      console.log("pluggy-webhook: duplicate event ignored", payload.eventId);
      return;
    }
    console.error("pluggy-webhook: failed to log event", logErr.message);
  }

  if (!HANDLED.has(eventType) || !itemId) return;

  try {
    if (eventType === "item/deleted") {
      await supabaseAdmin.from("pluggy_items").delete().eq("pluggy_item_id", itemId);
      return;
    }

    if (eventType === "item/error" || eventType === "item/waiting_user_input") {
      await supabaseAdmin
        .from("pluggy_items")
        .update({
          status: eventType === "item/error" ? "ERROR" : "WAITING_USER_INPUT",
          status_detail: (payload.error ?? null) as never,
        })
        .eq("pluggy_item_id", itemId);
      return;
    }

    if (!userId) {
      console.error("pluggy-webhook: no owner for item", itemId);
      return;
    }
    await syncPluggyItem(supabaseAdmin as never, userId, itemId, "webhook");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("pluggy-webhook: processing failed", message);
    if (payload.eventId) {
      await supabaseAdmin
        .from("pluggy_webhook_events")
        .update({ error_message: message })
        .eq("event_id", payload.eventId);
    }
    return;
  }

  if (payload.eventId) {
    await supabaseAdmin
      .from("pluggy_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_id", payload.eventId);
  }
}

export const Route = createFileRoute("/api/public/pluggy-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Optional shared-secret gate (?token=...) when PLUGGY_WEBHOOK_TOKEN is configured.
        const expected = process.env.PLUGGY_WEBHOOK_TOKEN;
        if (expected) {
          const token = new URL(request.url).searchParams.get("token");
          if (token !== expected) return new Response("Unauthorized", { status: 401 });
        }

        let payload: PluggyWebhookPayload;
        try {
          payload = (await request.json()) as PluggyWebhookPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // Always ack fast; processing errors are logged, not retried by Pluggy.
        try {
          await handle(payload);
        } catch (e) {
          console.error("pluggy-webhook: unexpected error", e);
        }
        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
