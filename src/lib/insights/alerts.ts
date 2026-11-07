// Aviso dentro do app quando uma cobrança recorrente aumentou de preço. Código puro.
// Não é notificação push: aparece quando o usuário abre o app. Push exigiria um processo no servidor e uma
// tabela para não repetir avisos (proposta em docs/insights/).

import { localIso, toDay, type RecurringCharge } from "./recurring.ts";

export interface PriceAlert {
  id: string;
  label: string;
  fromAmount: number;
  toAmount: number;
  pct: number;
  lastDate: string;
}

export const MIN_ALERT_PCT = 5;
export const ALERT_WINDOW_DAYS = 45;
export const MAX_ALERTS = 3;

/** Identifica um aviso: muda quando entra uma nova cobrança, então um novo reajuste volta a avisar. */
export function alertId(charge: Pick<RecurringCharge, "key" | "lastDate">): string {
  return `${charge.key}|${charge.lastDate}`;
}

export function priceIncreaseAlerts(
  recurring: readonly RecurringCharge[],
  today: Date,
  dismissed: ReadonlySet<string> = new Set(),
): PriceAlert[] {
  const todayDay = toDay(localIso(today));
  return recurring
    .filter(
      (r) =>
        r.status === "active" &&
        // Só assinaturas têm preço fixo; contas variáveis (luz, água) oscilam e gerariam falsos avisos.
        r.likelySubscription &&
        r.priceChangePct !== null &&
        r.priceChangePct >= MIN_ALERT_PCT &&
        todayDay - toDay(r.lastDate) <= ALERT_WINDOW_DAYS &&
        !dismissed.has(alertId(r)),
    )
    .sort((a, b) => (b.priceChangePct ?? 0) - (a.priceChangePct ?? 0))
    .slice(0, MAX_ALERTS)
    .map((r) => ({
      id: alertId(r),
      label: r.label,
      fromAmount: r.firstAmount,
      toAmount: r.lastAmount,
      pct: r.priceChangePct ?? 0,
      lastDate: r.lastDate,
    }));
}
