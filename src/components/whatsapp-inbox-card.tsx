import { MessageCircleMore, CheckCircle2, AlertCircle, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatWhatsAppPhone } from "@/lib/phone";

export interface WhatsAppInboxItem {
  id: string;
  from_phone: string;
  transcript: string | null;
  processing_status: string;
  error_message: string | null;
  created_at: string;
}

function statusLabel(status: string) {
  switch (status) {
    case "processed":
      return { icon: CheckCircle2, label: "Processado", tone: "text-success" };
    case "failed":
      return { icon: AlertCircle, label: "Falhou", tone: "text-destructive" };
    case "processing":
      return { icon: Clock3, label: "Processando", tone: "text-primary" };
    default:
      return { icon: MessageCircleMore, label: "Recebido", tone: "text-muted-foreground" };
  }
}

export function WhatsAppInboxCard({ items }: { items: WhatsAppInboxItem[] }) {
  return (
    <Card className="bg-card">
      <div className="border-b border-border p-6">
        <h3 className="font-display text-lg font-semibold">Entradas do WhatsApp</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui aparecem os últimos áudios recebidos do número vinculado ao cliente.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">Nenhum áudio recebido pelo WhatsApp ainda.</div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const meta = statusLabel(item.processing_status);
            const Icon = meta.icon;

            return (
              <li key={item.id} className="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon className={`size-4 ${meta.tone}`} />
                    <span className="font-medium">{meta.label}</span>
                    <span className="text-muted-foreground">{formatWhatsAppPhone(item.from_phone)}</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground/90">
                    {item.transcript || item.error_message || "Áudio recebido e aguardando processamento."}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}