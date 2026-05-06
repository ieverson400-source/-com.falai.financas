import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatBRL } from "@/lib/categories";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  PiggyBank,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/mobile/")({
  component: MobileHome,
});

interface Expense {
  id: string;
  amount: number;
  category: string;
  expense_date: string;
}

const placeholderAccounts = [
  { id: "cc", name: "Conta Corrente", bank: "Banco principal", balance: 0, icon: Building2 },
  { id: "pp", name: "Poupança", bank: "Reserva", balance: 0, icon: PiggyBank },
];

function MobileHome() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("expenses")
      .select("id, amount, category, expense_date")
      .order("expense_date", { ascending: false })
      .limit(50)
      .then(({ data }) => setExpenses((data ?? []) as Expense[]));
  }, [user]);

  const monthStart = startOfMonth(new Date());
  const monthExpenses = expenses.filter((e) => parseISO(e.expense_date) >= monthStart);
  const totalMonth = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalAccounts = placeholderAccounts.reduce((s, a) => s + a.balance, 0);
  const saldoGeral = totalAccounts - totalMonth;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Olá,</p>
          <h1 className="font-display text-lg font-semibold truncate">
            {user?.email?.split("@")[0] ?? "bem-vindo"}
          </h1>
        </div>
        <ThemeToggle />
      </header>

      {/* Saldo geral */}
      <Card className="relative overflow-hidden border-0 bg-gradient-hero text-primary-foreground p-5 shadow-elevated">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider opacity-80">Saldo geral</p>
          <Sparkles className="size-4 opacity-80" />
        </div>
        <p className="font-display text-3xl font-bold mt-2 break-words tabular-nums">
          {formatBRL(saldoGeral)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-white/10 backdrop-blur-sm p-3">
            <div className="flex items-center gap-1.5 opacity-90">
              <ArrowDownLeft className="size-3.5" /> Entradas
            </div>
            <p className="font-display text-base font-semibold mt-1 tabular-nums">
              {formatBRL(0)}
            </p>
          </div>
          <div className="rounded-lg bg-white/10 backdrop-blur-sm p-3">
            <div className="flex items-center gap-1.5 opacity-90">
              <ArrowUpRight className="size-3.5" /> Saídas
            </div>
            <p className="font-display text-base font-semibold mt-1 tabular-nums">
              {formatBRL(totalMonth)}
            </p>
          </div>
        </div>
      </Card>

      {/* Conexão bancária */}
      <Card className="p-4 shadow-soft border-dashed border-2 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Link2 className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-semibold text-sm">Conexão bancária</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conecte sua conta para sincronizar saldo e transações automaticamente.
            </p>
            <Link to="/mobile/conectar" className="inline-block mt-3">
              <Button size="sm" className="h-10 px-4">
                Começar agora
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Minhas contas */}
      <section>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <h2 className="font-display font-semibold text-sm">Minhas contas</h2>
          <Link
            to="/mobile/contas"
            className="text-xs text-primary font-medium min-h-[44px] inline-flex items-center px-2 -mx-2"
          >
            Ver todas
          </Link>
        </div>
        <ul className="space-y-2">
          {placeholderAccounts.map(({ id, name, bank, balance, icon: Icon }) => (
            <li key={id}>
              <Card className="p-3.5 shadow-soft flex items-center gap-3 transition-shadow hover:shadow-elevated">
                <div className="size-10 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{bank}</p>
                </div>
                <p className="font-display font-semibold text-sm tabular-nums shrink-0">
                  {formatBRL(balance)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* Fluxo de caixa */}
      <section>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <h2 className="font-display font-semibold text-sm">Fluxo de caixa</h2>
          <span className="text-[11px] text-muted-foreground">
            {format(monthStart, "MMMM", { locale: ptBR })}
          </span>
        </div>
        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
              <TrendingUp className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Resultado do mês</p>
              <p className="font-display text-lg font-semibold tabular-nums">
                {formatBRL(-totalMonth)}
              </p>
            </div>
          </div>
          {/* Mini barras */}
          <div className="mt-4 flex items-end gap-1.5 h-20">
            {Array.from({ length: 14 }).map((_, i) => {
              const h = 20 + ((i * 37) % 70);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/15"
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>14 dias atrás</span>
            <span>hoje</span>
          </div>
        </Card>
      </section>

      <Link to="/app" className="block">
        <Button variant="outline" className="w-full h-11 gap-2">
          <Plus className="size-4" /> Painel completo (registrar gasto por áudio)
        </Button>
      </Link>
    </div>
  );
}

import { Link2 } from "lucide-react";
