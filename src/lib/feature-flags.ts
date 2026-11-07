// Estado dos recursos em liberação. Código puro: recebe as variáveis de ambiente como parâmetro,
// não lê process.env e não contém segredos.
//
// - Open Finance e recarga: DESLIGADOS por padrão; só o valor exato "true" liga.
// - Assinaturas: LIGADA por padrão (vitrine "Em breve", sem cobrança); funciona como chave de
//   desligamento: SUBS_ENABLED com "false", "0", "off" ou "no" (sem diferenciar maiúsculas) desliga.

export interface FeatureFlags {
  subscriptions: boolean;
  openFinance: boolean;
  recharge: boolean;
}

export type FeatureFlagKey = keyof FeatureFlags;

/** Nome da variável de ambiente (no servidor) que controla cada recurso. */
export const FEATURE_FLAG_ENV: Readonly<Record<FeatureFlagKey, string>> = {
  subscriptions: "SUBS_ENABLED",
  openFinance: "OF_ENABLED",
  recharge: "RECHARGE_ENABLED",
};

const OFF_VALUES = ["false", "0", "off", "no"];

export function readFeatureFlags(env: Record<string, string | undefined>): FeatureFlags {
  const exactTrue = (key: FeatureFlagKey) => env[FEATURE_FLAG_ENV[key]] === "true";
  const subs = env[FEATURE_FLAG_ENV.subscriptions];
  return {
    subscriptions: !(subs !== undefined && OFF_VALUES.includes(subs.trim().toLowerCase())),
    openFinance: exactTrue("openFinance"),
    recharge: exactTrue("recharge"),
  };
}
