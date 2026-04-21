import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AudioRecorder } from "@/components/audio-recorder";
import { ExpenseCharts } from "@/components/expense-charts";
import { ManualExpenseDialog } from "@/components/manual-expense-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { LogOut, Trash2, Mic, Hand } from "lucide-react";
import { categoryColor, formatBRL } from "@/lib/categories";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app")({
  component: AppDashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Falaí Finanças" },
      { name: "description", content: "Seus gastos organizados por IA." },
    ],
  }),
});

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  expense_date: string;
  source: "manual" | "audio";
  raw_transcript: string | null;
  created_at: string;
}

function AppDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });
    setRefreshing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setExpenses((data ?? []) as Expense[]);
  }, [user]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const deleteExp = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gasto removido");
    load();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const monthStart = startOfMonth(new Date());
  const monthExpenses = expenses.filter((e) => parseISO(e.expense_date) >= monthStart);
  const totalMonth = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />

      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-hero flex items-center justify-center">
              <Mic className="size-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold">Falaí</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-40">
              {user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Top stats + recorder */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <AudioRecorder onSuccess={load} />
          </div>
          <div className="space-y-4">
            <Card className="p-6 bg-card">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Mês atual</p>
              <p className="font-display text-3xl font-bold mt-1">{formatBRL(totalMonth)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {monthExpenses.length} {monthExpenses.length === 1 ? "gasto" : "gastos"}
              </p>
            </Card>
            <Card className="p-6 bg-secondary border-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total geral</p>
              <p className="font-display text-2xl font-semibold mt-1">{formatBRL(totalAll)}</p>
            </Card>
          </div>
        </div>

        {/* Charts */}
        <ExpenseCharts expenses={monthExpenses} />

        {/* List */}
        <Card className="bg-card">
          <div className="p-6 flex items-center justify-between border-b border-border">
            <div>
              <h3 className="font-display text-lg font-semibold">Gastos recentes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {refreshing ? "Atualizando..." : `${expenses.length} no total`}
              </p>
            </div>
            <ManualExpenseDialog onSuccess={load} userId={user.id} />
          </div>

          {expenses.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum gasto ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {expenses.slice(0, 30).map((e) => (
                <li key={e.id} className="px-6 py-4 flex items-center gap-4 group">
                  <div
                    className="size-2.5 rounded-full shrink-0"
                    style={{ background: categoryColor(e.category) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{e.category}</span>
                      {e.source === "audio" && (
                        <Mic className="size-3 text-primary shrink-0" aria-label="Por áudio" />
                      )}
                      {e.source === "manual" && (
                        <Hand className="size-3 text-muted-foreground shrink-0" aria-label="Manual" />
                      )}
                    </div>
                    {(e.description || e.raw_transcript) && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {e.description || e.raw_transcript}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-semibold tabular-nums">
                      {formatBRL(Number(e.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(e.expense_date), "dd MMM", { locale: ptBR })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteExp(e.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    aria-label="Excluir"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
