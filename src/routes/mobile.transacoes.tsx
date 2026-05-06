import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { categoryColor, formatBRL } from "@/lib/categories";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/mobile/transacoes")({
  component: TransacoesTab,
});

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  expense_date: string;
}

function TransacoesTab() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("expenses")
      .select("id, amount, category, description, expense_date")
      .order("expense_date", { ascending: false })
      .limit(80)
      .then(({ data }) => {
        setExpenses((data ?? []) as Expense[]);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Transações</h1>
        <p className="text-sm text-muted-foreground mt-1">Seu histórico de gastos.</p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>
      ) : expenses.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground shadow-soft">
          Nenhuma transação ainda.
        </Card>
      ) : (
        <Card className="shadow-soft overflow-hidden">
          <ul className="divide-y divide-border">
            {expenses.map((e) => (
              <li key={e.id} className="px-4 py-3 flex items-center gap-3">
                <div
                  className="size-2.5 rounded-full shrink-0"
                  style={{ background: categoryColor(e.category) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{e.category}</p>
                  {e.description && (
                    <p className="text-xs text-muted-foreground truncate">{e.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-semibold tabular-nums text-sm">
                    {formatBRL(Number(e.amount))}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(parseISO(e.expense_date), "dd MMM", { locale: ptBR })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
