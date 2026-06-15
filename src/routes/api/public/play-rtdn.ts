import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Webhook para sincronizar status de assinatura do Google Play (RTDN)
 * ou de qualquer outro provider externo.
 *
 * Proteção: header `x-webhook-secret` deve bater com env `PLAY_WEBHOOK_SECRET`.
 * Para Play Pub/Sub real, troque por verificação de JWT do Google.
 *
 * Body esperado:
 * {
 *   "user_id": "<uuid>",
 *   "plan": "pro" | "premium",
 *   "status": "active" | "canceled" | "expired" | "in_grace_period" | "on_hold" | "paused",
 *   "purchase_token": "...",
 *   "provider_product_id": "falai_premium_monthly",
 *   "current_period_end": "2026-07-01T00:00:00Z"
 * }
 */

const PayloadSchema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(["pro", "premium"]),
  status: z.enum([
    "active",
    "inactive",
    "in_grace_period",
    "on_hold",
    "paused",
    "canceled",
    "expired",
  ]),
  purchase_token: z.string().min(1).max(512).optional(),
  provider_product_id: z.string().min(1).max(128).optional(),
  provider_subscription_id: z.string().min(1).max(128).optional(),
  current_period_end: z.string().datetime().optional(),
  cancel_at_period_end: z.boolean().optional(),
});

export const Route = createFileRoute("/api/public/play-rtdn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PLAY_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 500 });
        }
        const provided = request.headers.get("x-webhook-secret");
        if (!provided || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const parsed = PayloadSchema.safeParse(json);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid payload", details: parsed.error.flatten() },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
