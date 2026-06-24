import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import {
  activateDevSubscription,
  cancelDevSubscription,
} from "@/lib/subscription.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AudioRecorder } from "@/components/audio-recorder";
import { ExpenseCharts } from "@/components/expense-charts";
import { ManualExpenseDialog } from "@/components/manual-expense-dialog";
import { ReceiptScanner } from "@/components/receipt-scanner";
import { ImportSpreadsheetButton } from "@/components/import-spreadsheet-button";

import { WhatsAppLinkCard } from "@/components/whatsapp-link-card";

import { VerificacaoWhatsApp } from "@/components/verificacao-whatsapp";
import { WhatsAppDiagnosticsCard } from "@/components/whatsapp-diagnostics-card";
import { WhatsAppInboxCard, type WhatsAppInboxItem } from "@/components/whatsapp-inbox-card";
import { Toaster } from "@/components/ui/sonner";
import { ChatBot } from "@/components/chat-bot";
import { NotificationsButton } from "@/components/notifications-button";
import { ProfileEditDialog } from "@/components/profile-edit-dialog";
import { GoalHighlight } from "@/components/goal-highlight";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import { toast } from "sonner";
import { Trash2, Mic, Hand, Home, Wallet, MessageCircle, BarChart3, User as UserIcon, Building2, PiggyBank, CreditCard, ArrowUpRight, ArrowDownRight, Sparkles, Construction, Crown, Check, Zap, Star, Shield, Calendar as CalendarIcon, TrendingUp, Heart, Share2, Moon, Sun, LogOut, Loader2, AlertTriangle, ExternalLink, RotateCcw, Users, Gem } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/hooks/use-theme";
import { categoryColor, formatBRL } from "@/lib/categories";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";


