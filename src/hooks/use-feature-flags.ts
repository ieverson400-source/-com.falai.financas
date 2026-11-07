import { useEffect, useState } from "react";
import { getFeatureFlags } from "@/lib/feature-flags.functions";
import type { FeatureFlags } from "@/lib/feature-flags";

const ALL_OFF: FeatureFlags = { subscriptions: false, openFinance: false, recharge: false, assistant: false };

/**
 * Estado dos recursos em liberação, lido no servidor (só booleanos). Falha fechada: enquanto carrega,
 * ou se a consulta falhar, todos os recursos aparecem como desligados.
 */
export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(ALL_OFF);
  useEffect(() => {
    let alive = true;
    getFeatureFlags()
      .then((f) => alive && setFlags(f))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return flags;
}
