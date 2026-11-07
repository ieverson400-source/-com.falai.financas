import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ClipboardPaste, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { NotificationImportDialog } from "@/components/notification-import-dialog";

// Destino do "Compartilhar" do celular (Web Share Target, declarado nos manifestos). O texto compartilhado
// (ex.: uma notificação ou e-mail do banco) chega pela URL, é lido no aparelho e o usuário confere antes de
// salvar. A URL é limpa logo ao abrir, para o texto não ficar no histórico do navegador.

const clip = (v: unknown) => (typeof v === "string" ? v.slice(0, 2000) : undefined);

export const Route = createFileRoute("/app/compartilhar")({
  validateSearch: (search: Record<string, unknown>): { title?: string; text?: string; url?: string } => ({
    title: clip(search.title),
    text: clip(search.text),
    url: clip(search.url),
  }),
  component: SharePage,
  head: () => ({
    meta: [{ title: "Gasto compartilhado — Falaí Finanças e Gastos" }, { name: "robots", content: "noindex" }],
  }),
});

function SharePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  // Guarda o que chegou na primeira renderização; depois a URL é limpa.
  const shared = useRef([search.title, search.text].filter(Boolean).join("\n").slice(0, 2000));
  const [expenses, setExpenses] = useState<{ amount: number; expense_date: string }[]>([]);

  useEffect(() => {
    navigate({ to: "/app/compartilhar", search: {}, replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .order("expense_date", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (alive) setExpenses((data ?? []) as { amount: number; expense_date: string }[]);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const goHome = () => navigate({ to: "/app" });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar para o início">
            <Link to="/app">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <ClipboardPaste className="size-5 text-primary" />
            <h1 className="font-display text-lg font-semibold">Gasto compartilhado</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
        {loading ? (
          <Card className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando…
          </Card>
        ) : !user ? (
          <Card className="space-y-3 p-5 text-sm">
            <p>Entre no Falaí para registrar este gasto. Depois, compartilhe o texto novamente.</p>
            <Button asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
          </Card>
        ) : !shared.current.trim() ? (
          <Card className="space-y-3 p-5 text-sm">
            <p>Nenhum texto foi recebido. Compartilhe uma notificação ou e-mail de compra com o Falaí, ou cole o texto no início do app.</p>
            <Button asChild variant="outline">
              <Link to="/app">Ir para o início</Link>
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-5 text-sm text-muted-foreground">
              Lemos o texto compartilhado aqui, no seu aparelho. Confira os dados e salve o gasto.
            </Card>
            <NotificationImportDialog
              userId={user.id}
              expenses={expenses}
              initialText={shared.current}
              defaultOpen
              hideTrigger
              onSuccess={goHome}
              onClose={goHome}
            />
          </>
        )}
      </main>
      <Toaster richColors />
    </div>
  );
}
