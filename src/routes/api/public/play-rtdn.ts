import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Webhook para sincronizar status de assinatura do Google Play.
 *
 * Aceita dois formatos no mesmo endpoint:
 *
 * 1. **Pub/Sub push (RTDN real)** — envelope assinado pelo Google contendo
 *    `message.data` em base64 com o `DeveloperNotification`. Protegido por
 *    `?token=<PLAY_PUBSUB_TOKEN>` na URL (padrão Pub/Sub push auth) ou pelo
 *    header `x-webhook-secret`. Em produção é fortemente recomendado também
 *    configurar OIDC e validar o JWT em `Authorization: Bearer ...`.
 *
 * 2. **Webhook manual** — payload JSON `{ user_id, plan, status, ... }` com
 *    header `x-webhook-secret`. Mantido para retrocompatibilidade e testes.
 *
 * Ao receber um RTDN do Google, o handler consulta `subscriptionsv2.get` no
 * Android Publisher API e usa o resultado autoritativo para atualizar o
 * banco. Nunca confia apenas no payload.
 */

const ManualPayloadSchema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(["pro", "premium", "familia"]),
  status: z.enum([
    "active",
    "inactive",
    "in_grace_period",
    "on_hold",
    "paused",
    "canceled",
    "expired",
  ]),
  purchase_token: z.string().min(1).max(1024).optional(),
  provider_product_id: z.string().min(1).max(128).optional(),
  provider_subscription_id: z.string().min(1).max(128).optional(),
  current_period_end: z.string().datetime().optional(),
  cancel_at_period_end: z.boolean().optional(),
});

const PubSubPushSchema = z.object({
  message: z.object({
    data: z.string().min(1),
    messageId: z.string().optional(),
    publishTime: z.string().optional(),
  }),
  subscription: z.string().optional(),
});

const DeveloperNotificationSchema = z.object({
  version: z.string().optional(),
  packageName: z.string().min(1),
  eventTimeMillis: z.union([z.string(), z.number()]).optional(),
  subscriptionNotification: z
    .object({
      version: z.string().optional(),
      notificationType: z.number().int(),
      purchaseToken: z.string().min(1),
      subscriptionId: z.string().min(1),
    })
    .optional(),
  testNotification: z.object({ version: z.string().optional() }).optional(),
});

function decodeBase64Utf8(b64: string): string {
  // Pub/Sub usa base64 padrão (com `+` e `/`).
  return new TextDecoder().decode(
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
  );
}

export const Route = createFileRoute("/api/public/play-rtdn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.PLAY_WEBHOOK_SECRET;
        const pubsubToken = process.env.PLAY_PUBSUB_TOKEN;

        const url = new URL(request.url);
        const queryToken = url.searchParams.get("token");
        const headerSecret = request.headers.get("x-webhook-secret");

        const authedByPubsub = !!pubsubToken && queryToken === pubsubToken;
        const authedByHeader = !!webhookSecret && headerSecret === webhookSecret;

        if (!authedByPubsub && !authedByHeader) {
          return new Response("Unauthorized", { status: 401 });
        }

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // === Caminho 1: envelope Pub/Sub real ===
        const pubsub = PubSubPushSchema.safeParse(json);
        if (pubsub.success) {
          let decoded: unknown;
          try {
            decoded = JSON.parse(decodeBase64Utf8(pubsub.data.message.data));
          } catch {
            return new Response("Invalid Pub/Sub data", { status: 400 });
          }
          const notif = DeveloperNotificationSchema.safeParse(decoded);
          if (!notif.success) {
            return Response.json(
              { error: "Invalid DeveloperNotification", details: notif.error.flatten() },
              { status: 400 },
            );
          }
          if (notif.data.testNotification) {
            return Response.json({ ok: true, test: true });
          }
          const sub = notif.data.subscriptionNotification;
          if (!sub) {
            // Voided/one-time purchase notifications — ignoramos por enquanto.
            return Response.json({ ok: true, ignored: true });
          }

          // Localiza o user_id pelo purchase_token já registrado no app.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: row, error: lookupErr } = await supabaseAdmin
            .from("subscriptions")
            .select("user_id")
            .eq("purchase_token", sub.purchaseToken)
            .maybeSingle();
          if (lookupErr) {
            console.error("rtdn lookup error", lookupErr.message);
            return Response.json({ error: "lookup failed" }, { status: 500 });
          }
          if (!row?.user_id) {
            // Compra ainda não associada — devolve 200 para o Pub/Sub não reenviar
            // em loop; o app deve chamar /verify quando o usuário logar.
            console.warn("rtdn: purchase_token sem user_id mapeado", sub.purchaseToken.slice(0, 12));
            return Response.json({ ok: true, unmatched: true });
          }

          try {
            const { verifyPlaySubscription, persistVerifiedSubscription } = await import(
              "@/lib/play-billing.server"
            );
            const verified = await verifyPlaySubscription({
              purchaseToken: sub.purchaseToken,
              productId: sub.subscriptionId,
              packageName: notif.data.packageName,
            });
            await persistVerifiedSubscription(row.user_id, verified);
            return Response.json({ ok: true, status: verified.status, plan: verified.plan });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("rtdn verify failed", msg);
            return Response.json({ error: "verify failed" }, { status: 500 });
          }
        }

        // === Caminho 2: payload manual (testes / RTDN proxy) ===
        const parsed = ManualPayloadSchema.safeParse(json);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid payload", details: parsed.error.flatten() },
            { status: 400 },
          );
        }

        // Mesmo no caminho manual, se houver purchase_token, revalida no Google.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (parsed.data.purchase_token) {
          try {
            const { verifyPlaySubscription, persistVerifiedSubscription } = await import(
              "@/lib/play-billing.server"
            );
            const verified = await verifyPlaySubscription({
              purchaseToken: parsed.data.purchase_token,
              productId: parsed.data.provider_product_id,
            });
            await persistVerifiedSubscription(parsed.data.user_id, verified);
            return Response.json({ ok: true, verified: true, status: verified.status });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn("manual verify failed, falling back to payload:", msg);
          }
        }

        const { error } = await supabaseAdmin.from("subscriptions").upsert(
          [
            {
              user_id: parsed.data.user_id,
              plan: parsed.data.plan,
              status: parsed.data.status,
              provider: "play",
              purchase_token: parsed.data.purchase_token,
              provider_product_id: parsed.data.provider_product_id,
              provider_subscription_id: parsed.data.provider_subscription_id,
              current_period_end: parsed.data.current_period_end,
              cancel_at_period_end: parsed.data.cancel_at_period_end ?? false,
              raw: JSON.parse(JSON.stringify(parsed.data)),
            },
          ],
          { onConflict: "user_id" },
        );

        if (error) {
          console.error("play-rtdn upsert error", error.message);
          return Response.json({ error: "Internal server error" }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
