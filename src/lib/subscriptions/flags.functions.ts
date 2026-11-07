import { createServerFn } from "@tanstack/react-start";
import { readFeatureFlags } from "../feature-flags.ts";

/**
 * Flags das assinaturas, lidas no servidor. O navegador só recebe valores não secretos.
 *
 * - enabled:  a área de assinatura está ligada por padrão (vitrine "Em breve"). Para desligar,
 *             defina SUBS_ENABLED=false no servidor (critério em lib/feature-flags.ts).
 * - provider: SUBS_PROVIDER, padrão "google_play_pwa". Ainda NÃO tem efeito: nenhum provedor
 *             está implementado.
 */
export const getSubscriptionFlags = createServerFn({ method: "GET" }).handler(async () => ({
  enabled: readFeatureFlags(process.env).subscriptions,
  provider: process.env.SUBS_PROVIDER?.trim() || "google_play_pwa",
}));
