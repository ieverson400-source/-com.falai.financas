// SIMULAÇÃO até a Etapa 3: estado de conexão do Open Finance somente no navegador.
// Não há backend nem dado bancário. Em produção o estado é SEMPRE "disconnected"; só em
// desenvolvimento (import.meta.env.DEV) o estado pode ser alterado, para pré-visualizar as telas.

import { useSyncExternalStore } from "react";
import type { OpenFinanceConnectionStatus } from "./provider.ts";

const KEY = "falai-of-sim-state";
const VALID: readonly OpenFinanceConnectionStatus[] = ["disconnected", "pending", "connected", "expired", "error"];
const listeners = new Set<() => void>();

function read(): OpenFinanceConnectionStatus {
  if (!import.meta.env.DEV || typeof window === "undefined") return "disconnected";
  try {
    const v = window.sessionStorage.getItem(KEY) as OpenFinanceConnectionStatus | null;
    return v && VALID.includes(v) ? v : "disconnected";
  } catch {
    return "disconnected";
  }
}

/** Só tem efeito em desenvolvimento. */
export function setOpenFinanceSimState(next: OpenFinanceConnectionStatus): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, next);
  } catch {
    /* armazenamento indisponível */
  }
  listeners.forEach((l) => l());
}

export function useOpenFinanceSimState(): OpenFinanceConnectionStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "disconnected",
  );
}
