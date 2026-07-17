import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "Recuperar senha — Falaí Finanças" },
      { name: "description", content: "Receba um link seguro por e-mail para redefinir sua senha do Falaí Finanças." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Se este e-mail existir, enviamos um link de recuperação.");
    } catch (err) {
      // Não vazamos existência de conta: sucesso mesmo em erro genérico.
      setSent(true);
      toast.success("Se este e-mail existir, enviamos um link de recuperação.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-hero">
      <Toaster richColors />
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-elevated bg-card rounded-2xl">
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary mb-6 inline-flex items-center min-h-11">
          ← Voltar
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-2">Esqueci minha senha</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Informe seu e-mail e enviaremos um link seguro para você criar uma nova senha.
        </p>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm">
              Se houver uma conta associada a <strong>{email}</strong>, você receberá um e-mail em instantes com o link para redefinir a senha. Verifique também a caixa de spam.
            </p>
            <Button asChild className="w-full h-11">
              <Link to="/auth">Voltar ao login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" autoComplete="email" />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
