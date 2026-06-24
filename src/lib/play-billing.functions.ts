import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Verifica no Google Play o status da assinatura do usuário autenticado
 * usando o `purchaseToken` retornado pelo Billing Library (TWA / app).
 *
 * Atualiza a tabela `subscriptions` e retorna o registro persistido.
 * Útil para "Restaurar compra" e para revalidar após o fluxo de checkout.
 */
export const verifyMyPlayPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        purchaseToken: z.string().min(10).max(1024),
        productId: z.string().min(1).max(128).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { verifyPlaySubscription, persistVerifiedSubscription } = await import(
      "./play-billing.server"
    );
    const verified = await verifyPlaySubscription({
      purchaseToken: data.purchaseToken,
      productId: data.productId,
    });
    await persistVerifiedSubscription(context.userId, verified);
    return {
      ok: true,
      plan: verified.plan,
      status: verified.status,
      currentPeriodEnd: verified.currentPeriodEnd,
      cancelAtPeriodEnd: verified.cancelAtPeriodEnd,
    };
  });
