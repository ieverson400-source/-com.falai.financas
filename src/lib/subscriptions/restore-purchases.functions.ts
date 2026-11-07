import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RestoreResult } from "./provider.ts";

/**
 * STUB. Não restaura compras nem consulta nenhum provedor. Devolve sempre "not_configured".
 */
export const restorePurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<RestoreResult> => {
    // TODO: integração real — aguardando definição do provedor (RevenueCat / Google Play / Stripe).
    return { status: "not_configured" };
  });
