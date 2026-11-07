export function guardianMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value ?? '2026';
  const month = parts.find(p => p.type === 'month')?.value ?? '01';
  return `${year}-${month}-01`;
}

export function summarizeGuardian(expenses: { category: string; amount: number }[], budgets: { category: string; monthly_limit: number }[]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) totals.set(expense.category, (totals.get(expense.category) ?? 0) + Number(expense.amount));
  const categories = [...new Set([...totals.keys(), ...budgets.map(b => b.category)])].map(category => {
    const total = Math.round((totals.get(category) ?? 0) * 100) / 100;
    const limit = Number(budgets.find(b => b.category === category)?.monthly_limit ?? 0);
    return { category, total, limit, alert: limit > 0 && total >= limit ? 'over' : limit > 0 && total >= limit * .8 ? 'near' : 'ok' };
  }).sort((a, b) => b.total - a.total);
  return { total: Math.round(categories.reduce((sum, c) => sum + c.total, 0) * 100) / 100, count: expenses.length, categories };
}