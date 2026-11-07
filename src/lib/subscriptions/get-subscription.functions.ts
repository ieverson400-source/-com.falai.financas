import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SubscriptionState } from "./provider.ts";
import { mapSubscriptionRow } from "./state.ts";

/**
 * Estado atual da assinatura do usuário autenticado. SOMENTE LEITURA da tabela `subscriptions`,
 * com o cliente do próprio usuário (a RLS só devolve a linha dele). Não consulta Google Play,
 * Stripe nem nenhum provedor e não grava nada. Qualquer falha de leitura vira "error".
 */
export const getSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ state: SubscriptionState }> => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) return { state: "error" };
    return { state: mapSubscriptionRow(data, new Date()) };
  });
