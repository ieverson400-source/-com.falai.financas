import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

import { useSubscription } from "@/hooks/use-subscription";
import { verifyMyPlayPurchase } from "@/lib/play-billing.functions";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { HomeShortcuts } from "@/components/home-shortcuts";
import { PriceChangeAlerts } from "@/components/price-change-alerts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AudioRecorder } from "@/components/audio-recorder";
import { ExpenseCharts } from "@/components/expense-charts";
import { ManualExpenseDialog } from "@/components/manual-expense-dialog";
import { ReceiptScanner } from "@/components/receipt-scanner";
import { ImportSpreadsheetButton } from "@/components/import-spreadsheet-button";
import { NotificationImportDialog } from "@/components/notification-import-dialog";
import { InsightsCards } from "@/components/insights-cards";



import { Toaster } from "@/components/ui/sonner";
import { ProfileEditDialog } from "@/components/profile-edit-dialog";
import { GoalHighlight } from "@/components/goal-highlight";
import { resolveAvatarUrl } from "@/lib/avatar-url";
import { toast } from "sonner";
import { Trash2, Mic, Hand, BarChart3, PiggyBank, ArrowUpRight, ArrowDownRight, Construction, Shield, ShieldCheck, Calendar as CalendarIcon, TrendingUp, Heart, Share2, Moon, Sun, LogOut, AlertTriangle, ExternalLink, CreditCard } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { categoryColor, formatBRL } from "@/lib/categories";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";


import { BottomNav, type NavTabKey } from "@/components/bottom-nav";

const validTabs: NavTabKey[] = ["inicio", "consorcio", "shop", "relatorios", "perfil"];

