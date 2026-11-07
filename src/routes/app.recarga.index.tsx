import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Info, Landmark, Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { normalizeBrPhone } from "@/lib/recharge/rules";
import { useOpenFinanceSimState } from "@/lib/openfinance/session-state";
import { getOpenFinanceFlags } from "@/lib/openfinance/flags.functions";
import { createRecharge, getRechargeAvailability } from "@/lib/recharge/create-recharge.functions";

// Esta tela NÃO faz nenhuma chamada à Celcoin. O botão "Recarregar" só é habilitado quando o servidor
// informar que a recarga está configurada (hoje é sempre falso). O histórico lê a tabela `recargas`
// já existente, protegida por RLS (cada usuário vê só as próprias linhas).

export const Route = createFileRoute("/app/recarga/")({
  component: RechargePage,
  loader: async () => {
    const [flags, availability] = await Promise.all([
      getOpenFinanceFlags().catch(() => ({ enabled: false })),
      getRechargeAvailability().catch(() => ({ configured: false })),
    ]);
    return { ofEnabled: flags.enabled, rechargeConfigured: availability.configured };
  },
  head: () => ({
    meta: [{ title: "Recarregar — Falaí Finanças e Gastos" }],
  }),
});

// TODO: a lista real de operadoras virá do provedor quando a integração for aprovada.
// Sem integração, não exibimos operadoras fictícias.
const OPERATORS: { id: string; name: string }[] = [];

type HistoryRow = { id: string; operadora: string; telefone: string; valor: number; status: string; created_at: string };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCents = (cents: number) => brl.format(cents / 100);
const maskPhone = (value: string) => {
  const d = value.replace(/\D/g, "");
  return d.length >= 4 ? `•••• ${d.slice(-4)}` : "••••";
};

function OpenFinanceCard() {
  const state = useOpenFinanceSimState(); // simulação até a Etapa 3 (em produção: sempre "disconnected")
  const connected = state === "connected";
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15">
        <Landmark className="size-5 text-primary" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{connected ? "Banco conectado" : "Open Finance"}</p>
        {!connected && <p className="text-muted-foreground">Facilite suas recargas conectando sua conta bancária.</p>}
      </div>
      {connected ? (
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/open-finance">Gerenciar</Link>
        </Button>
      ) : (
        <Button size="sm" asChild>
          <Link to="/app/open-finance">Conectar banco para facilitar recargas</Link>
        </Button>
      )}
    </Card>
  );
}

function RechargePage() {
  const { ofEnabled, rechargeConfigured } = Route.useLoaderData();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [digits, setDigits] = useState("");
  const [operator, setOperator] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from("recargas")
      .select("id, operadora, telefone, valor, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        // Se a tabela não existir mais ou a consulta falhar, mostramos o estado vazio.
        if (alive) setHistory(error ? [] : ((data as HistoryRow[] | null) ?? []));
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const amountCents = digits ? Number(digits) : 0;
  const phoneValid = normalizeBrPhone(phone) !== null;
  const formValid = amountCents > 0 && operator !== "" && phoneValid;
  const canSubmit = formValid && rechargeConfigured && !submitting;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await createRecharge({ data: { amountCents, operatorId: operator, phone } });
      if (result.status === "not_configured") toast.info("Em breve");
    } catch {
      toast.error("Não foi possível solicitar a recarga agora.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar para o início">
            <Link to="/app">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Smartphone className="size-5 text-primary" />
            <h1 className="font-display text-lg font-semibold">Recarregar</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4 py-6 pb-28">
        {ofEnabled && <OpenFinanceCard />}

        <Card className="p-5">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor</Label>
              <Input
                id="valor"
                inputMode="numeric"
                autoComplete="off"
                placeholder="R$ 0,00"
                value={digits ? formatCents(amountCents) : ""}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 7).replace(/^0+/, ""))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="operadora">Operadora</Label>
              <Select value={operator} onValueChange={setOperator} disabled={OPERATORS.length === 0}>
                <SelectTrigger id="operadora">
                  <SelectValue placeholder={OPERATORS.length === 0 ? "Disponível em breve" : "Selecione a operadora"} />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value.slice(0, 20))}
                aria-invalid={phone !== "" && !phoneValid}
              />
              {phone !== "" && !phoneValid && (
                <p className="text-xs text-destructive">Informe um telefone com DDD válido.</p>
              )}
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={rechargeConfigured ? -1 : 0} className="block">
                    <Button type="submit" className="w-full" disabled={!canSubmit}>
                      Recarregar
                    </Button>
                  </span>
                </TooltipTrigger>
                {!rechargeConfigured && <TooltipContent>Em breve</TooltipContent>}
              </Tooltip>
            </TooltipProvider>

            {!rechargeConfigured && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Recargas ainda não estão disponíveis. Em breve.
              </p>
            )}
          </form>
        </Card>

        <section aria-labelledby="historico">
          <h2 id="historico" className="mb-3 font-display text-base font-semibold">
            Histórico
          </h2>
          {history === null ? (
            <Card className="p-4 text-sm text-muted-foreground">Carregando…</Card>
          ) : history.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">Nenhuma recarga ainda</Card>
          ) : (
            <ul className="space-y-2">
              {history.map((r) => (
                <li key={r.id}>
                  <Card className="flex items-center justify-between gap-3 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.operadora}</p>
                      <p className="text-xs text-muted-foreground">
                        {maskPhone(r.telefone)} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">{brl.format(Number(r.valor))}</p>
                      <Badge variant="secondary" className="rounded-full text-[11px]">
                        {r.status}
                      </Badge>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Toaster richColors />
      <BottomNav current="inicio" />
    </div>
  );
}
