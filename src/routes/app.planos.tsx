import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { StripeEmbeddedCheckout } from "@/components/stripe-embedded-checkout";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Users, ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/planos")({
  component: PlanosPage,
  head: () => ({
    meta: [
      { title: "Planos — Falaí Finanças" },
      { name: "description", content: "Escolha o plano ideal do Falaí Finanças: Pro, Premium ou Família. Assine em segundos e desbloqueie recursos avançados." },
      { property: "og:title", content: "Planos — Falaí Finanças" },
      { property: "og:description", content: "Escolha o plano ideal do Falaí Finanças e assine em segundos." },
    ],
  }),
});

type PlanId = "pro" | "premium" | "familia";

interface PlanDef {
  id: PlanId;
  priceId: string;
  name: string;
  price: string;
  tagline: string;
  icon: typeof Crown;
  highlight?: boolean;
  features: string[];
}

const PLANS: PlanDef[] = [
  {
    id: "pro",
    priceId: "pro_monthly",
    name: "Pro",
    price: "R$ 19,90",
    tagline: "Para quem quer controle real dos gastos",
    icon: Sparkles,
    features: [
      "Registro por voz, foto e texto ilimitado",
      "Relatórios avançados com IA",
      "Categorização automática",
      "Metas e orçamentos por categoria",
      "Suporte prioritário",
    ],
  },
  {
    id: "premium",
    priceId: "premium_monthly",
    name: "Premium",
    price: "R$ 39,90",
    tagline: "Tudo do Pro + integração bancária",
    icon: Crown,
    highlight: true,
    features: [
      "Tudo do plano Pro",
      "Sincronização bancária automática (Open Finance)",
      "WhatsApp bot com IA avançada",
      "Recarga de celular pelo app",
      "Insights preditivos de gastos",
      "Exportação para Excel/PDF",
    ],
  },
  {
    id: "familia",
    priceId: "familia_monthly",
    name: "Família",
    price: "R$ 59,90",
    tagline: "Tudo do Premium para até 5 pessoas",
    icon: Users,
    features: [
      "Tudo do plano Premium",
      "Até 5 pessoas na mesma conta",
      "Painel consolidado da família",
      "Metas compartilhadas",
      "Controle de gastos por membro",
    ],
  },
];

function PlanosPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { plan: currentPlan, isActive, loading: subLoading } = useSubscription(user?.id);
  const [checkoutPrice, setCheckoutPrice] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const portalFn = useServerFn(createPortalSession);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
    }
  }, [authLoading, user, navigate]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const result = await portalFn({
        data: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/app/planos`,
        },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir portal");
    } finally {
      setPortalLoading(false);
    }
  };

  if (authLoading || subLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (checkoutPrice) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <div className="mx-auto max-w-3xl px-4 py-6">
          <Button variant="ghost" onClick={() => setCheckoutPrice(null)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para planos
          </Button>
          <Card className="p-4">
            <StripeEmbeddedCheckout priceId={checkoutPrice} />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/app">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
          </Link>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Escolha seu plano</h1>
          <p className="mt-3 text-muted-foreground">
            Assine em segundos. Cancele quando quiser.
          </p>
          {isActive && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Badge variant="secondary">
                Seu plano atual: <span className="ml-1 font-semibold uppercase">{currentPlan}</span>
              </Badge>
              <Button size="sm" variant="outline" onClick={openPortal} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ExternalLink className="h-3 w-3 mr-1" />}
                Gerenciar assinatura
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => {
            const Icon = p.icon;
            const isCurrent = isActive && currentPlan === p.id;
            return (
              <Card
                key={p.id}
                className={`relative p-6 flex flex-col ${p.highlight ? "border-primary shadow-lg" : ""}`}
              >
                {p.highlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Mais popular</Badge>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="text-2xl font-bold">{p.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{p.tagline}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <ul className="space-y-3 mb-6 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={p.highlight ? "default" : "outline"}
                  disabled={isCurrent}
                  onClick={() => setCheckoutPrice(p.priceId)}
                >
                  {isCurrent ? "Plano atual" : "Assinar"}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Pagamento seguro processado pelo Stripe. Você pode cancelar a qualquer momento.
        </p>
      </div>
    </div>
  );
}
