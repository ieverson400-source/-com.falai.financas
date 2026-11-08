import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, Search } from "lucide-react";
import { AdminSectionTitle } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminListPurchases } from "@/lib/admin-panel.functions";

type Row = Awaited<ReturnType<typeof adminListPurchases>>[number];
const dt = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const providerLabel = (p: string) => (p === "play" ? "Google Play" : p === "stripe" ? "Cartão" : p);
const STATUS: Record<string, string> = { active: "Ativa", trialing: "Teste", past_due: "Pagamento pendente", canceled: "Cancelada", expired: "Expirada", paused: "Pausada", on_hold: "Em espera", grace_period: "Carência" };

export function AdminPurchases() {
  const list = useServerFn(adminListPurchases);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("all");
  useEffect(() => { list().then(setRows).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar.")); }, [list]);
  const filtered = useMemo(() => (rows ?? []).filter((r) => (provider === "all" || r.provider === provider) && (!q || (r.email ?? "").toLowerCase().includes(q.toLowerCase()))), [rows, q, provider]);
  return (
    <section>
      <AdminSectionTitle icon={CreditCard} title="Compras" description="Assinaturas do Google Play e cobranças por cartão de cada usuário." />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-md flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por e-mail" className="h-10 pl-9" /></div>
        <Select value={provider} onValueChange={setProvider}><SelectTrigger className="h-10 w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as origens</SelectItem><SelectItem value="play">Google Play</SelectItem><SelectItem value="stripe">Cartão</SelectItem></SelectContent></Select>
      </div>
      {error ? <Card className="p-6 text-sm text-destructive">{error}</Card> : !rows ? <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin" /></div> : (
        <Card className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Origem</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead><TableHead>Início</TableHead><TableHead>Próxima renovação</TableHead><TableHead>Atualizado</TableHead></TableRow></TableHeader>
          <TableBody>{filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma compra encontrada.</TableCell></TableRow> : filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.email ?? "—"}</TableCell>
              <TableCell><Badge variant="outline">{providerLabel(r.provider)}</Badge></TableCell>
              <TableCell className="capitalize">{r.plan}</TableCell>
              <TableCell><Badge variant={r.status === "active" || r.status === "trialing" ? "default" : "secondary"}>{STATUS[r.status] ?? r.status}</Badge>{r.cancelAtPeriodEnd && <p className="mt-1 text-xs text-muted-foreground">Não renova</p>}</TableCell>
              <TableCell>{dt(r.createdAt)}</TableCell>
              <TableCell>{dt(r.periodEnd)}</TableCell>
              <TableCell>{dt(r.updatedAt)}</TableCell>
            </TableRow>))}</TableBody></Table></Card>)}
    </section>
  );
}
