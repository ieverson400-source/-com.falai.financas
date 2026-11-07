// SIMULAÇÃO até a integração real: estado da assinatura somente no navegador, só para a UI poder ser
// testada. Em produção o estado é SEMPRE "free"; apenas em desenvolvimento (import.meta.env.DEV) ele pode
// ser alterado. Não lê nem escreve a tabela `subscriptions`.

import { useSyncExternalStore } from "react";
import type { SubscriptionState } from "./provider.ts";

const KEY = "falai-subs-sim-state";
export const SUBSCRIPTION_STATES: readonly SubscriptionState[] = [
  "free",
  "pending",
  "pro",
  "premium",
  "familia",
  "expired",
  "error",
];
const listeners = new Set<() => void>();

function read(): SubscriptionState {
  if (!import.meta.env.DEV || typeof window === "undefined") return "free";
  try {
    const v = window.sessionStorage.getItem(KEY) as SubscriptionState | null;
    return v && SUBSCRIPTION_STATES.includes(v) ? v : "free";
  } catch {
    return "free";
  }
}

/** Só tem efeito em desenvolvimento. */
export function setSubscriptionSimState(next: SubscriptionState): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, next);
  } catch {
    /* armazenamento indisponível */
  }
  listeners.forEach((l) => l());
}

export function useSubscriptionSimState(): SubscriptionState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "free",
  );
}
