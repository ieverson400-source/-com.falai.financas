import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/assert-admin";

/**
 * Lê a assinatura do usuário autenticado.
 * Retorna null se nunca houve assinatura (= plano free).
 */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

/**
 * Ativação manual de DEV — útil para testar a UI antes do billing real.
 * Usa supabaseAdmin pois insert/update na tabela é restrito ao service_role.
 *
 * ⚠️ Em produção remova ou proteja com role admin. Hoje qualquer usuário
 * autenticado pode ativar a si mesmo (intencional para demo/testes).
 */
export const activateDevSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        plan: z.enum(["pro", "premium"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + 30);

    const { data: row, error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        [
          {
            user_id: userId,
            plan: data.plan,
            status: "active",
            provider: "manual",
            current_period_end: periodEnd.toISOString(),
            cancel_at_period_end: false,
          },
        ],
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelDevSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", cancel_at_period_end: true })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