export const Route = createFileRoute("/app/")({
  component: AppDashboard,
  validateSearch: (search: Record<string, unknown>): { tab?: NavTabKey } => {
    const tab = typeof search.tab === "string" ? (search.tab as NavTabKey) : undefined;
    return tab && validTabs.includes(tab) ? { tab } : {};
  },
  head: () => ({
    meta: [
      { title: "Dashboard — Falaí Finanças e Gastos" },
      { name: "description", content: "Painel das suas finanças no Falaí: gastos do mês, fluxo de caixa e relatórios organizados por IA." },
      { property: "og:title", content: "Dashboard — Falaí Finanças e Gastos" },
      { property: "og:description", content: "Acompanhe seus gastos e fluxo de caixa em um único painel organizado por IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

type TabKey = NavTabKey;

function AppDashboard() {
  const { user, loading } = useAuth();
  
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [accessActive, setAccessActive] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [homeBanner, setHomeBanner] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { tab: initialTab } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "inicio");
  const [isAdmin, setIsAdmin] = useState(false);
  const flags = useFeatureFlags(); // atalhos do início (recarga e Open Finance)

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
    const [expensesRes, profileRes, settingsRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("avatar_url, is_active").eq("user_id", user.id).maybeSingle(),
      supabase.from("app_settings").select("maintenance_mode, home_banner_text").eq("setting_key", "global").maybeSingle(),
    ]);
    setRefreshing(false);
    if (expensesRes.error || profileRes.error) {
      toast.error(
        expensesRes.error?.message ||
          profileRes.error?.message ||
          "Falha ao carregar dados",
      );
      return;
    }
    setExpenses((expensesRes.data ?? []) as Expense[]);
    const storedAvatar = profileRes.data?.avatar_url ?? user.user_metadata?.avatar_path ?? user.user_metadata?.avatar_url ?? null;
    setAvatarUrl(await resolveAvatarUrl(storedAvatar));
    setAccessActive(profileRes.data?.is_active ?? true);
    setMaintenanceMode(settingsRes.data?.maintenance_mode ?? false);
    setHomeBanner(settingsRes.data?.home_banner_text ?? null);
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

  if (!accessActive || (maintenanceMode && !isAdmin)) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <Card className="max-w-md p-7 text-center">
          <AlertTriangle className="mx-auto size-10 text-warning" />
          <h1 className="mt-4 font-display text-xl font-semibold">{!accessActive ? "Acesso temporariamente bloqueado" : "Estamos em manutenção"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{!accessActive ? "Entre em contato com o suporte para revisar sua conta." : "Voltaremos em instantes. Administradores continuam com acesso normal."}</p>
          <Button variant="outline" className="mt-5" onClick={handleLogout}>Sair</Button>
        </Card>
      </main>
    );
  }

  const monthStart = startOfMonth(new Date());
  const monthExpenses = expenses.filter((e) => parseISO(e.expense_date) >= monthStart);
  const totalMonth = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const primeiroNome = (
    (user.user_metadata?.display_name as string | undefined) ||
    user.email?.split("@")[0] ||
    ""
  ).split(" ")[0];


  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />

      <header className="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link to="/" aria-label="Voltar para a página inicial Falaí" className="flex items-center gap-2 min-w-0">
            <div className="size-9 rounded-xl bg-gradient-hero flex items-center justify-center shadow-soft">
              <Mic className="size-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="font-display font-semibold truncate">Falaí</span>
          </Link>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <Button asChild size="sm" variant="outline" className="border-primary/40 text-primary">
                <Link to="/admin" aria-label="Abrir painel administrativo">
                  <ShieldCheck className="size-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              </Button>
            )}
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
        <h1 className="sr-only">Painel de finanças: gastos do mês e fluxo de caixa</h1>
        {activeTab === "inicio" && (
          <>
            {homeBanner && <div role="status" className="rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground">{homeBanner}</div>}
            {/* Saudação */}
            <div className="animate-rise">
              <p className="font-display text-2xl sm:text-3xl font-semibold">
                Olá{primeiroNome ? `, ${primeiroNome}` : ""} 👋
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Como estão suas finanças hoje?
              </p>
            </div>

            <Card className="animate-rise p-5 sm:p-6 bg-gradient-hero text-primary-foreground border-0 shadow-elevated">
              <p className="text-xs uppercase">Gastos do mês</p>
              <p className="font-display text-3xl font-bold mt-1 tabular-nums">{formatBRL(totalMonth)}</p>
              <p className="text-xs mt-2">{monthExpenses.length} gasto(s) registrado(s)</p>
            </Card>

            {/* Atalhos: recarga de celular e conexão bancária (só se ligados no servidor) */}
            <HomeShortcuts flags={flags} />

            {/* Avisos de reajuste de assinaturas */}
            <PriceChangeAlerts expenses={expenses} />

            {/* Destaque de voz */}
            <Card className="animate-rise p-5 sm:p-6 bg-card shadow-soft border border-primary/20">
              <div className="flex items-start gap-3">
                <div className="size-11 rounded-xl bg-primary/12 flex items-center justify-center shrink-0">
                  <Mic className="size-5 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-semibold">
                    🎙️ Falaí — Registre seus gastos falando
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Experimente: “Gastei R$ 35 no almoço”
                  </p>
                  <Button
                    className="press mt-4 gap-2 w-full sm:w-auto"
                    onClick={() =>
                      document
                        .getElementById("falai-voz")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                  >
                    <Mic className="size-4" /> Falar agora
                  </Button>
                </div>
              </div>
            </Card>

            {/* Destaque de objetivo */}
            <GoalHighlight />

            {/* Importar planilhas */}
            <ImportSpreadsheetButton />

            {/* Gasto a partir de notificação, SMS ou e-mail colado */}
            <NotificationImportDialog userId={user.id} expenses={expenses} onSuccess={load} />


            {/* Top stats + recorder */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              <div id="falai-voz" className="lg:col-span-2 space-y-4 sm:space-y-5 scroll-mt-24">
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


              </div>
            </div>

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

            {/* Projeção do mês e assinaturas recorrentes (calculadas no aparelho) */}
            <InsightsCards expenses={expenses} />

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

        {activeTab === "consorcio" && (
          <section className="space-y-4" aria-labelledby="consorcio-title">
            <div>
              <h2 id="consorcio-title" className="font-display text-2xl font-semibold">Consórcio</h2>
              <p className="mt-1 text-sm text-muted-foreground">Acompanhe por aqui quando o acesso ao parceiro estiver disponível.</p>
            </div>
            <Card className="p-6 sm:p-8 bg-card shadow-soft text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                <PiggyBank className="size-6 text-primary" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">Acesso em preparação</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Nenhuma oferta de consórcio está disponível no momento. Você será avisado quando houver uma opção ativa.
              </p>
              <Button className="mt-5" variant="outline" onClick={() => setActiveTab("inicio")}>
                Voltar ao início
              </Button>
            </Card>
          </section>
        )}

        {activeTab !== "inicio" && activeTab !== "perfil" && activeTab !== "relatorios" && activeTab !== "consorcio" && (
          <Card className="p-10 sm:p-16 bg-card shadow-soft text-center">
            <div className="mx-auto size-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Construction className="size-6 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold capitalize">{activeTab}</h3>
            <p className="text-sm text-muted-foreground mt-1">Tela em construção</p>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-background px-4 py-6 text-center text-xs text-muted-foreground pb-24">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-4">
          <span>© 2026 Falaí Finanças e Gastos</span>
          <Link to="/privacy" className="hover:underline underline-offset-2">
            Política de Privacidade
          </Link>
        </div>
      </footer>

      {/* Bottom nav */}
      <BottomNav current={activeTab} onSelectLocal={(k: NavTabKey) => setActiveTab(k)} />


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
  const { isActive, refresh } = useSubscription(user.id);
  const verifyPlay = useServerFn(verifyMyPlayPurchase);

  // Atalho "Assinatura": só aparece se o servidor informar que está ligado (falha fechada).
  // Recarga e Open Finance ficam no início do app (HomeShortcuts), não mais aqui.
  const flags = useFeatureFlags();

  // Lê o purchaseToken que a camada nativa (Play Billing / TWA bridge) grava
  // em localStorage após o checkout — chave compartilhada com o wrapper Android.
  const readStoredPlayToken = useCallback(():
    | { purchaseToken: string; productId?: string }
    | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("falai.play.purchase");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { purchaseToken?: string; productId?: string };
      if (!parsed.purchaseToken) return null;
      return { purchaseToken: parsed.purchaseToken, productId: parsed.productId };
    } catch {
      return null;
    }
  }, []);

  // Revalida automaticamente no primeiro mount se houver token armazenado e
  // ainda não houver assinatura ativa no nosso backend.
  useEffect(() => {
    if (isActive) return;
    const stored = readStoredPlayToken();
    if (!stored) return;
    let cancelled = false;
    (async () => {
      try {
        await verifyPlay({ data: stored });
        if (!cancelled) await refresh();
      } catch {
        // Preserve existing entitlement verification without subscription controls.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      </Card>

      {/* Account actions (logo abaixo do cabeçalho, visível ao abrir o Perfil) */}
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
          {flags.subscriptions && (
            <Link
              to="/app/assinatura"
              className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors"
            >
              <CreditCard className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium flex-1">Assinatura</span>
            </Link>
          )}
          <Button variant="ghost" className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3.5" onClick={() => window.dispatchEvent(new Event("falai-enable-push"))}>
            <ExternalLink className="size-4 text-muted-foreground" />Ativar notificações push
          </Button>
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
              title: "Falaí Finanças e Gastos",
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
