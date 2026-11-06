// Regras puras de negócio da recarga: telefone, valores, taxa, limites e verificação do PIX.
// Sem rede, sem banco, sem segredos. Dinheiro sempre em centavos inteiros.

import type {
  BrPhone,
  OrderRequestContext,
  OrderRequestInput,
  OrderRequestResult,
  PixExpected,
  PixObserved,
  PixVerification,
  RechargeSettings,
  ValidationErrorCode,
} from "./types.ts";

/** Normaliza um telefone brasileiro (com ou sem +55). Retorna null se inválido. */
export function normalizeBrPhone(input: string): BrPhone | null {
  if (typeof input !== "string") return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;

  const stateCode = Number(digits.slice(0, 2));
  if (stateCode < 11 || stateCode > 99 || digits[1] === "0") return null;

  const number = digits.slice(2);
  // Celular (9 dígitos) começa com 9; fixo (8 dígitos) começa com 2 a 5.
  if (number.length === 9 && number[0] !== "9") return null;
  if (number.length === 8 && !/[2-5]/.test(number[0])) return null;

  return { countryCode: 55, stateCode, number };
}

/** Máscara para logs e telas: nunca registrar o número completo. */
export function maskPhone(phone: BrPhone): string {
  const tail = phone.number.slice(-4);
  return `(${phone.stateCode}) *****-${tail}`;
}

function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Taxa em centavos: percentual (pontos-base, arredondado) mais valor fixo. */
export function computeFeeCents(
  amountCents: number,
  settings: Pick<RechargeSettings, "feeBps" | "feeFixedCents">,
): number {
  if (!isCents(amountCents)) throw new Error("invalid amount");
  const percent = Math.round((amountCents * settings.feeBps) / 10000);
  return percent + settings.feeFixedCents;
}

export function computeTotalCents(
  amountCents: number,
  settings: Pick<RechargeSettings, "feeBps" | "feeFixedCents">,
): number {
  return amountCents + computeFeeCents(amountCents, settings);
}

/** Valida o pedido. Reúne todos os erros de uma vez. */
export function validateOrderRequest(
  input: OrderRequestInput,
  ctx: OrderRequestContext,
): OrderRequestResult {
  const errors: ValidationErrorCode[] = [];
  const { settings } = ctx;

  if (!settings.enabled) errors.push("disabled");

  const phone = normalizeBrPhone(input.phone);
  if (!phone) errors.push("invalid_phone");

  if (!Number.isSafeInteger(input.providerId) || input.providerId <= 0) {
    errors.push("invalid_provider");
  }

  if (!isCents(input.amountCents)) {
    errors.push("invalid_amount");
  } else {
    if (input.amountCents < settings.minCents) errors.push("below_min");
    if (input.amountCents > settings.maxCents) errors.push("above_max");
    if (ctx.allowedAmountsCents && !ctx.allowedAmountsCents.includes(input.amountCents)) {
      errors.push("amount_not_offered");
    }
    if (ctx.spentTodayCents + input.amountCents > settings.dailyLimitPerUserCents) {
      errors.push("daily_limit_exceeded");
    }
  }

  if (errors.length > 0 || !phone) return { ok: false, errors };

  const feeCents = computeFeeCents(input.amountCents, settings);
  return {
    ok: true,
    value: {
      phone,
      amountCents: input.amountCents,
      feeCents,
      totalCents: input.amountCents + feeCents,
    },
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O clientRequestId da recarga é o id do pedido: determinístico, único e dentro do
 * limite de 200 caracteres. Reenviar a mesma recarga usa SEMPRE o mesmo valor.
 */
export function buildClientRequestId(orderId: string): string {
  if (typeof orderId !== "string" || !UUID_RE.test(orderId)) {
    throw new Error("orderId must be a UUID");
  }
  return orderId.toLowerCase();
}

export function pixExpiresAt(now: Date, expiryMinutes: number): Date {
  return new Date(now.getTime() + expiryMinutes * 60_000);
}

export function isPixExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

/**
 * Compara a observação OFICIAL do provedor com o que o servidor esperava.
 * Nunca deve receber dados vindos do frontend.
 */
export function verifyPixPayment(
  expected: PixExpected,
  observed: PixObserved,
  now: Date,
): PixVerification {
  switch (observed.status) {
    case "pending":
      return isPixExpired(expected.expiresAt, now) ? { outcome: "expired" } : { outcome: "pending" };
    case "expired":
      return { outcome: "expired" };
    case "canceled":
      return { outcome: "canceled" };
    case "unknown":
      return { outcome: "unknown_status" };
    case "confirmed": {
      if (observed.paidAmountCents === undefined || !observed.receiverKey) {
        return { outcome: "mismatch", reason: "missing_data" };
      }
      if (observed.paidAmountCents !== expected.amountCents) {
        return { outcome: "mismatch", reason: "amount" };
      }
      if (observed.receiverKey !== expected.receiverKey) {
        return { outcome: "mismatch", reason: "receiver" };
      }
      if (observed.paidAt && observed.paidAt.getTime() > expected.expiresAt.getTime()) {
        return { outcome: "late_payment" };
      }
      return { outcome: "confirmed" };
    }
  }
}
