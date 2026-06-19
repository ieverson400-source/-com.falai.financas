import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, Trash2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/account-delete")({
  component: AccountDeletePage,
  head: () => ({
    meta: [
      { title: "Eliminar conta — Falaí Finanças" },
      {
        name: "description",
        content:
          "Solicite a eliminação permanente da sua conta e de todos os dados associados no Falaí Finanças.",
      },
      { property: "og:title", content: "Eliminar conta — Falaí Finanças" },
      { property: "og:url", content: "https://falai-finan-as.lovable.app/account-delete" },
    ],
    links: [
      { rel: "canonical", href: "https://falai-finan-as.lovable.app/account-delete" },
    ],
  }),
});

function AccountDeletePage() {
  const email = "privacidade@falai.app";
  const subject = "Pedido de eliminação de conta e dados";
  const body =
    "Olá,\n\nSolicito a eliminação permanente da minha conta e de todos os dados associados no Falaí Finanças.\n\nE-mail da conta: \n\nObrigado.";
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-foreground">
      <Link
        to="/app"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <Trash2 className="size-5" />
        </div>
        <h1 className="text-3xl font-bold">Eliminar conta</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Pode pedir a eliminação permanente da sua conta e de todos os dados
        associados (lançamentos, mensagens, áudios, integrações).
      </p>

      <Card className="p-6 space-y-5">
        <div>
          <h2 className="font-semibold mb-1">Como funciona</h2>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Envie um pedido para o e-mail abaixo a partir da conta a eliminar.</li>
            <li>Confirmamos o pedido em até 5 dias úteis.</li>
            <li>Os dados são removidos em até 30 dias, conforme a LGPD.</li>
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            E-mail para o pedido
          </p>
          <a
            href={mailto}
            className="text-base font-medium text-primary underline underline-offset-2 break-all"
          >
            {email}
          </a>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild className="flex-1">
            <a href={mailto}>
              <Mail className="size-4" /> Abrir e-mail de pedido
            </a>
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              navigator.clipboard?.writeText(email);
            }}
          >
            Copiar e-mail
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Veja também a nossa{" "}
          <Link to="/privacy" className="underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </Card>
    </main>
  );
}
