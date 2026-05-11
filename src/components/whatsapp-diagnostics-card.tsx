import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getWhatsAppDiagnostics,
  type WhatsAppDiagnostics,
} from "@/server/whatsapp-diagnostics.functions";

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
  const color = ok
    ? "text-primary"
    : warn
      ? "text-amber-500"
      : "text-destructive";
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={`size-4 mt-0.5 shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-foreground">{label}</p>
        {value && (
          <p className="font-mono text-xs text-muted-foreground break-all">{value}</p>
        )}
      </div>
    </div>
  );
}

export function WhatsAppDiagnosticsCard() {
  const fetchDiag = useServerFn(getWhatsAppDiagnostics);
  const [data, setData] = useState<WhatsAppDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="p-6 bg-card">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold">
                Diagnóstico do WhatsApp
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Verifica automaticamente o remetente do Twilio e os secrets de template.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Revalidar
            </Button>
          </div>

          {!data && loading ? (
            <p className="text-sm text-muted-foreground">Verificando...</p>
          ) : data ? (
            <>
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${MODE_LABEL[data.mode].tone}`}
              >
                {MODE_LABEL[data.mode].label}
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-4">
                <Row ok={data.hasAccountSid} label="TWILIO_ACCOUNT_SID" />
                <Row ok={data.hasAuthToken} label="TWILIO_AUTH_TOKEN" />
                <Row
                  ok={data.hasFrom}
                  warn={data.isSandbox}
                  label={
                    data.isSandbox
                      ? "TWILIO_WHATSAPP_FROM (sandbox)"
                      : "TWILIO_WHATSAPP_FROM"
                  }
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
        </div>
      </div>
    </Card>
  );
}
