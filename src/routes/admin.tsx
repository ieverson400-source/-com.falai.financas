import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CircleDollarSign, ExternalLink, Loader2, Pencil, RefreshCw, Search, Send, Settings, ShieldAlert, ShoppingBag, UserCheck, Users } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";
import { AdminSectionTitle, AdminShell } from "@/components/admin-shell";
import { AdminAdSenseSettings } from "@/components/admin-adsense-settings";
import { AdminAdvertising } from "@/components/admin-advertising";
import { AdminFeatureFlags } from "@/components/admin-feature-flags";
import { AdminGuardianSettings } from "@/components/admin-guardian-settings";
import { AdminPurchases } from "@/components/admin-purchases";
import { AdminStatement } from "@/components/admin-statement";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { adminDashboardData, adminGetSettings, adminSaveSettings, adminTestN8nWebhook, adminUpdateUser, adminUserHistory } from "@/lib/admin-panel.functions";
import { getPushAudience, sendPushToAll } from "@/lib/push-notifications.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPanel,
  head: () => ({ meta: [
    { title: "Painel administrativo — Falaí Finanças e Gastos" },
    { name: "description", content: "Gestão protegida de usuários, anúncios, notificações e configurações do Falaí Finanças e Gastos." },
    { property: "og:title", content: "Painel administrativo — Falaí Finanças e Gastos" },
    { property: "og:description", content: "Central administrativa protegida do Falaí Finanças e Gastos." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
});

type Dashboard = Awaited<ReturnType<typeof adminDashboardData>>;
type AdminUser = Dashboard["users"][number];
type SettingsData = Awaited<ReturnType<typeof adminGetSettings>>["settings"];
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dt = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

function AdminPanel() {
  const { user, loading: authLoading } = useAuth(); const navigate = useNavigate();
  const checkAdmin = useServerFn(isCurrentUserAdmin); const getDashboard = useServerFn(adminDashboardData);
  const getSettings = useServerFn(adminGetSettings);
  const updateUser = useServerFn(adminUpdateUser); const getHistory = useServerFn(adminUserHistory);
  const saveSettings = useServerFn(adminSaveSettings); const testN8nWebhook = useServerFn(adminTestN8nWebhook);
  const fetchPushAudience = useServerFn(getPushAudience); const sendPush = useServerFn(sendPushToAll);
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [section, setSection] = useState("overview");
  useEffect(() => {
    const sync = () => setSection(window.location.hash.slice(1) || "overview");
    sync(); window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null); const [busy, setBusy] = useState(false); const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null); const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [editActive, setEditActive] = useState(true); const [blockReason, setBlockReason] = useState(""); const [history, setHistory] = useState<Awaited<ReturnType<typeof adminUserHistory>>["entries"]>([]);
  const [pushOpen, setPushOpen] = useState(false); const [pushConfirmOpen, setPushConfirmOpen] = useState(false);
  const [pushTitle, setPushTitle] = useState(""); const [pushBody, setPushBody] = useState(""); const [pushLink, setPushLink] = useState("");
  const [pushAudience, setPushAudience] = useState({ users: 0, devices: 0 }); const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => { if (!authLoading && !user) void navigate({ to: "/auth", search: { next: "/admin" } as never }); }, [authLoading, user, navigate]);
  const loadAll = useCallback(async () => { setBusy(true); try { const [dash, config] = await Promise.all([getDashboard(), getSettings()]); setDashboard(dash); setSettings(config.settings); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível carregar o painel."); } finally { setBusy(false); } }, [getDashboard, getSettings]);
  useEffect(() => { if (!user) return; checkAdmin().then((result) => { setAccess(result.isAdmin ? "allowed" : "denied"); if (result.isAdmin) void loadAll(); }).catch(() => setAccess("denied")); }, [user, checkAdmin, loadAll]);
  const go = (next: string) => { if (next === "offers") { void navigate({ to: "/app/admin/ofertas" }); return; } setSection(next); window.history.replaceState(null, "", `/admin#${next}`); };
  const filteredUsers = useMemo(() => { const q = search.trim().toLowerCase(); return (dashboard?.users ?? []).filter((item) => !q || `${item.name ?? ""} ${item.email ?? ""}`.toLowerCase().includes(q)); }, [dashboard, search]);
  const openUser = async (item: AdminUser) => { setEditingUser(item); setEditRole(item.role); setEditActive(item.isActive); setBlockReason(item.blockedReason ?? ""); setHistory([]); try { setHistory((await getHistory({ data: { userId: item.id } })).entries); } catch { toast.error("Não foi possível carregar o histórico."); } };
  const submitUser = async () => { if (!editingUser) return; setBusy(true); try { await updateUser({ data: { userId: editingUser.id, role: editRole, isActive: editActive, reason: blockReason || null } }); toast.success("Usuário atualizado."); setEditingUser(null); await loadAll(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar."); } finally { setBusy(false); } };
  const submitSettings = async () => { if (!settings) return; setBusy(true); try { await saveSettings({ data: { maintenanceMode: settings.maintenance_mode, registrationsEnabled: settings.registrations_enabled, homeBannerText: settings.home_banner_text } }); toast.success("Configurações salvas."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setBusy(false); } };
  const openPush = async () => { setPushOpen(true); try { setPushAudience(await fetchPushAudience()); } catch { toast.error("Não foi possível contar os destinatários."); } };
  const submitPush = async () => { setPushBusy(true); try { const result = await sendPush({ data: { title: pushTitle.trim(), body: pushBody.trim(), link: pushLink.trim() || null } }); toast.success(`Push concluído: ${result.sent} enviado(s), ${result.failed} falha(s).`); setPushConfirmOpen(false); setPushOpen(false); setPushTitle(""); setPushBody(""); setPushLink(""); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar a notificação."); } finally { setPushBusy(false); } };

  if (access === "checking" || authLoading) return <div className="grid min-h-screen place-items-center bg-background"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Verificando acesso…</div></div>;
  if (access === "denied") return <main className="grid min-h-screen place-items-center bg-background px-4"><Card className="max-w-md p-7 text-center"><ShieldAlert className="mx-auto size-10 text-destructive" /><h1 className="mt-4 font-display text-xl font-semibold">Acesso negado</h1><p className="mt-2 text-sm text-muted-foreground">Esta área é exclusiva para administradores.</p><Button className="mt-5" onClick={() => void navigate({ to: "/app" })}>Voltar ao aplicativo</Button></Card></main>;

  return <AdminShell active={section} onNavigate={go}><Toaster richColors />
    <div className="mb-6 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Olá, administrador</p><p className="font-medium">{user?.email}</p></div><Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={busy}><RefreshCw className={busy ? "mr-2 size-4 animate-spin" : "mr-2 size-4"} />Atualizar</Button></div>
    {section === "overview" && <Overview data={dashboard} />}
    {section === "monetization" && <AdminAdSenseSettings />}
    {section === "guardian" && <AdminGuardianSettings />}
    {section === "purchases" && <AdminPurchases />}
    {section === "statement" && <AdminStatement users={dashboard?.users ?? []} />}
    {section === "advertising" && <AdminAdvertising />}
    {section === "users" && <section><AdminSectionTitle icon={Users} title="Usuários" description="Contas, permissões, acesso e histórico financeiro." /><div className="relative mb-4 max-w-md"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail" className="h-10 pl-9" /></div><Card className="overflow-hidden"><Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Cadastro</TableHead><TableHead>Gastos registrados</TableHead><TableHead>Função</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{filteredUsers.map((item) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.name ?? "Sem nome"}</p><p className="text-xs text-muted-foreground">{item.email ?? "—"}</p></TableCell><TableCell>{dt(item.createdAt)}</TableCell><TableCell>{brl.format(item.expenseTotal)}</TableCell><TableCell><Badge variant={item.role === "admin" ? "default" : "outline"}>{item.role}</Badge></TableCell><TableCell><Badge variant={item.isActive ? "secondary" : "destructive"}>{item.isActive ? "Ativo" : "Bloqueado"}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => void openUser(item)}><Pencil className="mr-2 size-4" />Editar</Button></TableCell></TableRow>)}</TableBody></Table></Card></section>}
    {section === "notifications" && <section><AdminSectionTitle icon={Bell} title="Notificações" description="Envios push e automações n8n." /><div className="flex flex-wrap gap-3"><Button onClick={() => void openPush()}><BellRing className="size-4" />Enviar Notificação Push</Button><Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { const result = await testN8nWebhook(); if (result.ok) toast.success("Teste enviado ao n8n com sucesso."); else toast.error(result.error); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar o teste ao n8n."); } finally { setBusy(false); } }}><Send className="size-4" />Testar n8n</Button></div></section>}
    {section === "settings" && settings && <section><AdminSectionTitle icon={Settings} title="Configurações do app" description="Controles globais aplicados a todos os usuários." /><div className="max-w-2xl space-y-4"><Card className="divide-y">{[["Modo de manutenção", "Bloqueia temporariamente usuários comuns.", "maintenance_mode"], ["Novos cadastros", "Permite a criação de novas contas.", "registrations_enabled"]].map(([title, description, key]) => <div className="flex items-center gap-4 p-5" key={key}><div className="flex-1"><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{description}</p></div><Switch checked={Boolean(settings[key as keyof SettingsData])} onCheckedChange={(checked) => setSettings({ ...settings, [key]: checked })} aria-label={title} /></div>)}</Card><div><Label htmlFor="banner">Aviso na tela inicial</Label><Textarea id="banner" className="mt-2 min-h-28" value={settings.home_banner_text ?? ""} onChange={(e) => setSettings({ ...settings, home_banner_text: e.target.value || null })} placeholder="Sem aviso ativo" /></div><Button onClick={() => void submitSettings()} disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Salvar configurações</Button></div></section>}
    {section === "settings" && <AdminFeatureFlags />}
    <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Editar usuário</DialogTitle><DialogDescription>{editingUser?.email}</DialogDescription></DialogHeader><div className="grid gap-4"><div><Label>Função</Label><Select value={editRole} onValueChange={(value) => setEditRole(value as "user" | "admin")}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">Usuário</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></div><div className="flex items-center justify-between rounded-lg border p-3"><div><Label>Acesso ativo</Label><p className="text-xs text-muted-foreground">Desative para bloquear o login no aplicativo.</p></div><Switch checked={editActive} onCheckedChange={setEditActive} /></div>{!editActive && <div><Label htmlFor="reason">Motivo do bloqueio</Label><Input id="reason" className="mt-2" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} /></div>}<div><Label>Histórico recente</Label><div className="mt-2 max-h-48 overflow-y-auto rounded-lg border">{history.length ? history.map((entry) => <div key={`${entry.source}-${entry.id}`} className="flex items-center justify-between border-b p-3 text-sm last:border-0"><div><p>{entry.description ?? entry.category ?? "Transação"}</p><p className="text-xs text-muted-foreground">{dt(entry.date)} · {entry.source}</p></div><span className="font-medium">{brl.format(entry.amount)}</span></div>) : <p className="p-4 text-sm text-muted-foreground">Nenhuma movimentação encontrada.</p>}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button><Button onClick={() => void submitUser()} disabled={busy}>Salvar</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={pushOpen} onOpenChange={setPushOpen}><DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Enviar Notificação Push</DialogTitle><DialogDescription>A mensagem será enviada aos dispositivos que autorizaram notificações.</DialogDescription></DialogHeader><div className="grid gap-4"><div><div className="flex items-center justify-between"><Label htmlFor="push-title">Título</Label><span className="text-xs text-muted-foreground">{pushTitle.length}/60</span></div><Input id="push-title" maxLength={60} required value={pushTitle} onChange={(event) => setPushTitle(event.target.value)} placeholder="Título da notificação" /></div><div><div className="flex items-center justify-between"><Label htmlFor="push-body">Mensagem</Label><span className="text-xs text-muted-foreground">{pushBody.length}/180</span></div><Textarea id="push-body" maxLength={180} required value={pushBody} onChange={(event) => setPushBody(event.target.value)} placeholder="Escreva uma mensagem curta e clara" className="min-h-28" /></div><div><Label htmlFor="push-link">Link ou rota de destino (opcional)</Label><Input id="push-link" value={pushLink} onChange={(event) => setPushLink(event.target.value)} placeholder="/app ou https://..." /></div><div><p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Prévia</p><Card className="border-primary/20 bg-card p-4 shadow-soft"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15"><BellRing className="size-5 text-primary" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{pushTitle.trim() || "Falaí Finanças e Gastos"}</p><p className="mt-1 break-words text-sm text-muted-foreground">{pushBody.trim() || "Sua mensagem aparecerá aqui."}</p>{pushLink.trim() && <p className="mt-2 flex items-center gap-1 truncate text-xs text-primary"><ExternalLink className="size-3" />{pushLink}</p>}</div></div></Card></div><p className="text-xs text-muted-foreground">Alcance atual: {pushAudience.users} usuário(s) em {pushAudience.devices} dispositivo(s).</p></div><DialogFooter><Button variant="outline" onClick={() => setPushOpen(false)}>Cancelar</Button><Button onClick={() => setPushConfirmOpen(true)} disabled={!pushTitle.trim() || !pushBody.trim() || pushBusy}><Send className="size-4" />Enviar para todos os usuários</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={pushConfirmOpen} onOpenChange={setPushConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar envio para todos?</AlertDialogTitle><AlertDialogDescription>Tem certeza? A notificação será enviada para {pushAudience.users} usuário(s), em {pushAudience.devices} dispositivo(s) autorizado(s).</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pushBusy}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void submitPush(); }} disabled={pushBusy || pushAudience.devices === 0}>{pushBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Confirmar envio</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </AdminShell>;
}

function Overview({ data }: { data: Dashboard | null }) {
  const cards = [{ label: "Total de usuários", value: data?.metrics.totalUsers ?? 0, icon: Users }, { label: "Ativos hoje", value: data?.metrics.activeToday ?? 0, icon: UserCheck }, { label: "Anúncios ativos", value: data?.metrics.activeOffers ?? 0, icon: ShoppingBag }, { label: "Gastos registrados", value: brl.format(data?.metrics.volume ?? 0), icon: CircleDollarSign }];
  return <section><AdminSectionTitle title="Visão geral" description="Usuários, ofertas e gastos registrados." /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon }) => <Card key={label} className="p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><Icon className="size-4 text-primary" /></div><p className="mt-3 text-2xl font-semibold">{value}</p></Card>)}</div><div className="mt-5"><h2 className="mb-4 font-medium">Crescimento de usuários</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data?.growth ?? []}><XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={11} interval={5} /><Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} /><Line type="monotone" dataKey="users" stroke="var(--primary)" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></div></section>;
}
