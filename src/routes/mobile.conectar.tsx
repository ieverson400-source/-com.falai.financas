import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, MessageCircle, Mic } from "lucide-react";

export const Route = createFileRoute("/mobile/conectar")({
  component: ConectarTab,
});

function ConectarTab() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Conectar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sincronize bancos e habilite registro por voz.
        </p>
      </header>

      <Card className="p-5 shadow-soft border-dashed border-2 border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Link2 className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-semibold text-sm">Conexão bancária</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Em breve: importe saldo e extrato automaticamente via Open Finance.
            </p>
            <Button size="sm" className="h-10 px-4 mt-3" disabled>
              Começar agora
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
            <MessageCircle className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-semibold text-sm">WhatsApp</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vincule seu número e registre gastos enviando áudio no WhatsApp.
            </p>
            <Link to="/app" className="inline-block mt-3">
              <Button size="sm" variant="outline" className="h-10 px-4">
                Configurar
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <Card className="p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-accent/30 text-accent-foreground flex items-center justify-center shrink-0">
            <Mic className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-semibold text-sm">Registro por voz</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grave um áudio no painel completo e a IA cadastra o gasto pra você.
            </p>
            <Link to="/app" className="inline-block mt-3">
              <Button size="sm" variant="outline" className="h-10 px-4">
                Abrir painel
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
