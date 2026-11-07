import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ALL_PLAN_IDS } from "./plans.ts";
import type { PurchaseResult } from "./provider.ts";

const purchaseSchema = z.object({
  planId: z.string().refine((v) => ALL_PLAN_IDS.includes(v), { message: "unknown plan" }),
});

/**
 * STUB. Não inicia cobrança, não valida recibo e não faz nenhuma chamada de billing.
 * Devolve sempre "not_configured".
 */
export const purchasePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => purchaseSchema.parse(input))
  .handler(async (): Promise<PurchaseResult> => {
    // TODO: integração real — aguardando definição do provedor (RevenueCat / Google Play / Stripe).
    return { status: "not_configured" };
  });
