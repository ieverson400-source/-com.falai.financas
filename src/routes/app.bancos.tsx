import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft, Building2, Plus, Trash2, RefreshCw, Loader2, History, CheckCircle2, XCircle, ShieldCheck, Globe } from "lucide-react";
import { formatBRL } from "@/lib/categories";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createPluggyConnectToken,
  saveAndSyncItem,
  listBankData,
  deletePluggyItem,
  listSyncLogs,
  listOpenFinanceConnectorIds,
} from "@/lib/pluggy.functions";

export const Route = createFileRoute("/app/bancos")({
  component: BancosPage,
  head: () => ({
    meta: [
      { title: "Meus bancos — Falaí Finanças" },
      { name: "description", content: "Conecte seus bancos via Open Finance no Falaí Finanças, sincronize contas e cartões e veja seus saldos e extratos automaticamente." },
      { property: "og:title", content: "Meus bancos — Falaí Finanças" },
      { property: "og:description", content: "Conecte contas e cartões via Open Finance e sincronize seus saldos e extratos automaticamente." },
    ],
  }),
});

type Item = { id: string; pluggy_item_id: string; institution_name: string | null; status: string; last_synced_at: string | null };
type Account = { id: string; item_id: string; name: string | null; number: string | null; balance: number | null; type: string | null };
type Tx = { id: string; account_id: string; description: string | null; amount: number; transaction_date: string; category: string | null };

declare global {
  interface Window {
    PluggyConnect?: new (config: {
      connectToken: string;
      includeSandbox?: boolean;
      connectorIds?: number[];
      countries?: string[];
      onSuccess: (data: { item: { id: string } }) => void;
      onError?: (err: unknown) => void;
      onExit?: () => void;
    }) => { init: () => void };
  }
}

function loadPluggyScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PluggyConnect) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-pluggy="connect"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar Pluggy")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.pluggy.ai/pluggy-connect/v2.10.1/pluggy-connect.js";
    s.async = true;
    s.dataset.pluggy = "connect";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Pluggy"));
    document.head.appendChild(s);
  });
}

function BancosPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const createToken = useServerFn(createPluggyConnectToken);
  const saveItem = useServerFn(saveAndSyncItem);
  const list = useServerFn(listBankData);
  const removeItem = useServerFn(deletePluggyItem);
  const fetchLogs = useServerFn(listSyncLogs);
  const fetchOpenFinanceIds = useServerFn(listOpenFinanceConnectorIds);

  type SyncLog = { id: string; status: string; error_message: string | null; accounts_count: number | null; triggered_by: string; created_at: string };
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [historyLogs, setHistoryLogs] = useState<SyncLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (it: Item) => {
    setHistoryItem(it);
    setHistoryLoading(true);
    try {
      const res = await fetchLogs({ data: { itemId: it.id } });
      setHistoryLogs(res.logs as SyncLog[]);
    } catch (e) {
      toast.error("Erro ao carregar histórico", { description: (e as Error).message });
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    try {
      const data = await list();
      setItems(data.items as Item[]);
      setAccounts(data.accounts as Account[]);
      setTransactions(data.transactions as Tx[]);
    } catch (e) {
      toast.error("Erro ao carregar dados", { description: (e as Error).message });
    }
  }, [list]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const handleConnect = async (mode: "openfinance" | "all" = "all") => {
    setConnecting(true);
    try {
      await loadPluggyScript();
      let connectorIds: number[] | undefined;
      if (mode === "openfinance") {
        const { connectorIds: ids } = await fetchOpenFinanceIds();
        if (!ids || ids.length === 0) {
          toast.error("Nenhum conector Open Finance disponível no momento.");
          setConnecting(false);
          return;
        }
        connectorIds = ids;
      }
      const { accessToken } = await createToken({ data: {} });
      const connect = new window.PluggyConnect!({
        connectToken: accessToken,
        includeSandbox: true,
        countries: ["BR"],
        ...(connectorIds ? { connectorIds } : {}),
        onSuccess: async ({ item }) => {
          setBusy(true);
          try {
            const res = await saveItem({ data: { itemId: item.id } });
            toast.success(
              mode === "openfinance" ? "Open Finance conectado!" : "Banco conectado!",
              { description: `${res.accountsCount} conta(s) sincronizada(s)` },
            );
            await load();
          } catch (e) {
            toast.error("Erro ao sincronizar", { description: (e as Error).message });
          } finally {
            setBusy(false);
          }
        },
        onError: (err) => {
          toast.error("Erro ao conectar", { description: String(err) });
        },
        onExit: () => setConnecting(false),
      });
      connect.init();
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
      setConnecting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Desconectar este banco e remover todos os dados?")) return;
    setBusy(true);
    try {
      await removeItem({ data: { itemId: id } });
      toast.success("Banco desconectado");
      await load();
    } catch (e) {
      toast.error("Erro ao remover", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const handleSync = async (pluggyItemId: string) => {
    setSyncingId(pluggyItemId);
    try {
      const res = await saveItem({ data: { itemId: pluggyItemId } });
      toast.success("Sincronizado!", { description: `${res.accountsCount} conta(s) atualizada(s)` });
      await load();
    } catch (e) {
      toast.error("Erro ao sincronizar", { description: (e as Error).message });
    } finally {
      setSyncingId(null);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="flex-1 text-lg font-bold">Meus bancos</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={connecting || busy} size="sm">
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Conectar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => handleConnect("openfinance")} className="flex-col items-start gap-0.5 py-2">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Open Finance
                </div>
                <span className="pl-6 text-xs text-muted-foreground">
                  Regulado pelo Banco Central, mais seguro
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleConnect("all")} className="flex-col items-start gap-0.5 py-2">
                <div className="flex items-center gap-2 font-medium">
                  <Globe className="h-4 w-4" />
                  Todas as instituições
                </div>
                <span className="pl-6 text-xs text-muted-foreground">
                  Open Finance + login direto no banco
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {items.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="mb-2 font-semibold">Nenhum banco conectado</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Conecte sua conta via Open Finance e veja seu saldo e transações automaticamente.
            </p>
            <Button onClick={() => handleConnect("openfinance")} disabled={connecting}>
              {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Conectar via Open Finance
            </Button>
          </Card>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Conexões</h2>
              {items.map((it) => {
                const itemAccounts = accounts.filter((a) => a.item_id === it.id);
                const total = itemAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);
                return (
                  <Card key={it.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span className="font-semibold">{it.institution_name ?? "Banco"}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{it.status}</span>
                        </div>
                        <p className="mt-1 text-2xl font-bold">{formatBRL(total)}</p>
                        <p className="text-xs text-muted-foreground">
                          {itemAccounts.length} conta(s) · sincronizado{" "}
                          {it.last_synced_at ? new Date(it.last_synced_at).toLocaleString("pt-BR") : "—"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSync(it.pluggy_item_id)}
                          disabled={busy || syncingId === it.pluggy_item_id}
                          title="Sincronizar agora"
                        >
                          {syncingId === it.pluggy_item_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openHistory(it)} title="Histórico de sincronizações">
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(it.id)} disabled={busy} aria-label="Excluir banco" title="Excluir banco">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {itemAccounts.length > 0 && (
                      <div className="mt-3 space-y-1 border-t pt-3">
                        {itemAccounts.map((a) => (
                          <div key={a.id} className="flex justify-between text-sm">
                            <span>{a.name ?? a.type} {a.number ? `· ${a.number}` : ""}</span>
                            <span className="font-medium">{formatBRL(a.balance ?? 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </section>

            {transactions.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground">Últimas transações</h2>
                  <Button variant="ghost" size="sm" onClick={load} disabled={busy}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <Card>
                  {transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.description ?? "Transação"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.transaction_date).toLocaleDateString("pt-BR")}
                          {t.category ? ` · ${t.category}` : ""}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold ${t.amount < 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {formatBRL(t.amount)}
                      </span>
                    </div>
                  ))}
                </Card>
              </section>
            )}
          </>
        )}
      </main>

      <Dialog open={!!historyItem} onOpenChange={(o) => !o && setHistoryItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Histórico — {historyItem?.institution_name ?? "Banco"}</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : historyLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma sincronização registrada ainda.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {historyLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-md border p-3">
                  {log.status === "success" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {log.status === "success" ? "Sucesso" : "Erro"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {log.status === "success" && log.accounts_count != null && (
                      <p className="text-xs text-muted-foreground">{log.accounts_count} conta(s) atualizada(s)</p>
                    )}
                    {log.error_message && (
                      <p className="mt-1 break-words text-xs text-destructive">{log.error_message}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">Origem: {log.triggered_by}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
