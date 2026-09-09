import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/assert-admin";

const filterSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  from: z.string().max(30).optional().nullable(),
  to: z.string().max(30).optional().nullable(),
});

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true };
  });

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => filterSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, whatsapp_phone, created_at");

    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const users = (authUsers?.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      display_name: profileMap.get(u.id)?.display_name ?? null,
      whatsapp_phone: profileMap.get(u.id)?.whatsapp_phone ?? null,
    }));

    let itemsQuery = supabaseAdmin
      .from("pluggy_items")
      .select(
        "id, user_id, pluggy_item_id, institution_name, status, last_synced_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    let logsQuery = supabaseAdmin
      .from("pluggy_sync_logs")
      .select(
        "id, user_id, item_id, pluggy_item_id, status, error_message, accounts_count, triggered_by, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (data.userId) {
      itemsQuery = itemsQuery.eq("user_id", data.userId);
      logsQuery = logsQuery.eq("user_id", data.userId);
    }
    if (data.from) {
      itemsQuery = itemsQuery.gte("created_at", data.from);
      logsQuery = logsQuery.gte("created_at", data.from);
    }
    if (data.to) {
      const end = `${data.to.slice(0, 10)}T23:59:59.999Z`;
      itemsQuery = itemsQuery.lte("created_at", end);
      logsQuery = logsQuery.lte("created_at", end);
    }

    // Cada requisição recebida na rota /api/public/pluggy-webhook fica registrada aqui.
    let webhookQuery = supabaseAdmin
      .from("pluggy_webhook_events")
      .select(
        "id, user_id, event_id, event_type, item_id, processed_at, error_message, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (data.userId) {
      itemsQuery = itemsQuery.eq("user_id", data.userId);
      logsQuery = logsQuery.eq("user_id", data.userId);
      webhookQuery = webhookQuery.eq("user_id", data.userId);
    }
    if (data.from) webhookQuery = webhookQuery.gte("created_at", data.from);
    if (data.to) {
      webhookQuery = webhookQuery.lte("created_at", `${data.to.slice(0, 10)}T23:59:59.999Z`);
    }

    const [items, logs, webhooks] = await Promise.all([itemsQuery, logsQuery, webhookQuery]);

    return {
      users,
      items: items.data ?? [],
      logs: logs.data ?? [],
      webhooks: webhooks.data ?? [],
    };
  });
