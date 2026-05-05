import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AudioRecorder } from "@/components/audio-recorder";
import { ExpenseCharts } from "@/components/expense-charts";
import { ManualExpenseDialog } from "@/components/manual-expense-dialog";
import { WhatsAppLinkCard } from "@/components/whatsapp-link-card";
import { WhatsAppInboxCard, type WhatsAppInboxItem } from "@/components/whatsapp-inbox-card";
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
  const [whatsAppPhone, setWhatsAppPhone] = useState<string | null>(null);
  const [whatsAppInbox, setWhatsAppInbox] = useState<WhatsAppInboxItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    const [expensesRes, profileRes, inboxRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("whatsapp_phone").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("whatsapp_inbox")
        .select("id, from_phone, transcript, processing_status, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    setRefreshing(false);
    if (expensesRes.error || profileRes.error || inboxRes.error) {
      toast.error(
        expensesRes.error?.message ||
          profileRes.error?.message ||
          inboxRes.error?.message ||
          "Falha ao carregar dados",
      );
      return;
    }
    setExpenses((expensesRes.data ?? []) as Expense[]);
    setWhatsAppPhone(profileRes.data?.whatsapp_phone ?? null);
    setWhatsAppInbox((inboxRes.data ?? []) as WhatsAppInboxItem[]);
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

      <header className="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="size-9 rounded-xl bg-gradient-hero flex items-center justify-center shadow-soft">
              <Mic className="size-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold truncate">Falaí</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link to="/app/whatsapp-test" className="hidden xs:inline-flex sm:inline-flex">
              <Button variant="outline" size="sm" className="h-10 sm:h-9 px-3">
                <span className="hidden sm:inline">Testar webhook</span>
                <span className="sm:hidden">Webhook</span>
              </Button>
            </Link>
            <span className="text-sm text-muted-foreground hidden md:inline truncate max-w-40">
              {user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 h-10 sm:h-9 px-3">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Top stats + recorder */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="lg:col-span-2">
            <AudioRecorder onSuccess={load} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            <Card className="p-5 sm:p-6 bg-card shadow-soft transition-shadow hover:shadow-elevated">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Mês atual</p>
              <p className="font-display text-2xl sm:text-3xl font-bold mt-1 break-words">{formatBRL(totalMonth)}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {monthExpenses.length} {monthExpenses.length === 1 ? "gasto" : "gastos"}
              </p>
            </Card>
            <Card className="p-5 sm:p-6 bg-secondary border-0 shadow-soft">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total geral</p>
              <p className="font-display text-xl sm:text-2xl font-semibold mt-1 break-words">{formatBRL(totalAll)}</p>
            </Card>
            <div className="col-span-2 lg:col-span-1">
              <WhatsAppLinkCard currentPhone={whatsAppPhone} onSaved={setWhatsAppPhone} />
            </div>
          </div>
        </div>

        {/* Charts */}
        <ExpenseCharts expenses={monthExpenses} />

        <WhatsAppInboxCard items={whatsAppInbox} />

        {/* List */}
        <Card className="bg-card shadow-soft overflow-hidden">
          <div className="p-4 sm:p-6 flex items-center justify-between gap-3 border-b border-border">
            <div className="min-w-0">
              <h3 className="font-display text-base sm:text-lg font-semibold">Gastos recentes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {refreshing ? "Atualizando..." : `${expenses.length} no total`}
              </p>
            </div>
            <ManualExpenseDialog onSuccess={load} userId={user.id} />
          </div>

          {expenses.length === 0 ? (
            <div className="p-10 sm:p-12 text-center text-sm text-muted-foreground">
              Nenhum gasto ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {expenses.slice(0, 30).map((e) => (
                <li
                  key={e.id}
                  className="px-4 sm:px-6 py-3.5 sm:py-4 flex items-center gap-3 sm:gap-4 group transition-colors hover:bg-muted/40"
                >
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
                        <Hand
                          className="size-3 text-muted-foreground shrink-0"
                          aria-label="Manual"
                        />
                      )}
                    </div>
                    {(e.description || e.raw_transcript) && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {e.description || e.raw_transcript}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-semibold tabular-nums text-sm sm:text-base">
                      {formatBRL(Number(e.amount))}
                    </p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                      {format(parseISO(e.expense_date), "dd MMM", { locale: ptBR })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteExp(e.id)}
                    className="inline-flex items-center justify-center size-11 sm:size-9 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
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
