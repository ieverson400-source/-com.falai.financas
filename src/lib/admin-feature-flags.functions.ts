import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/assert-admin";
import { FEATURE_FLAG_ENV, readFeatureFlags } from "./feature-flags.ts";

/**
 * Estado dos recursos para o painel administrativo. Somente administradores.
 * Mostra o estado e o NOME da variável; nunca o valor de nenhuma credencial.
 * A edição pelo painel não existe ainda: exigiria colunas novas em app_settings (migração pendente).
 */
export const adminGetFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return {
      flags: readFeatureFlags(process.env),
      envNames: FEATURE_FLAG_ENV,
      source: "environment" as const,
    };
  });
