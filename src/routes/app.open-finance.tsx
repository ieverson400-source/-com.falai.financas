import { createFileRoute, Link, useNavigate, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { listMyBanks, startBankConnection, syncMyBank, disconnectMyBank } from "@/lib/pluggy.functions";
const PluggyWidget = lazy(() => import("@/components/pluggy-connect-widget"));

// Esta tela NÃO chama a Celcoin nem exibe dado bancário. O botão "Conectar banco" fica desabilitado
// até a integração existir. O estado exibido é uma SIMULAÇÃO local (ver lib/openfinance/session-state).

export const Route = createFileRoute("/app/open-finance")({
  // Feature flag lida no servidor: com OF_ENABLED diferente de "true" a rota redireciona para /app.
  component: OpenFinancePage,
  head: () => ({
    meta: [{ title: "Bancos conectados — Falaí Finanças" }, { name: "description", content: "Gerencie suas conexões bancárias pessoais com Pluggy no Falaí Finanças." }, { property: "og:title", content: "Bancos conectados — Falaí Finanças" }, { property: "og:description", content: "Suas contas bancárias, com autorização individual e leitura segura." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }],
  }),
});

// TODO: derivar do servidor quando a integração for aprovada (Etapa 3). Hoje é sempre indisponível.
const CONSENT_AVAILABLE = true;

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
  const list = useServerFn(listMyBanks);
  const start = useServerFn(startBankConnection);
  const sync = useServerFn(syncMyBank);
  const disconnect = useServerFn(disconnectMyBank);
  const [banks, setBanks] = useState<Awaited<ReturnType<typeof listMyBanks>> | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [updateItem, setUpdateItem] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const state: OpenFinanceConnectionStatus = banks?.items.length ? "connected" : "disconnected";
  const [busy, setBusy] = useState(false);
  const s = STATUS[state];
  const Icon = s.icon;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);
  const refresh = useCallback(async () => {
    try { setBanks(await list()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Falha ao carregar bancos."); }
  }, [list]);
  useEffect(() => { if (user) void refresh(); }, [user, refresh]);

  async function onConnect(itemId?: string) {
    if (!CONSENT_AVAILABLE || busy) return;
    setBusy(true);
    try {
      const result = await start({ data: { itemId } });
      if ("error" in result) throw new Error(result.error);
      setUpdateItem(itemId); setToken(result.accessToken);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão agora.");
    } finally {
      setBusy(false);
    }
  }
  async function update(itemId: string) {
    setBusy(true);
    try { const result = await sync({ data: { itemId } }); if ("error" in result) throw new Error(result.error); await refresh(); toast.success("Dados bancários atualizados."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao atualizar."); }
    finally { setBusy(false); }
  }
  async function remove(itemId: string) {
    if (!window.confirm("Desconectar este banco e remover os dados bancários salvos?")) return;
    setBusy(true);
    try { const result = await disconnect({ data: { itemId } }); if ("error" in result) throw new Error(result.error); await refresh(); toast.success("Banco desconectado."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao desconectar."); }
    finally { setBusy(false); }
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
              <span>Conexão de leitura pela Pluggy, com sua autorização.</span>
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
                  poderá ser solicitado o seu CPF ou CNPJ no ambiente da Pluggy ou do banco. Esse dado é usado somente para
                  esta finalidade.
                </p>
                <p>As senhas bancárias não são salvas pelo Falaí. O compartilhamento depende da autorização do titular.</p>
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
                <Button className="w-full" disabled={!user || busy} onClick={() => onConnect()}>
                  Conectar banco
                </Button>
              </span>
            </TooltipTrigger>
            {!CONSENT_AVAILABLE && <TooltipContent>Em breve</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
        {!CONSENT_AVAILABLE && <p className="text-center text-xs text-muted-foreground">Em breve.</p>}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {banks?.items.map((item) => <section key={item.id} className="space-y-3 border-t border-border pt-4"><div><h2 className="font-semibold">{item.institution_name ?? "Banco conectado"}</h2><p className="text-xs text-muted-foreground">{item.status} · {item.last_synced_at ? new Date(item.last_synced_at).toLocaleString("pt-BR") : "Aguardando atualização"}</p></div>{banks.accounts.filter((a) => a.item_id === item.id).map((a) => <div key={a.id} className="flex justify-between gap-3 text-sm"><span>{a.name}</span><span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: a.currency_code ?? "BRL" }).format(Number(a.balance ?? 0))}</span></div>)}<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => update(item.pluggy_item_id)}>Atualizar dados</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => onConnect(item.pluggy_item_id)}>Renovar autorização</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(item.pluggy_item_id)}>Desconectar</Button></div></section>)}
        {token && <ClientOnly><Suspense fallback={<p>Carregando Pluggy…</p>}><PluggyWidget token={token} itemId={updateItem} onSuccess={(id) => { setToken(null); void update(id); }} onClose={() => setToken(null)} onError={() => { setToken(null); toast.error("Não foi possível concluir a autorização bancária."); }} /></Suspense></ClientOnly>}
      </main>

      <Toaster richColors />
      <BottomNav current="inicio" />
    </div>
  );
}
