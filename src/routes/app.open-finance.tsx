import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Landmark,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { OpenFinanceConnectionStatus } from "@/lib/openfinance/provider";
import { setOpenFinanceSimState, useOpenFinanceSimState } from "@/lib/openfinance/session-state";
import { getOpenFinanceFlags } from "@/lib/openfinance/flags.functions";
import { startOpenFinanceConsent } from "@/lib/openfinance/start-consent.functions";

// Esta tela NÃO chama a Celcoin nem exibe dado bancário. O botão "Conectar banco" fica desabilitado
// até a integração existir. O estado exibido é uma SIMULAÇÃO local (ver lib/openfinance/session-state).

export const Route = createFileRoute("/app/open-finance")({
  // Feature flag lida no servidor: com OF_ENABLED diferente de "true" a rota redireciona para /app.
  beforeLoad: async () => {
    let enabled = false;
    try {
      enabled = (await getOpenFinanceFlags()).enabled;
    } catch {
      enabled = false;
    }
    if (!enabled) throw redirect({ to: "/app" });
  },
  component: OpenFinancePage,
  head: () => ({
    meta: [{ title: "Conectar sua conta bancária — Falaí Finanças e Gastos" }],
  }),
});

// TODO: derivar do servidor quando a integração for aprovada (Etapa 3). Hoje é sempre indisponível.
const CONSENT_AVAILABLE = false;

const STATUS: Record<OpenFinanceConnectionStatus, { icon: LucideIcon; title: string; text: string; tone: string }> = {
  disconnected: {
    icon: Landmark,
    title: "Nenhum banco conectado",
    text: "Quando a conexão estiver disponível, você poderá conectar o seu banco por aqui.",
    tone: "text-muted-foreground",
  },
  pending: {
    icon: Clock,
    title: "Aguardando autorização",
    text: "Conclua a autorização no ambiente do seu banco para continuar.",
    tone: "text-amber-500",
  },
  connected: {
    icon: CheckCircle2,
    title: "Banco conectado",
    text: "Sua conta está conectada. Você pode desconectar quando quiser.",
    tone: "text-emerald-500",
  },
  expired: {
    icon: AlertTriangle,
    title: "Consentimento expirado",
    text: "A autorização venceu. Será preciso conectar novamente.",
    tone: "text-amber-500",
  },
  error: {
    icon: XCircle,
    title: "Falha na conexão",
    text: "Não foi possível concluir a conexão. Tente novamente mais tarde.",
    tone: "text-destructive",
  },
};

const STATE_ORDER: OpenFinanceConnectionStatus[] = ["disconnected", "pending", "connected", "expired", "error"];

function OpenFinancePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const state = useOpenFinanceSimState();
  const [busy, setBusy] = useState(false);
  const s = STATUS[state];
  const Icon = s.icon;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  async function onConnect() {
    if (!CONSENT_AVAILABLE || busy) return;
    setBusy(true);
    try {
      const result = await startOpenFinanceConsent();
      if (result.status === "not_configured") toast.info("Em breve");
    } catch {
      toast.error("Não foi possível iniciar a conexão agora.");
    } finally {
      setBusy(false);
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
            <Landmark className="size-5 text-primary" />
            <h1 className="font-display text-lg font-semibold">Conectar sua conta bancária</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4 py-6 pb-28">
        <Card className="space-y-3 p-5 text-sm">
          <ul className="space-y-2">
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Open Finance é o sistema do Banco Central que permite compartilhar seus dados bancários com outros
                serviços, somente com a sua autorização.
              </span>
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>O Falaí só lê dados. Nunca move dinheiro.</span>
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Você pode desconectar quando quiser.</span>
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Os dados são usados para facilitar recargas e nada além disso.</span>
            </li>
          </ul>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="link" className="h-auto p-0 text-sm">
                Como funciona?
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Como funciona</DialogTitle>
                <DialogDescription>
                  Você escolhe o seu banco, autoriza o compartilhamento no ambiente do próprio banco e volta ao
                  Falaí. Você decide o que compartilhar e pode desconectar quando quiser.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Aviso de privacidade (LGPD):</strong> ao criar o consentimento,
                  será solicitado o seu CPF ou CNPJ, conforme exigência da Celcoin. Esse dado é usado somente para
                  esta finalidade.
                </p>
                <p>Esta função ainda não está disponível. Os detalhes do fluxo podem mudar até a liberação.</p>
              </div>
            </DialogContent>
          </Dialog>
        </Card>

        <Card className="flex items-start gap-3 p-5" aria-live="polite">
          <Icon className={`mt-0.5 size-6 shrink-0 ${s.tone}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.text}</p>
          </div>
        </Card>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={CONSENT_AVAILABLE ? -1 : 0} className="block">
                <Button className="w-full" disabled={!CONSENT_AVAILABLE || busy} onClick={onConnect}>
                  Conectar banco
                </Button>
              </span>
            </TooltipTrigger>
            {!CONSENT_AVAILABLE && <TooltipContent>Em breve</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
        {!CONSENT_AVAILABLE && <p className="text-center text-xs text-muted-foreground">Em breve.</p>}

        {import.meta.env.DEV && (
          <Card className="space-y-2 border-dashed p-4">
            <p className="text-xs text-muted-foreground">Pré-visualização dos estados (somente em desenvolvimento)</p>
            <div className="flex flex-wrap gap-2">
              {STATE_ORDER.map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={k === state ? "default" : "outline"}
                  onClick={() => setOpenFinanceSimState(k)}
                >
                  {k}
                </Button>
              ))}
            </div>
          </Card>
        )}
      </main>

      <Toaster richColors />
      <BottomNav current="inicio" />
    </div>
  );
}
