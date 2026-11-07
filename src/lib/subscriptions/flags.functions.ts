import { createServerFn } from "@tanstack/react-start";

/**
 * Feature flags das assinaturas, lidas no servidor. O navegador só recebe valores não secretos.
 *
 * - SUBS_ENABLED:  "true" liga a área de assinatura (padrão: desligada).
 * - SUBS_PROVIDER: padrão "google_play_pwa" (Google Play Billing + Digital Goods API em TWA/PWABuilder).
 *                  Ainda NÃO tem nenhum efeito nesta etapa: nenhum provedor está implementado.
 */
export const getSubscriptionFlags = createServerFn({ method: "GET" }).handler(async () => ({
  enabled: process.env.SUBS_ENABLED === "true",
  provider: process.env.SUBS_PROVIDER?.trim() || "google_play_pwa",
}));
