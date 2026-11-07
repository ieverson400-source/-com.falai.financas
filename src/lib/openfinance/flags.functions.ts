import { createServerFn } from "@tanstack/react-start";
import { readFeatureFlags } from "../feature-flags.ts";

/**
 * Feature flag do Open Finance, lida no servidor. O navegador só recebe um booleano.
 * Ligada por padrão (vitrine "Em breve"); OF_ENABLED=false desliga (critério em lib/feature-flags.ts).
 * Não é segredo e não exige login (a rota também é protegida pelo fluxo de autenticação do app).
 * OF_PROVIDER existe como configuração futura e ainda não tem nenhum efeito.
 */
export const getOpenFinanceFlags = createServerFn({ method: "GET" }).handler(async () => ({
  enabled: readFeatureFlags(process.env).openFinance,
}));
