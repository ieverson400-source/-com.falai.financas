// Estado dos recursos em liberação. Código puro: recebe as variáveis de ambiente como parâmetro,
// não lê process.env e não contém segredos. Só o valor exato "true" liga um recurso (o mesmo critério
// dos guardas de rota de assinatura e de Open Finance).

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

export function readFeatureFlags(env: Record<string, string | undefined>): FeatureFlags {
  const on = (key: FeatureFlagKey) => env[FEATURE_FLAG_ENV[key]] === "true";
  return { subscriptions: on("subscriptions"), openFinance: on("openFinance"), recharge: on("recharge") };
}
