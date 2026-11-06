// Máquina de estados do pedido de recarga. Código puro.
// A lista de transições deve ser idêntica à função SQL recharge_transition
// (docs/recharge/proposed-schema.sql); rules.test.ts compara as duas.

import type {
  ActorKind,
  OrderStatus,
  PixVerification,
  ReviewReason,
} from "./types.ts";

export const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pix_pending: ["pix_confirmed", "pix_expired", "needs_review"],
  // PIX pago depois de expirar nunca vira recarga sozinho: vai para revisão.
  pix_expired: ["needs_review"],
  pix_confirmed: ["topup_submitting", "needs_review"],
  topup_submitting: ["topup_pending", "topup_done", "topup_failed", "needs_review"],
  topup_pending: ["topup_done", "topup_failed", "needs_review"],
  // Pagamento recebido sem recarga: sempre passa por análise humana.
  topup_failed: ["needs_review"],
  needs_review: ["topup_submitting", "topup_done", "closed"],
  topup_done: [],
  closed: [],
};

/** Pares que só um administrador pode executar (não há reenvio automático). */
export const ADMIN_ONLY_PAIRS: readonly string[] = [
  "needs_review>topup_submitting",
  "needs_review>closed",
];

/** Pares que o admin ou a reconciliação podem executar. */
export const ADMIN_OR_RECONCILE_PAIRS: readonly string[] = ["needs_review>topup_done"];

export const SERVER_ACTORS: readonly ActorKind[] = ["system", "webhook", "reconcile"];

export function pairKey(from: OrderStatus, to: OrderStatus): string {
  return `${from}>${to}`;
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canTransition(from: OrderStatus, to: OrderStatus, actor: ActorKind): boolean {
  if (!TRANSITIONS[from].includes(to)) return false;
  const key = pairKey(from, to);
  if (ADMIN_OR_RECONCILE_PAIRS.includes(key)) return actor === "admin" || actor === "reconcile";
  if (ADMIN_ONLY_PAIRS.includes(key)) return actor === "admin";
  return SERVER_ACTORS.includes(actor);
}

export function assertTransition(from: OrderStatus, to: OrderStatus, actor: ActorKind): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new Error(`transition not allowed: ${pairKey(from, to)}`);
  }
  if (!canTransition(from, to, actor)) {
    throw new Error(`actor ${actor} may not perform ${pairKey(from, to)}`);
  }
}

/** Estados em que a recarga já foi (ou pode ter sido) enviada ao provedor. */
export function topupMayExist(status: OrderStatus): boolean {
  return (
    status === "topup_submitting" ||
    status === "topup_pending" ||
    status === "topup_done" ||
    status === "topup_failed"
  );
}

export interface Decision {
  status: OrderStatus;
  reviewReason?: ReviewReason;
}

/**
 * Próximo estado do pedido a partir da verificação oficial do PIX.
 * Retorna null quando nada deve mudar (inclui confirmações duplicadas).
 */
export function nextStatusAfterPixVerification(
  current: OrderStatus,
  verification: PixVerification,
): Decision | null {
  switch (verification.outcome) {
    case "pending":
      return null;
    case "confirmed":
      if (current === "pix_pending") return { status: "pix_confirmed" };
      if (current === "pix_expired") return { status: "needs_review", reviewReason: "late_payment" };
      return null; // já confirmado ou adiante: idempotente
    case "late_payment":
      if (current === "pix_pending" || current === "pix_expired") {
        return { status: "needs_review", reviewReason: "late_payment" };
      }
      return null;
    case "expired":
    case "canceled":
      return current === "pix_pending" ? { status: "pix_expired" } : null;
    case "mismatch": {
      if (current !== "pix_pending" && current !== "pix_expired") return null;
      const reviewReason: ReviewReason =
        verification.reason === "receiver" ? "receiver_mismatch" : "amount_mismatch";
      return { status: "needs_review", reviewReason };
    }
    case "unknown_status":
      return current === "pix_pending"
        ? { status: "needs_review", reviewReason: "unknown_pix_status" }
        : null;
  }
}

/**
 * Próximo estado a partir do status da recarga informado pela Celcoin (GET /topup).
 * Qualquer valor fora do conjunto documentado exige revisão manual.
 */
export function nextStatusAfterTopupStatus(
  current: OrderStatus,
  providerStatus: string | null | undefined,
): Decision | null {
  const normalized = typeof providerStatus === "string" ? providerStatus.trim().toUpperCase() : "";
  let target: Decision;
  switch (normalized) {
    case "INITIATED":
    case "PROCESSING":
      target = { status: "topup_pending" };
      break;
    case "CONFIRMED":
      target = { status: "topup_done" };
      break;
    case "ERROR":
      target = { status: "topup_failed" };
      break;
    default:
      target = { status: "needs_review", reviewReason: "topup_unknown_status" };
  }
  if (target.status === current) return null;
  return TRANSITIONS[current].includes(target.status) ? target : null;
}
