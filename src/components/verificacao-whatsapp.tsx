import { useState } from "react";
import { MessageCircle, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const LINK_FORMS = "https://docs.google.com/forms/d/e/1FAIpQLSesqgqUQGPpY7NbWxAa5X1BADuoZ-aLcfTuUUnvbfAOYpbaAw/viewform?usp=header";

export function VerificacaoWhatsApp() {
  const [numero, setNumero] = useState("");
  const [codigo, setCodigo] = useState<number | null>(null);

  function gerarCodigo() {
    const novoCodigo = Math.floor(100000 + Math.random() * 900000);
    setCodigo(novoCodigo);
  }

  const digits = numero.replace(/\D/g, "");
  const linkWhatsApp =
    codigo !== null && digits.length >= 10
      ? `https://wa.me/${digits}?text=${encodeURIComponent(
          `MEU CÓDIGO é ${codigo}\n\nPreencha seus gastos aqui:\n${LINK_FORMS}`,
        )}`
      : null;

  return (
    <Card className="p-6 bg-card">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
          <MessageCircle className="size-5" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Registrar gasto no WhatsApp</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Gere um código e envie pelo WhatsApp com link do formulário de gastos.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verif-whatsapp">Seu WhatsApp</Label>
            <Input
              id="verif-whatsapp"
              type="tel"
              inputMode="tel"
              placeholder="Ex: 5519997283480"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>

          <Button onClick={gerarCodigo} disabled={digits.length < 10} className="w-full">
            Gerar código de verificação
          </Button>

          {codigo !== null && (
            <div className="text-center space-y-3 rounded-md border border-border bg-secondary/60 p-4">
              <p className="text-sm text-muted-foreground">Seu código</p>
              <p className="font-mono text-2xl font-bold tracking-widest text-primary">{codigo}</p>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Use esse código no formulário de gastos
                </p>
                {linkWhatsApp && (
                  <a
                    href={linkWhatsApp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow hover:bg-green-700 transition-colors"
                  >
                    <MessageCircle className="size-4" />
                    Abrir WhatsApp e registrar gasto
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
                <a
                  href={LINK_FORMS}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Abrir formulário no navegador
                  <ExternalLink className="size-3.5" />
                </a>
              </p>

              <p className="text-xs text-muted-foreground">
                O código e o link do formulário vão aparecer automaticamente na mensagem.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
