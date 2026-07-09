import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook, planFromPriceLookupKey } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

function resolvePlan(item: any): string | null {
  const lookup = item?.price?.lookup_key
    ?? item?.price?.metadata?.lovable_external_id
    ?? null;
  return planFromPriceLookupKey(lookup);
}

async function upsertSubscription(subscription: any, _env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("[stripe webhook] missing userId in subscription metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const plan = resolvePlan(item);
  if (!plan) {
    console.error("[stripe webhook] unknown plan for price", item?.price?.id, item?.price?.lookup_key);
    return;
  }
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  // Map Stripe status to app status. App uses: active, in_grace_period, canceled, inactive
  let status = "inactive";
  if (subscription.status === "active" || subscription.status === "trialing") status = "active";
  else if (subscription.status === "past_due") status = "in_grace_period";
  else if (subscription.status === "canceled" || subscription.status === "unpaid" || subscription.status === "incomplete_expired") status = "canceled";

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      plan,
      status,
      provider: "stripe",
      provider_subscription_id: subscription.id,
      provider_product_id: item?.price?.product ?? null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      raw: { customer_id: subscription.customer, price_lookup_key: item?.price?.lookup_key ?? null },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = sub.metadata?.userId;
      if (userId) {
        await getSupabase()
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("provider", "stripe");
      }
      break;
    }
    default:
      console.log("[stripe webhook] unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("[stripe webhook] error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
