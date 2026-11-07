import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Payload enviado pela tela. Valor em centavos inteiros; nada de dinheiro em ponto flutuante. */
export const createRechargeSchema = z.object({
  amountCents: z.number().int().positive().max(10_000_000),
  operatorId: z.string().trim().min(1).max(64),
  phone: z.string().trim().min(8).max(20),
});
export type CreateRechargePayload = z.infer<typeof createRechargeSchema>;

export type CreateRechargeResult = { status: "not_configured" };

/**
 * STUB. Não importa o cliente HTTP de src/lib/celcoin, não chama a Celcoin e não grava no banco.
 * Sempre responde "not_configured".
 */
export const createRecharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createRechargeSchema.parse(input))
  .handler(async (): Promise<CreateRechargeResult> => {
    // TODO: integração real com src/lib/recharge — aguardando confirmação da Celcoin.
    return { status: "not_configured" };
  });

/**
 * Indica se a camada de recarga está pronta para operar. Sem integração, é sempre falso.
 * Valor fixo no servidor; o navegador recebe só o booleano.
 */
export const getRechargeAvailability = createServerFn({ method: "GET" }).handler(async () => ({
  configured: false as boolean,
}));
