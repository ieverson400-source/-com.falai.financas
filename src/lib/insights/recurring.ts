// Detecção de cobranças recorrentes (assinaturas e contas fixas) a partir do histórico de gastos.
// Código puro: só usa os gastos que o usuário já registrou. Os resultados são ESTIMATIVAS por
// heurística (mesmo nome, valor parecido, repetição mensal) e podem errar.

import { normalizeText, suggestCategory } from "./categorize.ts";

export interface ExpenseLike {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  /** yyyy-mm-dd */
  expense_date: string;
}

export interface RecurringCharge {
  key: string;
  label: string;
  category: string;
  /** Valor típico mensal (mediana). */
  typicalAmount: number;
  firstAmount: number;
  lastAmount: number;
  occurrences: number;
  firstDate: string;
  lastDate: string;
  monthsActive: number;
  nextExpectedDate: string;
  monthlyCost: number;
  annualCost: number;
  /** Variação do último valor em relação ao primeiro, em %, quando relevante (>= 3%). */
  priceChangePct: number | null;
  likelySubscription: boolean;
  /** Sugere revisar: assinatura ativa há muito tempo ou com reajuste. */
  review: boolean;
  status: "active" | "stopped";
}

const NOISE = new Set([
  "compra", "pagamento", "pgto", "pix", "debito", "credito", "cartao", "parcela", "ltda", "sa", "me", "brasil", "br",
  "app", "com", "www", "de", "da", "do", "em", "no", "na", "e", "a", "o", "final",
]);

/** Chave estável para agrupar gastos do mesmo estabelecimento/serviço. */
export function expenseKey(description: string | null | undefined): string {
  const tokens = normalizeText(description)
    .split(" ")
    .filter((t) => t.length > 1 && !NOISE.has(t) && !/^\d+$/.test(t));
  return tokens.slice(0, 3).join(" ");
}

const DAY_MS = 86_400_000;
export function toDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / DAY_MS);
}
export function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** yyyy-mm-dd na data LOCAL do usuário (toISOString usaria UTC e viraria o dia à noite no Brasil). */
export function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Mesmo dia do mês seguinte (ajustado ao último dia quando o mês seguinte é mais curto). */
export function addOneMonth(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const lastOfNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const dt = new Date(Date.UTC(y, m, Math.min(d, lastOfNext)));
  return dt.toISOString().slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const MONTHLY_MIN = 24;
const MONTHLY_MAX = 38;
const ACTIVE_WINDOW_DAYS = 50;
/** Variação máxima (35%) de uma cobrança para a seguinte para ainda ser considerada a mesma cobrança. */
const MAX_STEP_CHANGE = 0.35;

export function detectRecurring(expenses: readonly ExpenseLike[], today: Date): RecurringCharge[] {
  // Data LOCAL do usuário (não UTC), para bater com a projeção do mês.
  const todayDay = toDay(localIso(today));
  const groups = new Map<string, ExpenseLike[]>();
  for (const e of expenses) {
    if (!(Number(e.amount) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(e.expense_date)) continue;
    const key = expenseKey(e.description);
    if (key.length < 3) continue;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  const out: RecurringCharge[] = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => toDay(a.expense_date) - toDay(b.expense_date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const label = (last.description ?? key).trim();
    const likelySubscription = last.category === "Assinaturas" || suggestCategory(label) === "Assinaturas";

    // Assinaturas conhecidas precisam de 2 cobranças; as demais, de 3.
    const minOccurrences = likelySubscription ? 2 : 3;
    if (sorted.length < minOccurrences) continue;

    const days = sorted.map((e) => toDay(e.expense_date));
    const intervals = days.slice(1).map((d, i) => d - days[i]);
    // Duas cobranças a menos de 10 dias uma da outra indicam compras avulsas, não uma assinatura.
    if (intervals.some((i) => i < 10)) continue;
    const monthlyShare = intervals.filter((i) => i >= MONTHLY_MIN && i <= MONTHLY_MAX).length / intervals.length;
    if (monthlyShare < 0.8) continue;

    // Valores parecidos de uma cobrança para a próxima. Compara cada valor com o anterior (e não com a
    // mediana) para continuar reconhecendo assinaturas que sobem de preço em degraus.
    const amounts = sorted.map((e) => Number(e.amount));
    const steps = amounts.slice(1).map((a, i) => Math.abs(a - amounts[i]) <= amounts[i] * MAX_STEP_CHANGE);
    if (steps.filter(Boolean).length / steps.length < 0.8) continue;

    const lastDay = days[days.length - 1];
    const status: "active" | "stopped" = todayDay - lastDay <= ACTIVE_WINDOW_DAYS ? "active" : "stopped";
    const monthsActive = Math.round((lastDay - days[0]) / 30.4) + 1;
    const firstAmount = amounts[0];
    const lastAmount = amounts[amounts.length - 1];
    const change = firstAmount > 0 ? ((lastAmount - firstAmount) / firstAmount) * 100 : 0;
    const priceChangePct = Math.abs(change) >= 3 ? Math.round(change) : null;
    // Custo mensal = último valor cobrado (o preço atual), não a mediana, que subestima após um reajuste.
    const monthlyCost = round2(lastAmount);

    out.push({
      key,
      label,
      category: last.category,
      typicalAmount: monthlyCost,
      firstAmount: round2(firstAmount),
      lastAmount: round2(lastAmount),
      occurrences: sorted.length,
      firstDate: first.expense_date,
      lastDate: last.expense_date,
      monthsActive,
      nextExpectedDate: addOneMonth(last.expense_date),
      monthlyCost,
      annualCost: round2(monthlyCost * 12),
      priceChangePct,
      likelySubscription,
      // Só assinaturas: contas variáveis (luz, água) oscilam todo mês e não devem gerar "Vale revisar".
      review: status === "active" && likelySubscription && (monthsActive >= 6 || (priceChangePct ?? 0) >= 10),
      status,
    });
  }

  return out.sort((a, b) => Number(b.review) - Number(a.review) || b.monthlyCost - a.monthlyCost);
}
