// Tipos do domínio de recarga. Código puro: sem rede, sem banco, sem segredos.

export const ORDER_STATUSES = [
  "pix_pending",
  "pix_expired",
  "pix_confirmed",
  "topup_submitting",
  "topup_pending",
  "topup_done",
  "topup_failed",
  "needs_review",
  "closed",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REVIEW_REASONS = [
  "amount_mismatch",
  "receiver_mismatch",
  "late_payment",
  "unknown_pix_status",
  "topup_error",
  "topup_unknown_status",
  "topup_timeout",
  "topup_not_found",
  "provider_validation_error",
  "manual",
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

/** Quem executa uma transição. O usuário/frontend nunca pode mudar o estado. */
export type ActorKind = "system" | "webhook" | "reconcile" | "admin" | "user";

/** Estado normalizado da cobrança PIX (independente do provedor). */
export type PixChargeStatus = "pending" | "confirmed" | "expired" | "canceled" | "unknown";

/** Estados da recarga informados pela Celcoin BaaS v2 (GET /topup). */
export const TOPUP_PROVIDER_STATUSES = ["INITIATED", "PROCESSING", "CONFIRMED", "ERROR"] as const;
export type TopupProviderStatus = (typeof TOPUP_PROVIDER_STATUSES)[number];

export interface RechargeSettings {
  enabled: boolean;
  minCents: number;
  maxCents: number;
  /** Taxa percentual em pontos-base (100 = 1%). */
  feeBps: number;
  feeFixedCents: number;
  dailyLimitPerUserCents: number;
  pixExpiryMinutes: number;
}

export interface BrPhone {
  countryCode: 55;
  stateCode: number;
  number: string;
}

export interface OrderRequestInput {
  phone: string;
  amountCents: number;
  providerId: number;
}

export interface OrderRequestContext {
  settings: RechargeSettings;
  /** Soma dos pedidos do usuário no dia (centavos), para o limite diário. */
  spentTodayCents: number;
  /** Valores oferecidos pela operadora (centavos), se já consultados. */
  allowedAmountsCents?: readonly number[];
}

export type ValidationErrorCode =
  | "disabled"
  | "invalid_phone"
  | "invalid_provider"
  | "invalid_amount"
  | "below_min"
  | "above_max"
  | "amount_not_offered"
  | "daily_limit_exceeded";

export type OrderRequestResult =
  | {
      ok: true;
      value: { phone: BrPhone; amountCents: number; feeCents: number; totalCents: number };
    }
  | { ok: false; errors: ValidationErrorCode[] };

export interface PixExpected {
  amountCents: number;
  receiverKey: string;
  expiresAt: Date;
}

export interface PixObserved {
  status: PixChargeStatus;
  paidAmountCents?: number;
  receiverKey?: string;
  paidAt?: Date;
}

export type PixVerification =
  | { outcome: "pending" }
  | { outcome: "confirmed" }
  | { outcome: "expired" }
  | { outcome: "canceled" }
  | { outcome: "late_payment" }
  | { outcome: "mismatch"; reason: "amount" | "receiver" | "missing_data" }
  | { outcome: "unknown_status" };
