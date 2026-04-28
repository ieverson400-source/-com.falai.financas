import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Webhook, Copy, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTwilioStatus } from "@/server/twilio-status.functions";

interface Status {
  webhookUrl: string;
  hasAccountSid: boolean;
  hasAuthToken: boolean;
  credentialsConfigured: boolean;
  reachable: boolean;
  reachError: string | null;
}

export function TwilioConfigCard() {
  const fetchStatus = useServerFn(getTwilioStatus);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const result = await fetchStatus();
      setStatus(result as Status);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao validar configuração");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const StatusRow = ({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) => (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
      ) : (
        <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
      )}
      <div className="flex-1">
        <p className={ok ? "text-foreground" : "text-foreground font-medium"}>{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );

  return (
    <Card className="p-6 bg-card">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
          <Webhook className="size-5" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold">Configuração do Twilio</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cole esta URL no campo "When a message comes in" do seu número/sandbox do WhatsApp
                no Twilio (método HTTP <span className="font-mono">POST</span>).
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Revalidar
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                readOnly
                value={status?.webhookUrl ?? ""}
                placeholder={loading ? "Carregando..." : ""}
                className="font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => status && copy(status.webhookUrl, "Webhook URL")}
                disabled={!status}
                aria-label="Copiar URL"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Status da conexão
            </p>
            {!status && loading ? (
              <p className="text-sm text-muted-foreground">Validando...</p>
            ) : status ? (
              <div className="space-y-2">
                <StatusRow
                  ok={status.hasAccountSid}
                  label="TWILIO_ACCOUNT_SID configurado"
                  hint={
                    status.hasAccountSid
                      ? undefined
                      : "Adicione o Account SID nos secrets do projeto."
                  }
                />
                <StatusRow
                  ok={status.hasAuthToken}
                  label="TWILIO_AUTH_TOKEN configurado"
                  hint={
                    status.hasAuthToken
                      ? undefined
                      : "Necessário para validar a assinatura HMAC do Twilio."
                  }
                />
                <StatusRow
                  ok={status.reachable}
                  label="Webhook acessível publicamente"
                  hint={
                    status.reachable
                      ? "O endpoint respondeu ao handshake (OPTIONS)."
                      : status.reachError ?? "Endpoint não respondeu."
                  }
                />
              </div>
            ) : null}
          </div>

          {status && !status.credentialsConfigured && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-foreground">
              <p className="font-medium">Credenciais pendentes</p>
              <p className="mt-1 text-muted-foreground">
                Adicione <span className="font-mono">TWILIO_ACCOUNT_SID</span> e{" "}
                <span className="font-mono">TWILIO_AUTH_TOKEN</span> nos secrets do backend para
                ativar o recebimento de áudios.
              </p>
            </div>
          )}

          {status?.credentialsConfigured && status.reachable && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
              <p className="font-medium">Tudo pronto ✓</p>
              <p className="mt-1 text-muted-foreground">
                Quando o Twilio enviar um áudio, validaremos a assinatura, transcreveremos e o gasto
                aparecerá automaticamente neste painel.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
