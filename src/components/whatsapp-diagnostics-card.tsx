import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getWhatsAppDiagnostics,
  type WhatsAppDiagnostics,
} from "@/server/whatsapp-diagnostics.functions";
import { sendWhatsAppWelcome } from "@/server/whatsapp-send.functions";
import { normalizeWhatsAppPhone } from "@/lib/phone";

const MODE_LABEL: Record<WhatsAppDiagnostics["mode"], { label: string; tone: string }> = {
  "sandbox-freeform": {
    label: "Sandbox (texto livre)",
    tone: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  "production-template": {
    label: "Produção via template HSM",
    tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  "production-freeform": {
    label: "Produção sem template",
    tone: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  incomplete: {
    label: "Configuração incompleta",
    tone: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

function Row({
  ok,
  label,
  value,
  warn,
}: {
  ok: boolean;
  label: string;
  value?: string | null;
  warn?: boolean;
}) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : AlertCircle;
  const color = ok ? "text-primary" : warn ? "text-amber-500" : "text-destructive";
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={`size-4 mt-0.5 shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-foreground">{label}</p>
        {value && <p className="font-mono text-xs text-muted-foreground break-all">{value}</p>}
      </div>
    </div>
  );
}

interface Props {
  currentPhone: string | null;
}

/**
 * Constrói uma instrução acionável a partir do diagnóstico atual + erro do envio.
 */
function buildHint(diag: WhatsAppDiagnostics | null, errorMessage: string): string | null {
  if (!diag) return null;
  const msg = errorMessage.toLowerCase();

  if (msg.includes("63015") || msg.includes("63016") || msg.includes("opt-in")) {
    if (diag.isSandbox) {
      return 'O número precisa fazer opt-in no sandbox. No WhatsApp, envie "join <sua-palavra>" para +1 (415) 523-8886 e tente de novo.';
    }
    return "Janela de 24h expirada. Configure um template HSM aprovado em TWILIO_WELCOME_CONTENT_SID para reabrir o contato.";
  }
  if (msg.includes("63018") || msg.includes("63003") || msg.includes("template")) {
    if (!diag.hasContentSid) {
      return "Nenhum ContentSid configurado. Crie o template no console do Twilio e salve em TWILIO_WELCOME_CONTENT_SID.";
    }
    if (!diag.templateExists) {
      return `O ContentSid ${diag.contentSidPreview} não existe nesta conta Twilio. Verifique o secret.`;
    }
    if (!diag.templateApproved) {
      return `Template "${diag.templateName ?? "—"}" está com status "${diag.templateStatus ?? "pendente"}" no WhatsApp. Aguarde aprovação ou submeta novamente.`;
    }
  }
  if (msg.includes("63007")) {
    return "Número remetente (TWILIO_WHATSAPP_FROM) não está habilitado para WhatsApp na conta Twilio.";
  }
  if (msg.includes("21408") || msg.includes("21211")) {
    return "Número de destino inválido. Use formato internacional, ex: +5519996020358.";
  }
  return diag.recommendations[0] ?? null;
}

export function WhatsAppDiagnosticsCard({ currentPhone }: Props) {
  const fetchDiag = useServerFn(getWhatsAppDiagnostics);
  const sendWelcome = useServerFn(sendWhatsAppWelcome);
  const [data, setData] = useState<WhatsAppDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [log, setLog] = useState<
    { ts: string; level: "info" | "success" | "error"; message: string; hint?: string | null }[]
  >([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetchDiag();
      setData(res as WhatsAppDiagnostics);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao verificar configuração");
    } finally {
      setLoading(false);
    }
  };

  const appendLog = (
    level: "info" | "success" | "error",
    message: string,
    hint?: string | null,
  ) => {
    setLog((prev) =>
      [{ ts: new Date().toLocaleTimeString(), level, message, hint }, ...prev].slice(0, 15),
    );
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTestSend = async () => {
    const target = currentPhone ?? null;
    if (!target) {
      const m = "Salve um número de WhatsApp no card ao lado antes de testar.";
      appendLog("error", m);
      toast.error(m);
      return;
    }
    const normalized = normalizeWhatsAppPhone(target);
    if (!normalized) {
      appendLog("error", `Número inválido: ${target}`);
      return;
    }

    // Pré-checagem com o diagnóstico antes de tentar enviar.
    let diag = data;
    if (!diag) {
      try {
        diag = (await fetchDiag()) as WhatsAppDiagnostics;
        setData(diag);
      } catch {
        // segue mesmo sem diagnóstico
      }
    }

    if (diag) {
      if (diag.mode === "incomplete") {
        const hint = diag.recommendations[0] ?? "Configuração incompleta.";
        appendLog("error", "Envio bloqueado: configuração incompleta.", hint);
        toast.error("Configuração incompleta");
        return;
      }
      if (
        diag.mode === "production-template" &&
        diag.hasContentSid &&
        !diag.templateApproved
      ) {
        const hint =
          diag.templateError ??
          `Template "${diag.templateName ?? "—"}" não está aprovado no WhatsApp.`;
        appendLog("error", "Envio bloqueado: template HSM não está aprovado.", hint);
        toast.error("Template não aprovado");
        return;
      }
    }

    setTesting(true);
    appendLog("info", `Enviando mensagem real para ${normalized}...`);
    try {
      const result = await sendWelcome({ data: { phone: normalized } });
      const tag = result.mode === "template" ? "template HSM" : "texto livre";
      appendLog(
        "success",
        `OK via ${tag}. SID: ${result.sid ?? "—"}${result.sandbox ? " • via sandbox" : ""}`,
      );
      toast.success(`Mensagem enviada (${tag}).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha desconhecida";
      const hint = buildHint(diag, message);
      appendLog("error", message, hint);
      toast.error("Falha no envio");
    } finally {
      setTesting(false);
    }
  };

  const canTest = Boolean(currentPhone) && !testing && !loading;

  return (
    <Card className="p-6 bg-card">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold">Diagnóstico do WhatsApp</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Valida o remetente Twilio e checa se o template HSM está aprovado antes do envio.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Revalidar
            </Button>
          </div>

          {!data && loading ? (
            <p className="text-sm text-muted-foreground">Verificando...</p>
          ) : data ? (
            <>
              {(() => {
                const m = MODE_LABEL[data.mode] ?? MODE_LABEL.incomplete;
                return (
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${m.tone}`}
                  >
                    {m.label}
                  </div>
                );
              })()}

              <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-4">
                <Row ok={data.hasAccountSid} label="TWILIO_ACCOUNT_SID" />
                <Row ok={data.hasAuthToken} label="TWILIO_AUTH_TOKEN" />
                <Row
                  ok={data.hasFrom}
                  warn={data.isSandbox}
                  label={data.isSandbox ? "TWILIO_WHATSAPP_FROM (sandbox)" : "TWILIO_WHATSAPP_FROM"}
                  value={data.fromNumber}
                />
                <Row
                  ok={data.hasContentSid}
                  warn={!data.hasContentSid && !data.isSandbox}
                  label="TWILIO_WELCOME_CONTENT_SID (template HSM)"
                  value={data.contentSidPreview}
                />
                <Row
                  ok={data.hasMessagingService}
                  warn={!data.hasMessagingService}
                  label="TWILIO_MESSAGING_SERVICE_SID (opcional)"
                  value={data.messagingServicePreview}
                />
                <Row
                  ok={data.senderVerified}
                  warn={!data.senderVerified && !data.senderError}
                  label="Remetente validado na API do Twilio"
                  value={data.senderError}
                />
                {data.hasContentSid && (
                  <Row
                    ok={data.templateApproved}
                    warn={data.templateExists && !data.templateApproved}
                    label={
                      data.templateApproved
                        ? `Template "${data.templateName ?? "—"}" aprovado para WhatsApp`
                        : data.templateExists
                          ? `Template "${data.templateName ?? "—"}" • status: ${data.templateStatus ?? "pendente"}`
                          : "Template HSM não encontrado"
                    }
                    value={data.templateError}
                  />
                )}
              </div>

              {data.recommendations.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground">
                  <p className="font-medium mb-1">Recomendações</p>
                  <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                    {data.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Button
              variant="default"
              size="sm"
              onClick={handleTestSend}
              disabled={!canTest}
              className="gap-2"
            >
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Enviar mensagem de teste
            </Button>
            {log.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLog([])}
                className="gap-2 text-muted-foreground"
              >
                <Trash2 className="size-4" /> Limpar log
              </Button>
            )}
            {!currentPhone && (
              <p className="text-xs text-muted-foreground self-center">
                Salve um número no card de WhatsApp para habilitar o teste.
              </p>
            )}
          </div>

          {log.length > 0 && (
            <ul className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
              {log.map((entry, i) => (
                <li key={i} className="space-y-1">
                  <div className="flex gap-2">
                    <span className="font-mono text-muted-foreground shrink-0">[{entry.ts}]</span>
                    <span
                      className={
                        entry.level === "success"
                          ? "text-emerald-600"
                          : entry.level === "error"
                            ? "text-destructive"
                            : "text-foreground"
                      }
                    >
                      {entry.message}
                    </span>
                  </div>
                  {entry.hint && (
                    <p className="ml-[68px] rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-foreground">
                      💡 {entry.hint}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
