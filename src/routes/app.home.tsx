import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { formatBRL } from "@/lib/categories";
import { ImportSpreadsheetButton } from "@/components/import-spreadsheet-button";
import {
  Home,
  Wallet,
  ArrowLeftRight,
  Link2,
  User,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ChevronRight,
  Building2,
  PiggyBank,
  CreditCard,
  LogOut,
} from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app/home")({
  component: HomeMobile,
  head: () => ({
    meta: [
      { title: "Início — Falaí Finanças" },
      { name: "description", content: "Visão geral das suas finanças no Falaí: saldo, contas, entradas, saídas e fluxo de caixa do mês em um painel mobile." },
      { property: "og:title", content: "Início — Falaí Finanças" },
      { property: "og:description", content: "Acompanhe saldo, contas e fluxo de caixa do mês em um painel mobile rápido." },
    ],
  }),
});

type TabKey = "inicio" | "contas" | "transacoes" | "conectar" | "perfil";

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  expense_date: string;
  created_at: string;
}

const sampleAccounts = [
  { id: "cc", name: "Conta Corrente", bank: "Banco Principal", balance: 0, icon: Building2 },
  { id: "pp", name: "Poupança", bank: "Reserva", balance: 0, icon: PiggyBank },
  { id: "cd", name: "Cartão de Crédito", bank: "Fatura aberta", balance: 0, icon: CreditCard },
];

function HomeMobile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("inicio");
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("expenses")
      .select("id, amount, category, description, expense_date, created_at")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => setExpenses((data ?? []) as Expense[]));
  }, [user]);

  const { totalMonth, entradasMes, saidasMes, saldoGeral } = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const m = expenses.filter((e) => parseISO(e.expense_date) >= monthStart);
    const saidas = m.reduce((s, e) => s + Number(e.amount), 0);
    return {
      totalMonth: saidas,
      entradasMes: 0,
      saidasMes: saidas,
      saldoGeral: 0 - saidas,
    };
  }, [expenses]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Toaster richColors />

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Olá, bem-vindo
            </p>
            <p className="font-display font-semibold truncate text-sm">
              {user.email?.split("@")[0]}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link to="/app">
              <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
                Painel
              </Button>
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-5 pb-28">
        <h1 className="sr-only">Visão Geral de Finanças</h1>
        {tab === "inicio" && (
          <InicioTab
            saldoGeral={saldoGeral}
            entradas={entradasMes}
            saidas={saidasMes}
            totalMonth={totalMonth}
            expenses={expenses}
          />
        )}
        {tab === "contas" && <PlaceholderTab title="Contas" desc="Suas contas em um só lugar." />}
        {tab === "transacoes" && (
          <PlaceholderTab title="Transações" desc="Histórico completo das suas movimentações." />
        )}
        {tab === "conectar" && (
          <PlaceholderTab title="Conectar" desc="Conecte seus bancos e cartões." />
        )}
        {tab === "perfil" && <PlaceholderTab title="Perfil" desc="Suas preferências e conta." />}
      </main>

      {/* Bottom nav */}
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto max-w-md grid grid-cols-5">
          <BottomTab label="Início" icon={Home} active={tab === "inicio"} onClick={() => setTab("inicio")} />
          <BottomTab
            label="Contas"
            icon={Wallet}
            active={tab === "contas"}
            onClick={() => navigate({ to: "/app/bancos" })}
          />
          <BottomTab
            label="Transações"
            icon={ArrowLeftRight}
            active={tab === "transacoes"}
            onClick={() => setTab("transacoes")}
          />
          <BottomTab
            label="Conectar"
            icon={Link2}
            active={tab === "conectar"}
            onClick={() => navigate({ to: "/app/bancos" })}
          />
          <BottomTab label="Perfil" icon={User} active={tab === "perfil"} onClick={() => setTab("perfil")} />
        </ul>
      </nav>
    </div>
  );
}

