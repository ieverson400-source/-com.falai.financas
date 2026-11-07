import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StartConsentResult } from "@/lib/openfinance/provider";

/**
 * STUB. Não faz nenhuma chamada de rede e não importa nada da Celcoin.
 * Sempre responde "not_configured".
 */
export const startOpenFinanceConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<StartConsentResult> => {
    // TODO: integração Celcoin DAT — aguardando confirmação da Etapa 1.
    return { status: "not_configured" };
  });
