import { createServerFn } from "@tanstack/react-start";

/**
 * Feature flag do Open Finance, lida no servidor. O navegador só recebe um booleano.
 * Não é segredo e não exige login (a rota também é protegida pelo fluxo de autenticação do app).
 * OF_PROVIDER existe como configuração futura e ainda não tem nenhum efeito.
 */
export const getOpenFinanceFlags = createServerFn({ method: "GET" }).handler(async () => ({
  enabled: process.env.OF_ENABLED === "true",
}));
