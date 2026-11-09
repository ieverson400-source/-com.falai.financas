import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook, planFromPriceLookupKey } from "@/lib/stripe.server";

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createStripeClient } = await import("@/lib/stripe.server");
  // Retrieve authoritative current state to avoid out-of-order webhook downgrades.
  const subscription = await createStripeClient(env).subscriptions.retrieve(event.data.object.id);
  const userId = subscription.metadata?.userId;
  if (!userId) throw new Error("Missing user binding");
  const item = subscription.items.data[0];
  const plan = planFromPriceLookupKey(item?.price.lookup_key ?? item?.price.metadata?.lovable_external_id);
  if (!plan) throw new Error("Unknown subscription plan");
  const end = item?.current_period_end;
  const currentPeriodEnd = end ? new Date(end * 1000).toISOString() : null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const record = await supabaseAdmin.from("stripe_subscription_records").upsert({
    id: subscription.id, user_id: userId, environment: env, customer_id: customerId, plan,
    status: subscription.status, current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end, updated_at: new Date().toISOString(),
  });
  if (record.error) throw record.error;
  // Test checkouts must never replace real or Play Store entitlements.
  if (env !== "live") return;
  const { subscriptionUsable } = await import("@/lib/billing-rules");
  const existing = await supabaseAdmin.from("subscriptions").select("provider,status,current_period_end,provider_subscription_id").eq("user_id", userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data && existing.data.provider !== "stripe" && subscriptionUsable(existing.data.status, existing.data.current_period_end)) return;
  if (existing.data?.provider === "stripe" && existing.data.provider_subscription_id !== subscription.id && subscriptionUsable(existing.data.status, existing.data.current_period_end)) return;
  const usable = subscriptionUsable(subscription.status, currentPeriodEnd);
  const result = await supabaseAdmin.from("subscriptions").upsert({
    user_id: userId, plan, provider: "stripe", provider_subscription_id: subscription.id,
    provider_product_id: typeof item?.price.product === "string" ? item.price.product : item?.price.product.id,
    status: usable ? (subscription.status === "past_due" ? "in_grace_period" : "active") : "canceled",
    current_period_end: currentPeriodEnd, cancel_at_period_end: subscription.cancel_at_period_end,
    raw: { customer_id: customerId, price_lookup_key: item?.price.lookup_key ?? null, environment: env },
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (result.error) throw result.error;
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
