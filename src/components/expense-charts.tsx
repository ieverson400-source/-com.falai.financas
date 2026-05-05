import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { categoryColor, formatBRL } from "@/lib/categories";

interface Expense {
  amount: number;
  category: string;
  expense_date: string;
}

export function ExpenseCharts({ expenses }: { expenses: Expense[] }) {
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => map.set(e.category, (map.get(e.category) || 0) + Number(e.amount)));
    return Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const d = e.expense_date.slice(5); // MM-DD
      map.set(d, (map.get(d) || 0) + Number(e.amount));
    });
    return Array.from(map, ([date, total]) => ({ date, total })).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [expenses]);

  if (expenses.length === 0) {
    return (
      <Card className="p-8 sm:p-12 text-center text-muted-foreground bg-card rounded-2xl shadow-soft">
        <p className="text-sm">Nenhum gasto ainda. Grave um áudio para começar 🎙️</p>
      </Card>
    );
  }

  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    fontSize: "0.8rem",
    boxShadow: "var(--shadow-soft)",
  } as const;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
      <Card className="p-4 sm:p-6 bg-card rounded-2xl shadow-soft transition-shadow hover:shadow-elevated animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="font-display text-base sm:text-lg font-semibold">Por categoria</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {byCategory.length} {byCategory.length === 1 ? "categoria" : "categorias"}
          </span>
        </div>
        <div className="h-56 sm:h-64 lg:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={byCategory}
                dataKey="value"
                nameKey="name"
                innerRadius="45%"
                outerRadius="80%"
                paddingAngle={2}
              >
                {byCategory.map((entry) => (
                  <Cell key={entry.name} fill={categoryColor(entry.name)} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatBRL(Number(v))} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 sm:mt-4 space-y-2 text-sm">
          {byCategory.slice(0, 5).map((c) => (
            <li
              key={c.name}
              className="flex items-center justify-between gap-3 py-1.5 px-1 rounded-md transition-colors hover:bg-muted/50"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ background: categoryColor(c.name) }}
                />
                <span className="truncate">{c.name}</span>
              </span>
              <span className="font-medium tabular-nums shrink-0 text-foreground">
                {formatBRL(c.value)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4 sm:p-6 bg-card rounded-2xl shadow-soft transition-shadow hover:shadow-elevated animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="font-display text-base sm:text-lg font-semibold">Por dia</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {byDay.length} {byDay.length === 1 ? "dia" : "dias"}
          </span>
        </div>
        <div className="h-56 sm:h-64 lg:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={12}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) =>
                  Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : String(v)
                }
              />
              <Tooltip
                formatter={(v) => formatBRL(Number(v))}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
