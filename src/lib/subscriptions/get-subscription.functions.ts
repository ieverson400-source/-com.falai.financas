import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SubscriptionState } from "./provider.ts";

/**
 * STUB. Não consulta Google Play, RevenueCat, Stripe nem a tabela de assinaturas.
 * Devolve sempre "free".
 */
export const getSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ state: SubscriptionState }> => {
    // TODO: integração real — aguardando definição do provedor (RevenueCat / Google Play / Stripe).
    return { state: "free" };
  });
