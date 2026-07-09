import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/planos/retorno")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
  head: () => ({
    meta: [{ title: "Assinatura confirmada — Falaí Finanças" }],
  }),
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Assinatura confirmada!</h1>
        <p className="text-muted-foreground mb-6">
          {session_id
            ? "Recebemos seu pagamento. Sua assinatura será ativada em alguns segundos."
            : "Obrigado! Sua assinatura está sendo processada."}
        </p>
        <Link to="/app">
          <Button className="w-full">Ir para o app</Button>
        </Link>
      </Card>
    </div>
  );
}
