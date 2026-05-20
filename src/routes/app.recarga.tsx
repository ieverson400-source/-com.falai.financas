import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ArrowLeft, Smartphone, Loader2, CheckCircle2, XCircle, Settings } from "lucide-react";
import { fazerRecarga, listarRecargas } from "@/lib/recarga.functions";
import { formatBRL } from "@/lib/categories";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app/recarga")({
  component: RecargaPage,
  head: () => ({
    meta: [
      { title: "Recarga de celular — Falaí Finanças" },
      { name: "description", content: "Recarregue seu celular pelo app." },
    ],
  }),
});

const OPERADORAS = ["Claro", "Vivo", "Tim", "Oi"] as const;
const VALORES = [10, 15, 20, 30] as const;

type Recarga = {
  id: string;
  telefone: string;
  operadora: string;
  valor: number;
  status: string;
  error_message: string | null;
  created_at: string;
};

function RecargaPage() {
  const [telefone, setTelefone] = useState("");
  const [operadora, setOperadora] = useState<(typeof OPERADORAS)[number] | "">("");
  const [valor, setValor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<Recarga[]>([]);

  const callRecarga = useServerFn(fazerRecarga);
  const callList = useServerFn(listarRecargas);

  const loadHist = async () => {
    try {
      const { recargas } = await callList();
      setHistorico(recargas as Recarga[]);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadHist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = telefone.replace(/\D/g, "");
    if (!/^\d{10,11}$/.test(cleanPhone)) {
      toast.error("Telefone inválido. Use DDD + número.");
      return;
    }
    if (!operadora) {
      toast.error("Selecione a operadora.");
      return;
    }
    if (!valor) {
      toast.error("Selecione um valor.");
      return;
    }

    setLoading(true);
    try {
      const result = await callRecarga({
        data: { telefone: cleanPhone, operadora, valor },
      });
      if (result.ok) {
        toast.success(result.message, {
          description: result.simulated ? "Modo simulado (sem provedor configurado)" : undefined,
        });
        setTelefone("");
        setOperadora("");
        setValor(null);
      } else {
        toast.error(result.message);
      }
      loadHist();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao processar recarga");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <header className="border-b border-border bg-card">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Recarga de celular</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="telefone">Número do celular (com DDD)</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="11912345678"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                maxLength={15}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Operadora</Label>
              <div className="grid grid-cols-4 gap-2">
                {OPERADORAS.map((op) => (
                  <Button
                    key={op}
                    type="button"
                    variant={operadora === op ? "default" : "outline"}
                    onClick={() => setOperadora(op)}
                    disabled={loading}
                  >
                    {op}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valor</Label>
              <div className="grid grid-cols-4 gap-2">
                {VALORES.map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={valor === v ? "default" : "outline"}
                    onClick={() => setValor(v)}
                    disabled={loading}
                  >
                    {formatBRL(v)}
                  </Button>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                "Recarregar"
              )}
            </Button>
          </form>
        </Card>

        {historico.length > 0 && (
          <Card className="p-6">
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
              Histórico
            </h2>
            <ul className="space-y-2">
              {historico.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {r.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : r.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {r.operadora} · {r.telefone}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(r.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{formatBRL(Number(r.valor))}</div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </main>
    </div>
  );
}
