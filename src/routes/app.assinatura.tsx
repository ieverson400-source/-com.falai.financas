import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Crown,
  CreditCard,
  Sparkles,
  Star,
  User as UserIcon,
  Users,
  XCircle,
  Check,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PLANS, formatPlanPrice } from "@/lib/subscriptions/plans";
import type { SubscriptionState } from "@/lib/subscriptions/provider";
import { SUBSCRIPTION_STATES, setSubscriptionSimState, useSubscriptionSimState } from "@/lib/subscriptions/session-state";
import { getSubscriptionFlags } from "@/lib/subscriptions/flags.functions";
import { getSubscription } from "@/lib/subscriptions/get-subscription.functions";
import { restorePurchases } from "@/lib/subscriptions/restore-purchases.functions";

// Esta tela NÃO faz cobrança nem chama Google Play, RevenueCat ou Stripe. Os botões de compra ficam
// desabilitados ("Em breve") até a integração ser aprovada. O plano exibido é uma SIMULAÇÃO local
// (ver lib/subscriptions/session-state): em produção é sempre "free".

export const Route = createFileRoute("/app/assinatura")({
  // Feature flag lida no servidor: com SUBS_ENABLED diferente de "true" a rota redireciona para /app.
  beforeLoad: async () => {
    let enabled = false;
    try {
      enabled = (await getSubscriptionFlags()).enabled;
    } catch {
      enabled = false;
    }
    if (!enabled) throw redirect({ to: "/app" });
  },
  component: SubscriptionPage,
  head: () => ({
    meta: [{ title: "Assinatura — Falaí Finanças e Gastos" }],
  }),
});

// TODO: derivar do servidor quando houver SDK/provedor aprovado. Hoje a compra é sempre indisponível.
const PURCHASE_AVAILABLE = false;

const STATE_VIEW: Record<SubscriptionState, { icon: LucideIcon; title: string; text: string; tone: string }> = {
  free: { icon: UserIcon, title: "Plano gratuito", text: "Você está no plano gratuito.", tone: "text-muted-foreground" },
  pro: { icon: Star, title: "Plano Pro", text: "Sua assinatura Pro está ativa.", tone: "text-emerald-500" },
  premium: { icon: Crown, title: "Plano Premium", text: "Sua assinatura Premium está ativa.", tone: "text-emerald-500" },
  familia: { icon: Users, title: "Plano Família", text: "Sua assinatura Família está ativa.", tone: "text-emerald-500" },
  expired: { icon: AlertTriangle, title: "Assinatura expirada", text: "Sua assinatura expirou.", tone: "text-amber-500" },
  pending: { icon: Clock, title: "Pagamento em processamento", text: "Pagamento em processamento.", tone: "text-amber-500" },
  error: { icon: XCircle, title: "Não foi possível verificar", text: "Não foi possível verificar sua assinatura agora.", tone: "text-destructive" },
};

function SoonButton({ children, variant }: { children: React.ReactNode; variant?: "default" | "outline" }) {
  // Botão desabilitado com tooltip "Em breve". O <span> permite o tooltip em botão desabilitado.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={PURCHASE_AVAILABLE ? -1 : 0} className="block">
          <Button className="w-full" variant={variant} disabled={!PURCHASE_AVAILABLE}>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      {!PURCHASE_AVAILABLE && <TooltipContent>Em breve</TooltipContent>}
    </Tooltip>
  );
}

function SubscriptionPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const state = useSubscriptionSimState();
  const [checking, setChecking] = useState(false);
  const view = STATE_VIEW[state];
  const Icon = view.icon;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  async function onCheckStatus() {
    setChecking(true);
    try {
      await getSubscription(); // stub: não consulta nenhum provedor
      toast.info("Verificação disponível em breve");
    } catch {
      toast.error("Não foi possível verificar agora.");
    } finally {
      setChecking(false);
    }
  }

  async function onRestore() {
    try {
      const r = await restorePurchases(); // stub
      if (r.status === "not_configured") toast.info("Em breve");
    } catch {
      toast.error("Não foi possível restaurar agora.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar para o início">
            <Link to="/app">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h1 className="font-display text-lg font-semibold">Assinatura</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-28">
        <TooltipProvider>
          {/* a) Estado atual */}
          <Card className="flex flex-wrap items-center gap-4 p-5" aria-live="polite">
            <Icon className={`size-7 shrink-0 ${view.tone}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{view.title}</p>
              <p className="text-sm text-muted-foreground">{view.text}</p>
            </div>
            {state === "pending" && (
              <Button variant="outline" size="sm" onClick={onCheckStatus} disabled={checking}>
                Verificar status
              </Button>
            )}
            {state === "expired" && (
              <div className="w-28">
                <SoonButton>Renovar</SoonButton>
              </div>
            )}
          </Card>

          {/* b) Planos */}
          <section aria-label="Planos" className="grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const current = state === plan.key;
              return (
                <Card
                  key={plan.id}
                  className={`flex flex-col gap-4 p-5 ${current ? "border-primary ring-2 ring-primary" : ""}`}
                  data-plan-id={plan.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-semibold">{plan.name}</h2>
                    {current && <Badge>Plano atual</Badge>}
                  </div>
                  <p className="font-display text-3xl font-semibold">
                    {formatPlanPrice(plan.priceCents)}
                    <span className="text-sm font-normal text-muted-foreground"> /mês</span>
                  </p>
                  <ul className="flex-1 space-y-2 text-sm">
                    {plan.benefits.map((b) => (
                      <li key={b} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <SoonButton variant={current ? "outline" : "default"}>
                    {current ? "Gerenciar assinatura" : "Assinar"}
                  </SoonButton>
                </Card>
              );
            })}
          </section>
        </TooltipProvider>

        {/* c) Rodapé */}
        <footer className="space-y-3 text-center text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button variant="link" className="h-auto p-0 text-xs" onClick={onRestore}>
              Restaurar compras
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="link" className="h-auto p-0 text-xs">
                  Termos da assinatura
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Termos da assinatura</DialogTitle>
                  <DialogDescription>
                    {/* TODO: revisar texto jurídico */}
                    Os termos completos da assinatura serão publicados antes da liberação desta função.
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          </div>
          {/* TODO: revisar texto jurídico */}
          <p className="flex items-center justify-center gap-1.5">
            <CreditCard className="size-3.5" />
            Assinaturas renovam automaticamente. Cancele quando quiser na Google Play Store.
          </p>
        </footer>

        {import.meta.env.DEV && (
          <Card className="space-y-2 border-dashed p-4">
            <p className="text-xs text-muted-foreground">Pré-visualização dos estados (somente em desenvolvimento)</p>
            <div className="flex flex-wrap gap-2">
              {SUBSCRIPTION_STATES.map((k) => (
                <Button key={k} size="sm" variant={k === state ? "default" : "outline"} onClick={() => setSubscriptionSimState(k)}>
                  {k}
                </Button>
              ))}
            </div>
          </Card>
        )}
      </main>

      <Toaster richColors />
      <BottomNav current="perfil" />
    </div>
  );
}
