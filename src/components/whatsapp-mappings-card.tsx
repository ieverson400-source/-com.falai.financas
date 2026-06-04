import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, PhoneOff, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getWhatsAppOverview,
  type WhatsAppOverview,
} from "@/lib/whatsapp-overview.functions";
import { formatWhatsAppPhone } from "@/lib/phone";

export function WhatsAppMappingsCard() {
  const fetchOverview = useServerFn(getWhatsAppOverview);
  const [data, setData] = useState<WhatsAppOverview | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchOverview();
      setData(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar mapeamentos");
    } finally {
      setLoading(false);
    }
  }, [fetchOverview]);

  useEffect(() => {
    load();
  }, [load]);

  const conflictCount = data?.conflicts.length ?? 0;
  const unmappedCount = data?.unmapped.length ?? 0;
  const mappedCount = data?.mappings.length ?? 0;

  return (
    <Card className="bg-card">
      <div className="flex items-center justify-between border-b border-border p-6">
        <div>
          <h3 className="font-display text-lg font-semibold">Mapeamentos WhatsApp ↔ clientes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Revise quais números estão associados a quais clientes e identifique conflitos.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid gap-3 border-b border-border p-6 sm:grid-cols-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
            <Users className="size-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Vinculados</p>
            <p className="font-display text-xl font-semibold">{mappedCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex size-9 items-center justify-center rounded-lg ${conflictCount > 0 ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`}>
            <AlertTriangle className="size-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Conflitos</p>
            <p className="font-display text-xl font-semibold">{conflictCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex size-9 items-center justify-center rounded-lg ${unmappedCount > 0 ? "bg-accent/30 text-accent-foreground" : "bg-secondary text-muted-foreground"}`}>
            <PhoneOff className="size-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Não mapeados</p>
            <p className="font-display text-xl font-semibold">{unmappedCount}</p>
          </div>
        </div>
      </div>

      {/* Conflitos */}
      {conflictCount > 0 && (
        <div className="border-b border-border p-6">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h4 className="text-sm font-semibold">Conflitos — número usado por múltiplos clientes</h4>
          </div>
          <ul className="space-y-3">
            {data!.conflicts.map((c) => (
              <li key={c.phone} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {formatWhatsAppPhone(c.phone)}
                  <Badge variant="destructive">{c.profiles.length} clientes</Badge>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {c.profiles.map((p) => (
                    <li key={p.user_id} className="font-mono">
                      {p.display_name ?? "(sem nome)"} — {p.user_id}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mapeamentos */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 p-6 pb-3">
          <CheckCircle2 className="size-4 text-success" />
          <h4 className="text-sm font-semibold">Vínculos ativos</h4>
        </div>
        {mappedCount === 0 ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            Nenhum cliente com número de WhatsApp configurado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Número WhatsApp</TableHead>
                <TableHead className="hidden sm:table-cell">User ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.mappings.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium">{m.display_name ?? "(sem nome)"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatWhatsAppPhone(m.whatsapp_phone)}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {m.user_id}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Não mapeados */}
      <div>
        <div className="flex items-center gap-2 p-6 pb-3">
          <PhoneOff className="size-4 text-accent-foreground" />
          <h4 className="text-sm font-semibold">Números não mapeados</h4>
        </div>
        {unmappedCount === 0 ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            Nenhum número desconhecido recebeu mensagens.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead className="text-right">Mensagens</TableHead>
                <TableHead className="hidden sm:table-cell">Primeira</TableHead>
                <TableHead>Última</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.unmapped.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-sm">{formatWhatsAppPhone(u.from_phone)}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.hits}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {new Date(u.first_seen_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(u.last_seen_at).toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}
