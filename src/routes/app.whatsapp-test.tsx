import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, Send, CheckCircle2, AlertCircle, Clock3 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  getLastWhatsAppCall,
  simulateWhatsAppWebhook,
  type LastInboxEntry,
} from "@/server/whatsapp-test.functions";

export const Route = createFileRoute("/app/whatsapp-test")({
  component: WhatsAppTestPage,
  head: () => ({
    meta: [
      { title: "Teste WhatsApp — Falaí" },
      { name: "description", content: "Simule chamadas do webhook do WhatsApp e veja os logs." },
    ],
  }),
});

function statusMeta(status: string) {
  switch (status) {
    case "processed":
      return { Icon: CheckCircle2, label: "Processado", tone: "text-success" };
    case "failed":
      return { Icon: AlertCircle, label: "Falhou", tone: "text-destructive" };
    case "processing":
      return { Icon: Clock3, label: "Processando", tone: "text-primary" };
    default:
      return { Icon: Clock3, label: status, tone: "text-muted-foreground" };
  }
}

function WhatsAppTestPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchLast = useServerFn(getLastWhatsAppCall);
  const simulate = useServerFn(simulateWhatsAppWebhook);

  const [text, setText] = useState("Gastei 25 reais no almoço hoje");
  const [last, setLast] = useState<LastInboxEntry | null>(null);
  const [loadingLast, setLoadingLast] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const refresh = useCallback(async () => {
    setLoadingLast(true);
    try {
      const data = (await fetchLast()) as LastInboxEntry | null;
      setLast(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao carregar logs");
    } finally {
      setLoadingLast(false);
    }
  }, [fetchLast]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const handleSimulate = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await simulate({ data: { text: text.trim() } });
      toast.success("Webhook simulado com sucesso");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na simulação");
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const meta = last ? statusMeta(last.processing_status) : null;

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/app" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Voltar ao painel
          </Link>
          <h1 className="font-display text-lg font-semibold">Teste do Webhook WhatsApp</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="font-display text-base font-semibold">Simular mensagem</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O texto abaixo será processado como se tivesse chegado pelo WhatsApp do número vinculado ao seu perfil.
            </p>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Ex: gastei 30 reais no Uber"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={refresh} disabled={loadingLast} className="gap-2">
              <RefreshCw className={`size-4 ${loadingLast ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button onClick={handleSimulate} disabled={submitting || !text.trim()} className="gap-2">
              <Send className="size-4" /> {submitting ? "Enviando..." : "Simular"}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Última chamada registrada</h2>
            {last && meta && (
              <span className={`inline-flex items-center gap-1.5 text-sm ${meta.tone}`}>
                <meta.Icon className="size-4" /> {meta.label}
              </span>
            )}
          </div>

          {!last ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhuma chamada registrada ainda. Use o formulário acima ou envie uma mensagem real.
            </p>
          ) : (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Field label="Status" value={last.processing_status} />
              <Field label="Recebida em" value={new Date(last.created_at).toLocaleString("pt-BR")} />
              <Field label="Atualizada em" value={new Date(last.updated_at).toLocaleString("pt-BR")} />
              <Field label="De" value={last.from_phone} />
              <Field label="Message SID" value={last.message_sid} />
              <Field
                label="Mídia"
                value={last.media_url ? `${last.media_content_type ?? "?"} — ${last.media_url}` : "—"}
              />
              <Field label="Transcrição" value={last.transcript ?? "—"} className="sm:col-span-2" />
              {last.error_message && (
                <Field label="Erro" value={last.error_message} className="sm:col-span-2 text-destructive" />
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Payload</dt>
                <pre className="mt-1 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(last.payload, null, 2)}
                </pre>
              </div>
            </dl>
          )}
        </Card>
      </main>
    </div>
  );
}

function Field({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value}</dd>
    </div>
  );
}
