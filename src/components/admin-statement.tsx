import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { AdminSectionTitle } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminUserStatement } from "@/lib/admin-panel.functions";
import { cn } from "@/lib/utils";

type User = { id: string; email: string | null; name: string | null };
type Statement = Awaited<ReturnType<typeof adminUserStatement>>;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");

export function AdminStatement({ users }: { users: User[] }) {
  const load = useServerFn(adminUserStatement);
  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!userId || !/^\d{4}-\d{2}$/.test(month)) return;
    setLoading(true); setError(null);
    load({ data: { userId, month } }).then(setData).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar o extrato.")).finally(() => setLoading(false));
  }, [userId, month, load]);
  const tone = (v: number) => (v < 0 ? "text-destructive" : "text-primary");
  return (
    <section>
      <AdminSectionTitle icon={FileText} title="Extrato" description="Gastos, receitas e saldo de cada usuário por mês." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1 space-y-2"><Label>Usuário</Label>
          <Select value={userId} onValueChange={setUserId}><SelectTrigger className="h-10"><SelectValue placeholder="Escolha um usuário" /></SelectTrigger>
            <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name ? `${u.name} — ` : ""}{u.email ?? u.id}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Mês</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 w-44" /></div>
      </div>
      {!userId ? <Card className="p-8 text-center text-sm text-muted-foreground">Escolha um usuário para ver o extrato.</Card>
        : loading ? <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin" /></div>
        : error ? <Card className="p-6 text-sm text-destructive">{error}</Card>
        : data && <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[["Saldo anterior", data.openingBalance], ["Receitas no mês", data.totalIncome], ["Gastos no mês", -data.totalExpense], ["Saldo final", data.closingBalance]].map(([label, value]) => (
              <Card key={label as string} className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={cn("mt-1 font-display text-xl font-semibold", tone(value as number))}>{brl.format(value as number)}</p></Card>))}
          </div>
          <Card className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
            <TableBody>{data.rows.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum lançamento neste mês.</TableCell></TableRow> : data.rows.map((r) => (
              <TableRow key={`${r.type}-${r.id}`}>
                <TableCell>{day(r.date)}</TableCell>
                <TableCell>{r.description}{r.category && r.description !== r.category && <p className="text-xs text-muted-foreground">{r.category}</p>}</TableCell>
                <TableCell><Badge variant={r.type === "income" ? "default" : "secondary"}>{r.type === "income" ? "Receita" : "Gasto"}</Badge></TableCell>
                <TableCell className={cn("text-right", r.type === "income" ? "text-primary" : "text-destructive")}>{r.type === "income" ? "+" : "−"}{brl.format(r.amount)}</TableCell>
                <TableCell className={cn("text-right font-medium", tone(r.balance))}>{brl.format(r.balance)}</TableCell>
              </TableRow>))}</TableBody></Table></Card>
        </>}
    </section>
  );
}
