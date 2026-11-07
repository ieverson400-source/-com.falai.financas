// Estado dos recursos em liberação. Código puro: recebe as variáveis de ambiente como parâmetro,
// não lê process.env e não contém segredos.
//
// Os recursos vêm LIGADOS por padrão (vitrine "Em breve" ou assistente de ajuda). Cada variável funciona
// como chave de desligamento: com "false", "0", "off" ou "no" (sem diferenciar maiúsculas nem espaços)
// o recurso é desligado.

export interface FeatureFlags {
  subscriptions: boolean;
  openFinance: boolean;
  recharge: boolean;
  assistant: boolean;
}

export type FeatureFlagKey = keyof FeatureFlags;

/** Nome da variável de ambiente (no servidor) que controla cada recurso. */
export const FEATURE_FLAG_ENV: Readonly<Record<FeatureFlagKey, string>> = {
  subscriptions: "SUBS_ENABLED",
  openFinance: "OF_ENABLED",
  recharge: "RECHARGE_ENABLED",
  assistant: "ASSISTANT_ENABLED",
};

const OFF_VALUES = ["false", "0", "off", "no"];

export function readFeatureFlags(env: Record<string, string | undefined>): FeatureFlags {
  const enabled = (key: FeatureFlagKey) => {
    const raw = env[FEATURE_FLAG_ENV[key]];
    return !(raw !== undefined && OFF_VALUES.includes(raw.trim().toLowerCase()));
  };
  return {
    subscriptions: enabled("subscriptions"),
    openFinance: enabled("openFinance"),
    recharge: enabled("recharge"),
    assistant: enabled("assistant"),
  };
}