function BottomTab({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`w-full min-h-[56px] flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors ${
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span
          className={`flex items-center justify-center size-9 rounded-xl transition-colors ${
            active ? "bg-primary/10" : ""
          }`}
        >
          <Icon className="size-[18px]" />
        </span>
        <span className="text-[10.5px] font-medium leading-none">{label}</span>
      </button>
    </li>
  );
}

function InicioTab({
  saldoGeral,
  entradas,
  saidas,
  totalMonth,
  expenses,
}: {
  saldoGeral: number;
  entradas: number;
  saidas: number;
  totalMonth: number;
  expenses: Expense[];
}) {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Saldo geral */}
      <Card className="relative overflow-hidden border-0 bg-gradient-hero text-primary-foreground shadow-elevated rounded-3xl">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider opacity-80">Saldo geral</p>
            <Sparkles className="size-4 opacity-80" />
          </div>
          <p className="font-display text-3xl font-bold mt-2 tabular-nums break-words">
            {formatBRL(saldoGeral)}
          </p>
          <p className="text-xs opacity-80 mt-1">Atualizado agora</p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/10 backdrop-blur px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] opacity-80">
                <ArrowDownRight className="size-3.5" />
                Entradas
              </div>
              <p className="font-display font-semibold mt-0.5 tabular-nums text-sm">
                {formatBRL(entradas)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] opacity-80">
                <ArrowUpRight className="size-3.5" />
                Saídas
              </div>
              <p className="font-display font-semibold mt-0.5 tabular-nums text-sm">
                {formatBRL(saidas)}
              </p>
            </div>
          </div>
        </div>
      </Card>
      {/* Incrementar Planilhas */}
      <ImportSpreadsheetButton />



      {/* Minhas contas */}
      <section aria-labelledby="minhas-contas">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <h2 id="minhas-contas" className="font-display font-semibold text-base">
            Minhas contas
          </h2>
          <button className="text-xs text-primary inline-flex items-center gap-0.5">
            Ver todas <ChevronRight className="size-3.5" />
          </button>
        </div>
        <Card className="rounded-2xl shadow-soft overflow-hidden">
          <ul className="divide-y divide-border">
            {sampleAccounts.map((a) => {
              const Icon = a.icon;
              return (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="size-10 rounded-xl bg-secondary flex items-center justify-center text-secondary-foreground">
                    <Icon className="size-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{a.bank}</p>
                  </div>
                  <p className="font-display font-semibold text-sm tabular-nums">
                    {formatBRL(a.balance)}
                  </p>
                </li>
              );
            })}
            <li className="px-4 py-3">
              <button className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors">
                <Plus className="size-4" />
                Adicionar conta
              </button>
            </li>
          </ul>
        </Card>
      </section>

      {/* Fluxo de caixa */}
      <section aria-labelledby="fluxo-caixa">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <h2 id="fluxo-caixa" className="font-display font-semibold text-base">
            Fluxo de caixa
          </h2>
          <span className="text-[11px] text-muted-foreground">Este mês</span>
        </div>
        <Card className="rounded-2xl shadow-soft p-4">
          <div className="grid grid-cols-2 gap-3">
            <FlowStat label="Entradas" value={entradas} positive />
            <FlowStat label="Saídas" value={saidas} />
          </div>
          <div className="mt-4">
            <MiniFlowChart expenses={expenses} />
          </div>
          {expenses.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Sem movimentações este mês.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              Total de {expenses.length} movimentações ({formatBRL(totalMonth)})
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}

function FlowStat({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <div
        className={`flex items-center gap-1.5 text-[11px] ${
          positive ? "text-success" : "text-destructive"
        }`}
      >
        {positive ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
        {label}
      </div>
      <p className="font-display font-semibold mt-0.5 tabular-nums text-sm">{formatBRL(value)}</p>
    </div>
  );
}

function MiniFlowChart({ expenses }: { expenses: Expense[] }) {
  // Last 7 days bars
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const data = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const total = expenses
      .filter((e) => e.expense_date === key)
      .reduce((s, e) => s + Number(e.amount), 0);
    return { day: format(d, "EEE", { locale: ptBR }).slice(0, 3), total };
  });
  const max = Math.max(1, ...data.map((d) => d.total));

  return (
    <div className="flex items-end justify-between gap-1.5 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
          <div className="w-full flex-1 flex items-end">
            <div
              className="w-full rounded-md bg-gradient-to-t from-primary/60 to-primary-glow/80 transition-all"
              style={{ height: `${Math.max(6, (d.total / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground capitalize">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

function PlaceholderTab({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="animate-in fade-in duration-300 pt-8">
      <Card className="rounded-2xl shadow-soft p-8 text-center">
        <div className="mx-auto size-12 rounded-2xl bg-secondary flex items-center justify-center mb-3">
          <Sparkles className="size-5 text-secondary-foreground" />
        </div>
        <h2 className="font-display font-semibold text-lg">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
        <p className="text-xs text-muted-foreground mt-4">Tela em construção.</p>
      </Card>
    </div>
  );
}
