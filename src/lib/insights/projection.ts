// Projeção do total de gastos até o fim do mês. Código puro, baseado só nos gastos já registrados.
// É uma ESTIMATIVA: combina o ritmo do mês, as cobranças recorrentes que ainda devem cair e a média
// dos meses anteriores (com peso maior no histórico no começo do mês, quando o ritmo ainda é pouco confiável).

import { detectRecurring, expenseKey, type ExpenseLike, type RecurringCharge } from "./recurring.ts";

export interface PendingCharge {
  label: string;
  amount: number;
  date: string;
}

export interface MonthProjection {
  spentSoFar: number;
  daysElapsed: number;
  daysInMonth: number;
  remainingDays: number;
  /** Gasto variável médio por dia no mês (sem as cobranças recorrentes). */
  dailyPace: number;
  /** Cobranças recorrentes ainda previstas neste mês. */
  pendingFixed: number;
  pendingCharges: PendingCharge[];
  /** Média dos últimos até 3 meses completos com gastos; null se não houver histórico. */
  historicalAvg: number | null;
  projectedTotal: number;
  /** Variação da projeção em relação à média histórica, em %. */
  vsHistoricalPct: number | null;
  confidence: "low" | "medium" | "high";
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");

export function projectMonthEnd(
  expenses: readonly ExpenseLike[],
  now: Date,
  recurring?: readonly RecurringCharge[],
): MonthProjection | null {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPrefix = `${year}-${pad(month + 1)}`;
  const todayIso = `${monthPrefix}-${pad(day)}`;

  const valid = expenses.filter((e) => Number(e.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.expense_date));
  const thisMonth = valid.filter((e) => e.expense_date.startsWith(monthPrefix) && e.expense_date <= todayIso);
  const spentSoFar = thisMonth.reduce((s, e) => s + Number(e.amount), 0);

  // Média dos meses completos anteriores (até 3 com gastos).
  const byMonth = new Map<string, number>();
  for (const e of valid) {
    const ym = e.expense_date.slice(0, 7);
    if (ym < monthPrefix) byMonth.set(ym, (byMonth.get(ym) ?? 0) + Number(e.amount));
  }
  const recentMonths = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 3);
  const historicalAvg = recentMonths.length
    ? round2(recentMonths.reduce((s, [, v]) => s + v, 0) / recentMonths.length)
    : null;

  if (thisMonth.length === 0 && historicalAvg === null) return null;

  const active = (recurring ?? detectRecurring(valid, now)).filter((r) => r.status === "active");
  const activeKeys = new Set(active.map((r) => r.key));

  const chargedKeys = new Set(thisMonth.map((e) => expenseKey(e.description)));
  const recurringSoFar = thisMonth
    .filter((e) => activeKeys.has(expenseKey(e.description)))
    .reduce((s, e) => s + Number(e.amount), 0);

  const pendingCharges: PendingCharge[] = active
    .filter((r) => !chargedKeys.has(r.key) && r.nextExpectedDate.startsWith(monthPrefix))
    .map((r) => ({ label: r.label, amount: r.typicalAmount, date: r.nextExpectedDate }));
  const pendingFixed = round2(pendingCharges.reduce((s, c) => s + c.amount, 0));

  const variableSoFar = Math.max(0, spentSoFar - recurringSoFar);
  const dailyPace = variableSoFar / day;
  const byPace = recurringSoFar + pendingFixed + dailyPace * daysInMonth;

  // No começo do mês o ritmo é instável: mistura com a média histórica, dando mais peso ao ritmo ao longo do mês.
  const weight = day / daysInMonth;
  const blended = historicalAvg === null ? byPace : weight * byPace + (1 - weight) * historicalAvg;
  const projectedTotal = round2(Math.max(blended, spentSoFar + pendingFixed));

  const confidence: MonthProjection["confidence"] =
    day < 5 || thisMonth.length < 5 ? "low" : day >= 15 && thisMonth.length >= 15 ? "high" : "medium";

  return {
    spentSoFar: round2(spentSoFar),
    daysElapsed: day,
    daysInMonth,
    remainingDays: daysInMonth - day,
    dailyPace: round2(dailyPace),
    pendingFixed,
    pendingCharges,
    historicalAvg,
    projectedTotal,
    vsHistoricalPct: historicalAvg ? Math.round(((projectedTotal - historicalAvg) / historicalAvg) * 100) : null,
    confidence,
  };
}
