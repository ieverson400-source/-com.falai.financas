// SIMULAÇÃO somente para desenvolvimento: permite pré-visualizar os estados da tela de assinatura.
// Em produção nenhuma simulação existe (o override é sempre null e vale o estado real do servidor).
// Não lê nem escreve a tabela `subscriptions`.

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

function read(): SubscriptionState | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(KEY) as SubscriptionState | null;
    return v && SUBSCRIPTION_STATES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

/** Só tem efeito em desenvolvimento. Use null para voltar ao estado real. */
export function setSubscriptionSimState(next: SubscriptionState | null): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  try {
    if (next === null) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, next);
  } catch {
    /* armazenamento indisponível */
  }
  listeners.forEach((l) => l());
}

export function useSubscriptionSimOverride(): SubscriptionState | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => null,
  );
}