export const Route = createFileRoute("/app/")({
  component: AppDashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Falaí Finanças" },
      { name: "description", content: "Painel das suas finanças no Falaí: gastos do mês, contas conectadas, fluxo de caixa e relatórios organizados por IA." },
      { property: "og:title", content: "Dashboard — Falaí Finanças" },
      { property: "og:description", content: "Acompanhe seus gastos, contas e fluxo de caixa em um único painel organizado por IA." },
      { property: "og:url", content: "https://falai-finan-as.lovable.app/app" },
    ],
    links: [
      { rel: "canonical", href: "https://falai-finan-as.lovable.app/app" },
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

type TabKey = "inicio" | "contas" | "chat" | "relatorios" | "perfil";

function AppDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [whatsAppPhone, setWhatsAppPhone] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [whatsAppInbox, setWhatsAppInbox] = useState<WhatsAppInboxItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("inicio");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    const [expensesRes, profileRes, inboxRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("whatsapp_phone, avatar_url").eq("user_id", user.id).maybeSingle(),
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
    const storedAvatar = profileRes.data?.avatar_url ?? user.user_metadata?.avatar_path ?? user.user_metadata?.avatar_url ?? null;
    setAvatarUrl(await resolveAvatarUrl(storedAvatar));
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

  const monthStart = startOfMonth(new Date());
  const monthExpenses = expenses.filter((e) => parseISO(e.expense_date) >= monthStart);
  const totalMonth = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />
      <ChatBot />

      <header className="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link to="/" aria-label="Voltar para a página inicial Falaí" className="flex items-center gap-2 min-w-0">
            <div className="size-9 rounded-xl bg-gradient-hero flex items-center justify-center shadow-soft">
              <Mic className="size-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="font-display font-semibold truncate">Falaí</span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationsButton userId={user.id} />
            <button
              onClick={() => setActiveTab("perfil")}
              aria-label="Abrir perfil do usuário"
              className="flex items-center gap-2 min-w-0 rounded-full hover:bg-muted/40 pl-2 pr-1 py-1 transition-colors"
            >
              <span className="text-sm font-medium truncate max-w-[140px] hidden sm:inline">
                {user.user_metadata?.display_name || user.email?.split("@")[0]}
              </span>
              <div className="size-8 rounded-full bg-gradient-hero flex items-center justify-center shadow-soft shrink-0 overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`Foto de perfil de ${user.user_metadata?.display_name || user.email?.split("@")[0] || "usuário"}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-semibold text-primary-foreground">
                    {(user.email?.[0] || "U").toUpperCase()}
                  </span>
                )}
              </div>
            </button>
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28 sm:pb-28 space-y-6 sm:space-y-8">
        <h1 className="sr-only">Painel de finanças: gastos do mês, contas e fluxo de caixa</h1>
        {activeTab === "inicio" && (
          <>
            {/* Saldo geral */}
            <Card className="p-5 sm:p-6 bg-gradient-hero text-primary-foreground border-0 shadow-elevated">
              <p className="text-[11px] uppercase tracking-wider opacity-80">Saldo geral</p>
              <p className="font-display text-3xl sm:text-4xl font-bold mt-1 break-words">
                {formatBRL(totalAll * 0 /* saldo geral demo */)}
              </p>
              <p className="text-xs opacity-80 mt-2">Atualizado agora</p>
            </Card>

            {/* Destaque de objetivo */}
            <GoalHighlight />

            {/* Conexão Bancária */}
            <Card className="p-5 sm:p-6 bg-card shadow-soft flex items-center gap-4">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display font-semibold">Conexão Bancária</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conecte sua conta para sincronizar automaticamente.
                </p>
              </div>
              <Button asChild size="sm" className="shrink-0">
                <Link to="/app/bancos">Começar agora</Link>
              </Button>
            </Card>

            {/* Importar planilhas */}
            <ImportSpreadsheetButton />

            {/* Top stats + recorder */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              <div className="lg:col-span-2 space-y-4 sm:space-y-5">
                <AudioRecorder onSuccess={load} />
                <ReceiptScanner onSuccess={load} userId={user.id} />
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
                <div className="col-span-2 lg:col-span-1 space-y-4">
                  <WhatsAppLinkCard currentPhone={whatsAppPhone} onSaved={(phone) => setWhatsAppPhone(phone)} />
                  <VerificacaoWhatsApp />
                  {isAdmin && <WhatsAppDiagnosticsCard currentPhone={whatsAppPhone} />}
                </div>
              </div>
            </div>

            {/* Minhas contas */}
            <Card className="bg-card shadow-soft overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-border">
                <h2 className="font-display text-base sm:text-lg font-semibold">Minhas contas</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Exemplos para referência</p>
              </div>
              <ul className="divide-y divide-border">
                {[
                  { icon: Building2, name: "Conta Corrente", value: 0 },
                  { icon: PiggyBank, name: "Poupança", value: 0 },
                  { icon: CreditCard, name: "Cartão de Crédito", value: 0 },
                ].map(({ icon: Icon, name, value }) => (
                  <li key={name} className="px-4 sm:px-6 py-4 flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">Demonstração</p>
                    </div>
                    <p className="font-display font-semibold tabular-nums text-sm">
                      {formatBRL(value)}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Recarga de celular */}
            <Link to="/app/recarga" className="block">
              <Card className="p-4 sm:p-5 bg-card shadow-soft hover:shadow-md transition-shadow flex items-center gap-4">
                <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Recarga de celular</p>
                  <p className="text-xs text-muted-foreground">Claro, Vivo, Tim e Oi — a partir de R$10</p>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </Card>
            </Link>

            {/* Fluxo de caixa */}
            <Card className="p-5 sm:p-6 bg-card shadow-soft">
              <h2 className="font-display text-base sm:text-lg font-semibold">Fluxo de caixa</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Resumo do mês</p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowUpRight className="size-3.5 text-emerald-500" /> Entradas
                  </div>
                  <p className="font-display text-xl font-semibold mt-1">{formatBRL(0)}</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowDownRight className="size-3.5 text-rose-500" /> Saídas
                  </div>
                  <p className="font-display text-xl font-semibold mt-1">{formatBRL(totalMonth)}</p>
                </div>
              </div>
            </Card>

            {/* Charts */}
            <ExpenseCharts expenses={monthExpenses} />

            <WhatsAppInboxCard items={whatsAppInbox} />

            {/* List */}
            <Card className="bg-card shadow-soft overflow-hidden">
              <div className="p-4 sm:p-6 flex items-center justify-between gap-3 border-b border-border">
                <div className="min-w-0">
                  <h2 className="font-display text-base sm:text-lg font-semibold">Gastos recentes</h2>
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
          </>
        )}

        {activeTab === "perfil" && (
          <ProfileTab user={user} avatarUrl={avatarUrl} onAvatarChange={setAvatarUrl} />
        )}

        {activeTab === "relatorios" && (
          <ReportsTab monthExpenses={monthExpenses} totalMonth={totalMonth} />
        )}

        {activeTab !== "inicio" && activeTab !== "perfil" && activeTab !== "relatorios" && (
          <Card className="p-10 sm:p-16 bg-card shadow-soft text-center">
            <div className="mx-auto size-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Construction className="size-6 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold capitalize">{activeTab}</h3>
            <p className="text-sm text-muted-foreground mt-1">Tela em construção</p>
          </Card>
        )}
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
        aria-label="Navegação principal"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-5">
          {(
            [
              { key: "inicio", label: "Início", icon: Home },
              { key: "contas", label: "Contas", icon: Wallet },
              { key: "chat", label: "Chat", icon: MessageCircle },
              { key: "relatorios", label: "Relatórios", icon: BarChart3 },
              { key: "perfil", label: "Perfil", icon: UserIcon },
            ] as { key: TabKey; label: string; icon: typeof Home }[]
          ).map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => {
                  if (key === "chat") {
                    window.dispatchEvent(new Event("falai:toggle-chat"));
                    return;
                  }
                  if (key === "contas") {
                    navigate({ to: "/app/bancos" });
                    return;
                  }
                  setActiveTab(key);
                }}
                aria-current={active ? "page" : undefined}
                className={`min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`size-5 ${active ? "scale-110" : ""} transition-transform`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

    </div>
  );
}

function ProfileTab({
  user,
  avatarUrl,
  onAvatarChange,
}: {
  user: { email?: string | null; id: string };
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
}) {
  const { plan, isActive, subscription, refresh } = useSubscription(user.id);
  const isSubscriber = isActive;
  const [activating, setActivating] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // 🛒 Play Store / Google Play Billing
  const PLAY_PACKAGE_NAME = "br.com.falaifinancas.app";
  const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE_NAME}`;

  const plans = [
    {
      key: "pro" as const,
      name: "Pro",
      price: "R$ 19,90",
      period: "/mês",
      tagline: "Para começar com tudo",
      icon: Zap,
      highlight: false,
      mostExpensive: false,
      playSku: "falai_pro_monthly",
      features: [
        "Gastos ilimitados por áudio",
        "Conexão bancária automática",
        "Relatórios avançados",
      ],
    },
    {
      key: "premium" as const,
      name: "Premium",
      price: "R$ 39,90",
      period: "/mês",
      tagline: "Para você levar a sério",
      icon: Crown,
      highlight: true,
      mostExpensive: false,
      playSku: "falai_premium_monthly",
      features: [
        "Tudo do Pro",
        "IA financeira personalizada",
        "Suporte prioritário 24/7",
      ],
    },
    {
      key: "familia" as const,
      name: "Família",
      price: "R$ 69,90",
      period: "/mês",
      tagline: "Para toda a família",
      icon: Gem,
      highlight: false,
      mostExpensive: true,
      playSku: "falai_familia_monthly",
      features: [
        "Tudo do Premium",
        "Múltiplas contas vinculadas",
        "Até 5 membros da família",
        "Painel familiar compartilhado",
        "Metas e orçamentos em grupo",
        "Atendimento dedicado VIP",
      ],
    },
  ];

  const activateDev = useServerFn(activateDevSubscription);
  const cancelDev = useServerFn(cancelDevSubscription);

  async function handleSubscribe(planKey: "pro" | "premium" | "familia", planName: string, sku: string) {
    if (typeof window === "undefined") return;

    const isTWA =
      document.referrer.startsWith("android-app://") ||
      window.matchMedia("(display-mode: standalone)").matches;

    const playSubscriptionUrl = `https://play.google.com/store/account/subscriptions?sku=${sku}&package=${PLAY_PACKAGE_NAME}`;

    // Sempre que estiver no app instalado / Android, abre direto o fluxo de pagamento da Play Store.
    if (isTWA || /android/i.test(navigator.userAgent)) {
      window.location.href = playSubscriptionUrl;
      return;
    }

    // Plano Família ainda não existe no provider de demo — direciona para Play Store.
    if (planKey === "familia") {
      window.open(playSubscriptionUrl, "_blank", "noopener,noreferrer");
      toast.info("Abrindo a Play Store para concluir a assinatura Família.");
      return;
    }

    try {
      setActivating(true);
      await activateDev({ data: { plan: planKey } });
      await refresh();
      toast.success(`Plano ${planName} ativado (modo demonstração)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ativar";
      toast.error(msg);
      window.open(PLAY_STORE_URL, "_blank", "noopener,noreferrer");
    } finally {
      setActivating(false);
    }
  }


  async function handleCancel() {
    try {
      await cancelDev({ data: undefined });
      await refresh();
      setConfirmCancel(false);
      toast.success("Assinatura cancelada. Você mantém o acesso até o fim do período pago.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao cancelar";
      toast.error(msg);
    }
  }

  const statusConfig = {
    active: { label: "Ativa", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" as const, icon: Check },
    in_grace_period: { label: "Período de carência", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" as const, icon: AlertTriangle },
    canceled: { label: "Cancelada", color: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20" as const, icon: AlertTriangle },
    expired: { label: "Expirada", color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20" as const, icon: AlertTriangle },
    on_hold: { label: "Em pausa", color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20" as const, icon: AlertTriangle },
    paused: { label: "Pausada", color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20" as const, icon: AlertTriangle },
    inactive: { label: "Inativa", color: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20" as const, icon: AlertTriangle },
  };



  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Profile header */}
      <Card className="p-5 sm:p-6 bg-card shadow-soft flex items-center gap-4">
        <div className="size-14 rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground font-display font-bold text-lg shrink-0 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            (user.email ?? "?").slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold truncate">
            {user.email?.split("@")[0]}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        {isSubscriber && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold shrink-0">
            <Crown className="size-3" /> {plan === "premium" ? "Premium" : "Pro"}
          </span>
        )}
      </Card>

      {/* Minha Assinatura */}
      <section aria-labelledby="assinantes">
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 id="assinantes" className="font-display text-xl font-semibold flex items-center gap-2">
              <Crown className="size-5 text-primary" /> Minha Assinatura
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isSubscriber
                ? "Aproveite todos os benefícios exclusivos do seu plano."
                : "Desbloqueie todo o potencial do Falaí Finanças."}
            </p>
          </div>
        </div>

        {isSubscriber ? (
          <Card className="overflow-hidden bg-card shadow-soft border-border">
            {/* Header com gradiente */}
            <div className="p-5 sm:p-6 bg-gradient-hero text-primary-foreground">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                  {plan === "premium" ? <Crown className="size-6" /> : <Zap className="size-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display text-lg font-semibold capitalize">Plano {plan}</p>
                    {(() => {
                      const cfg = statusConfig[(subscription?.status as keyof typeof statusConfig) ?? "inactive"];
                      const StatusIcon = cfg.icon;
                      return (
                        <Badge variant="outline" className={`${cfg.color} text-[11px] font-semibold border`}>
                          <StatusIcon className="size-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      );
                    })()}
                  </div>
                  <p className="text-xs opacity-80 mt-0.5">
                    {subscription?.current_period_end
                      ? `Renova em ${format(parseISO(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
                      : "Renovação automática mensal"}
                  </p>
                </div>
              </div>

              {/* Grid de detalhes */}
              <div className="grid grid-cols-2 gap-2 mt-5">
                <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] opacity-80">
                    <CalendarIcon className="size-3.5" /> Próxima cobrança
                  </div>
                  <p className="font-semibold mt-0.5 text-sm">
                    {subscription?.current_period_end
                      ? format(parseISO(subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] opacity-80">
                    <Shield className="size-3.5" /> Suporte
                  </div>
                  <p className="font-semibold mt-0.5 text-sm">
                    {plan === "premium" ? "Prioritário 24/7" : "Prioritário"}
                  </p>
                </div>
              </div>
            </div>

            {/* Aviso de cancelamento programado */}
            {subscription?.cancel_at_period_end && (
              <div className="mx-5 sm:mx-6 mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Cancelamento programado</p>
                  <p className="text-xs opacity-80 mt-0.5">
                    Sua assinatura foi cancelada e não será renovada. Você mantém o acesso até{" "}
                    {subscription.current_period_end
                      ? format(parseISO(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : "o fim do período atual"}.
                  </p>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="p-5 sm:p-6 pt-4 sm:pt-4">
              {!confirmCancel ? (
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => {
                      const manageUrl = `https://play.google.com/store/account/subscriptions?package=${PLAY_PACKAGE_NAME}`;
                      window.open(manageUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <ExternalLink className="size-4" />
                    Gerenciar na Play Store
                  </Button>
                  {!subscription?.cancel_at_period_end && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/30"
                      onClick={() => setConfirmCancel(true)}
                    >
                      <RotateCcw className="size-4" />
                      Cancelar assinatura
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-sm text-destructive">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <p>
                      Tem certeza? Se cancelar, você mantém o acesso até o fim do período pago, mas a assinatura não será renovada.
                    </p>
                  </div>
                  <div className="flex gap-2.5">
                    <Button variant="destructive" size="sm" className="flex-1" onClick={handleCancel}>
                      Sim, cancelar
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1" onClick={() => setConfirmCancel(false)}>
                      Manter assinatura
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plans.map((p) => {
              const Icon = p.icon;
              return (
                <Card
                  key={p.key}
                  className={`relative p-5 shadow-soft transition-all hover:shadow-elevated ${
                    p.highlight
                      ? "bg-gradient-hero text-primary-foreground border-0"
                      : "bg-card"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      <Star className="size-3" /> Popular
                    </span>
                  )}
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`size-10 rounded-xl flex items-center justify-center ${
                        p.highlight ? "bg-white/15 backdrop-blur" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="font-display font-semibold">{p.name}</p>
                      <p className={`text-[11px] ${p.highlight ? "opacity-80" : "text-muted-foreground"}`}>
                        Para você levar a sério
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="font-display text-3xl font-bold">{p.price}</span>
                    <span className={`text-sm ${p.highlight ? "opacity-80" : "text-muted-foreground"}`}>
                      {p.period}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check
                          className={`size-4 mt-0.5 shrink-0 ${
                            p.highlight ? "text-accent" : "text-primary"
                          }`}
                        />
                        <span className={p.highlight ? "" : "text-foreground"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full mt-5 gap-2 ${
                      p.highlight
                        ? "bg-white text-primary hover:bg-white/90"
                        : ""
                    }`}
                    variant={p.highlight ? "secondary" : "default"}
                    disabled={activating}
                    onClick={() => handleSubscribe(p.key, p.name, p.playSku)}
                  >
                    {activating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Crown className="size-4" />
                    )}
                    Assinar {p.name}
                  </Button>

                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Loving the app? */}
      <Card className="p-5 bg-gradient-hero text-primary-foreground border-0 shadow-elevated">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
            <Heart className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold">Está gostando do app?</p>
            <p className="text-xs opacity-80 mt-0.5">Compartilhe com quem você gosta 💜</p>
          </div>
        </div>
        <Button
          variant="secondary"
          className="w-full mt-4 bg-white text-primary hover:bg-white/90 gap-2"
          onClick={async () => {
            const shareData = {
              title: "Falaí Finanças",
              text: "Organize seus gastos por áudio com IA — experimenta!",
              url: typeof window !== "undefined" ? window.location.origin : "",
            };
            try {
              if (typeof navigator !== "undefined" && navigator.share) {
                await navigator.share(shareData);
              } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText(shareData.url);
                toast.success("Link copiado!");
              }
            } catch {
              /* cancelado */
            }
          }}
        >
          <Share2 className="size-4" /> Compartilhar
        </Button>
      </Card>

      {/* Account actions */}
      <section>
        <h3 className="font-display font-semibold mb-2 px-1 text-sm uppercase tracking-wider text-muted-foreground">
          Conta
        </h3>
        <Card className="bg-card shadow-soft overflow-hidden divide-y divide-border">
          <ProfileEditDialog
            userId={user.id}
            email={user.email}
            currentAvatarUrl={avatarUrl}
            onAvatarChange={onAvatarChange}
          />
          <ConfigThemeRow />
          <a
            href="https://id-preview--724889f1-e026-4a50-8f4a-842975d93e05.lovable.app/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors"
          >
            <Shield className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium flex-1">Privacidade e segurança</span>
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
          <Link
            to="/account-delete"
            className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-destructive/10 transition-colors text-destructive"
          >
            <Trash2 className="size-4" />
            <span className="text-sm font-medium flex-1">Solicitar eliminação da conta</span>
            <ExternalLink className="size-3.5 opacity-70" />
          </Link>
        </Card>
      </section>
    </div>
  );
}

function ReportsTab({
  monthExpenses,
  totalMonth,
}: {
  monthExpenses: Expense[];
  totalMonth: number;
}) {
  const today = new Date();
  const monthLabel = format(today, "MMMM 'de' yyyy", { locale: ptBR });

  // Receitas demo (placeholder) e cálculo de balanço
  const receitas = 0;
  const saldo = receitas - totalMonth;

  // Próximos compromissos financeiros (agenda demo)
  const agenda = [
    { day: format(today, "dd MMM", { locale: ptBR }), title: "Conta de luz", amount: 0 },
    { day: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3), "dd MMM", { locale: ptBR }), title: "Internet", amount: 0 },
    { day: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7), "dd MMM", { locale: ptBR }), title: "Aluguel", amount: 0 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="px-1">
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" /> Relatórios
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{monthLabel}</p>
      </div>

      {/* Balanço */}
      <Card className="p-5 sm:p-6 bg-gradient-hero text-primary-foreground border-0 shadow-elevated">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider opacity-80">
          <TrendingUp className="size-3.5" /> Balanço do mês
        </div>
        <p className="font-display text-3xl sm:text-4xl font-bold mt-1 break-words">
          {formatBRL(saldo)}
        </p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] opacity-80">
              <ArrowUpRight className="size-3.5" /> Receitas
            </div>
            <p className="font-semibold mt-0.5 text-sm tabular-nums">{formatBRL(receitas)}</p>
          </div>
          <div className="rounded-xl bg-white/10 backdrop-blur px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] opacity-80">
              <ArrowDownRight className="size-3.5" /> Gastos
            </div>
            <p className="font-semibold mt-0.5 text-sm tabular-nums">{formatBRL(totalMonth)}</p>
          </div>
        </div>
      </Card>

      {/* Receitas */}
      <Card className="bg-card shadow-soft overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-base sm:text-lg font-semibold">Receitas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Entradas previstas e realizadas</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.message("Adicionar receita em breve")}>
            Nova
          </Button>
        </div>
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma receita lançada ainda.
        </div>
      </Card>

      {/* Agenda */}
      <Card className="bg-card shadow-soft overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="font-display text-base sm:text-lg font-semibold flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary" /> Agenda
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Próximos compromissos</p>
        </div>
        <ul className="divide-y divide-border">
          {agenda.map((a) => (
            <li key={a.title} className="px-4 sm:px-6 py-4 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center shrink-0 text-[10px] font-semibold uppercase">
                {a.day.split(" ")[0]}
                <span className="opacity-70">{a.day.split(" ")[1]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground">A vencer</p>
              </div>
              <p className="font-display font-semibold tabular-nums text-sm">{formatBRL(a.amount)}</p>
            </li>
          ))}
        </ul>
      </Card>

      {/* Gráficos */}
      <ExpenseCharts expenses={monthExpenses} />
    </div>
  );
}

function ConfigThemeRow() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors"
      aria-label="Alternar tema"
    >
      {isDark ? <Moon className="size-4 text-muted-foreground" /> : <Sun className="size-4 text-muted-foreground" />}
      <span className="text-sm font-medium flex-1">Tema {isDark ? "escuro" : "claro"}</span>
      <span className="text-xs text-muted-foreground">{isDark ? "Mudar para claro" : "Mudar para escuro"}</span>
    </button>
  );
}
