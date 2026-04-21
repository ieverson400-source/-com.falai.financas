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
      <Card className="p-12 text-center text-muted-foreground bg-card">
        <p className="text-sm">Nenhum gasto ainda. Grave um áudio para começar 🎙️</p>
      </Card>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-6 bg-card">
        <h3 className="font-display text-lg font-semibold mb-4">Por categoria</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {byCategory.map((entry) => (
                  <Cell key={entry.name} fill={categoryColor(entry.name)} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => formatBRL(v)}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  fontSize: "0.85rem",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm">
          {byCategory.slice(0, 5).map((c) => (
            <li key={c.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: categoryColor(c.name) }} />
                {c.name}
              </span>
              <span className="font-medium tabular-nums">{formatBRL(c.value)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6 bg-card">
        <h3 className="font-display text-lg font-semibold mb-4">Por dia</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip
                formatter={(v: number) => formatBRL(v)}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  fontSize: "0.85rem",
                }}
              />
              <Bar dataKey="total" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
