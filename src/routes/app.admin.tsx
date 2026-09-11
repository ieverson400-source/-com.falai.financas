import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, ShieldCheck, Users, Landmark, History, Radio, Tags } from "lucide-react";
import { adminOverview, isCurrentUserAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Administração — Falaí Finanças" },
      {
        name: "description",
        content:
          "Painel interno do Falaí Finanças: usuários, conexões Open Finance e logs de sincronização com filtros por usuário e data.",
      },
      { property: "og:title", content: "Administração — Falaí Finanças" },
      { property: "og:description", content: "Painel interno de usuários, conexões e logs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Overview = Awaited<ReturnType<typeof adminOverview>>;

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR");
}

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const checkAdmin = useServerFn(isCurrentUserAdmin);
  const fetchOverview = useServerFn(adminOverview);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    checkAdmin().then((r) => setIsAdmin(r.isAdmin)).catch(() => setIsAdmin(false));
  }, [user, checkAdmin]);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetchOverview({
        data: {
          userId: userId.trim() || null,
          from: from || null,
          to: to || null,
        },
      });
      setData(res);
    } catch {
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [fetchOverview, userId, from, to]);

  useEffect(() => {
    if (isAdmin) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const emailOf = (id: string) => data?.users.find((u) => u.id === id)?.email ?? id.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar para o início">
            <Link to="/app">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h1 className="font-display text-lg font-semibold">Administração</h1>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to="/app/admin/ofertas">
              <Tags className="mr-2 size-4" /> Ofertas da Shop
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-28">
        {isAdmin === null ? (
          <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Verificando permissões…
          </Card>
        ) : !isAdmin ? (
          <Card className="p-6">
            <h2 className="font-display text-base font-semibold">Acesso restrito</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta área é somente para administradores.
            </p>
          </Card>
        ) : (
          <>
            <Card className="grid gap-3 p-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground" htmlFor="f-user">
                  ID do usuário
                </label>
                <Input
                  id="f-user"
                  placeholder="uuid do usuário (opcional)"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="f-from">
                  De
                </label>
                <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="f-to">
                  Até
                </label>
                <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="sm:col-span-4 flex gap-2">
                <Button onClick={() => void load()} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Aplicar filtros
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setUserId("");
                    setFrom("");
                    setTo("");
                  }}
                >
                  Limpar
                </Button>
              </div>
            </Card>

            <section aria-labelledby="usuarios">
              <h2 id="usuarios" className="mb-2 flex items-center gap-2 font-display text-base font-semibold">
                <Users className="size-4" /> Usuários ({data?.users.length ?? 0})
              </h2>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3">E-mail</th>
                      <th className="p-3">Nome</th>
                      <th className="p-3">WhatsApp</th>
                      <th className="p-3">Criado</th>
                      <th className="p-3">Último acesso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.users ?? []).map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="p-3">{u.email ?? "—"}</td>
                        <td className="p-3">{u.display_name ?? "—"}</td>
                        <td className="p-3">{u.whatsapp_phone ?? "—"}</td>
                        <td className="p-3">{fmt(u.created_at)}</td>
                        <td className="p-3">{fmt(u.last_sign_in_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>

            <section aria-labelledby="conexoes">
              <h2 id="conexoes" className="mb-2 flex items-center gap-2 font-display text-base font-semibold">
                <Landmark className="size-4" /> Conexões Open Finance ({data?.items.length ?? 0})
              </h2>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3">Usuário</th>
                      <th className="p-3">Instituição</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Última sincronização</th>
                      <th className="p-3">Criada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.items ?? []).map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-3">{emailOf(it.user_id)}</td>
                        <td className="p-3">{it.institution_name ?? "—"}</td>
                        <td className="p-3">
                          <Badge variant="secondary">{it.status}</Badge>
                        </td>
                        <td className="p-3">{fmt(it.last_synced_at)}</td>
                        <td className="p-3">{fmt(it.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>

            <section aria-labelledby="logs">
              <h2 id="logs" className="mb-2 flex items-center gap-2 font-display text-base font-semibold">
                <History className="size-4" /> Logs de sincronização ({data?.logs.length ?? 0})
              </h2>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Usuário</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Contas</th>
                      <th className="p-3">Origem</th>
                      <th className="p-3">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.logs ?? []).map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-3">{fmt(l.created_at)}</td>
                        <td className="p-3">{emailOf(l.user_id)}</td>
                        <td className="p-3">
                          <Badge variant={l.status === "success" ? "secondary" : "destructive"}>
                            {l.status}
                          </Badge>
                        </td>
                        <td className="p-3">{l.accounts_count ?? "—"}</td>
                        <td className="p-3">{l.triggered_by}</td>
                        <td className="p-3 max-w-[280px] truncate text-muted-foreground">
                          {l.error_message ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>

            <section aria-labelledby="webhooks">
              <h2
                id="webhooks"
                className="mb-2 flex items-center gap-2 font-display text-base font-semibold"
              >
                <Radio className="size-4" /> Requisições recebidas do webhook ({data?.webhooks.length ?? 0})
              </h2>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Usuário</th>
                      <th className="p-3">Evento</th>
                      <th className="p-3">Item</th>
                      <th className="p-3">Processado</th>
                      <th className="p-3">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.webhooks ?? []).map((w) => (
                      <tr key={w.id} className="border-t">
                        <td className="p-3">{fmt(w.created_at)}</td>
                        <td className="p-3">{w.user_id ? emailOf(w.user_id) : "—"}</td>
                        <td className="p-3">
                          <Badge variant="secondary">{w.event_type}</Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{w.item_id ?? "—"}</td>
                        <td className="p-3">{fmt(w.processed_at)}</td>
                        <td className="p-3 max-w-[280px] truncate text-muted-foreground">
                          {w.error_message ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
