import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { stripeEnvironment, stripePlanKeys, subscriptionUsable } from "@/lib/billing-rules";

function assertSafeReturnUrl(url: string | undefined) {
  if (!url) return;
  const allowed = [/^https:\/\/falai-finan-as\.lovable\.app$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/, /^http:\/\/localhost(:\d+)?$/];
  let origin: string;
  try { origin = new URL(url.replace("{CHECKOUT_SESSION_ID}", "x")).origin; } catch { throw new Error("Invalid returnUrl"); }
  if (!allowed.some((r) => r.test(origin))) throw new Error("Invalid returnUrl");
}

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  // Nunca reaproveitar cliente pelo e-mail: só o vínculo por userId comprova a identidade.
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    if (!stripePlanKeys.some((key) => key === data.priceId)) throw new Error("Plano inválido.");
    stripeEnvironment.parse(data.environment);
    assertSafeReturnUrl(data.returnUrl);
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const { userId, supabase } = context;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("is_active").eq("user_id", userId).maybeSingle();
      if (!profile?.is_active) throw new Error("Sua conta não está disponível para compras.");
      const { data: records, error: recordError } = await supabase.from("stripe_subscription_records").select("status,current_period_end").eq("user_id", userId).eq("environment", data.environment);
      if (recordError) throw new Error(recordError.message);
      if (records?.some((r) => subscriptionUsable(r.status, r.current_period_end))) throw new Error("Você já tem uma assinatura por cartão. Use Gerenciar assinatura.");
      const { data: existing } = await supabase.from("subscriptions").select("provider,status,current_period_end").eq("user_id", userId).maybeSingle();
      if (existing && subscriptionUsable(existing.status, existing.current_period_end)) throw new Error("Você já possui uma assinatura ativa nesta conta.");

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";
      if (!isRecurring || !stripePrice.active) throw new Error("Plano indisponível.");

      const customerId = await resolveOrCreateCustomer(stripe, {
        email: user?.email ?? undefined,
        userId,
      });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        customer_update: { address: "auto" },
        automatic_tax: { enabled: true },
        metadata: { userId },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => {
    stripeEnvironment.parse(data.environment);
    assertSafeReturnUrl(data.returnUrl);
    return data;
  })
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { supabase, userId } = context;

    const { data: sub, error: subError } = await supabase
      .from("stripe_subscription_records")
      .select("customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) throw new Error(subError.message);
    const customerId = sub?.customer_id;
    if (!customerId) throw new Error("Nenhuma assinatura encontrada");

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getMyStripePlans = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: { environment: StripeEnv }) => ({ environment: stripeEnvironment.parse(input.environment) }))
  .handler(async ({ data, context }) => {
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [...stripePlanKeys], active: true, expand: ["data.product"] });
      const plans = prices.data.filter((p) => p.type === "recurring").map((p) => ({ id: p.lookup_key ?? "", name: typeof p.product !== "string" && !p.product.deleted ? p.product.name : p.lookup_key ?? "", amount: p.unit_amount ?? 0, currency: p.currency, interval: p.recurring?.interval ?? "month" }));
      const records = await context.supabase.from("stripe_subscription_records").select("status,current_period_end,plan").eq("user_id", context.userId).eq("environment", data.environment).order("updated_at", { ascending: false });
      if (records.error) throw new Error(records.error.message);
      return { plans, records: records.data ?? [] };
    } catch (error) { return { error: getStripeErrorMessage(error) }; }
  });
