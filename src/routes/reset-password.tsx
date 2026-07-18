import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Falaí Finanças" },
      { name: "description", content: "Defina uma nova senha para sua conta do Falaí Finanças." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);

  useEffect(() => {
    // O Supabase converte o link de recovery em uma sessão temporária via detectSessionInUrl.
    // Aguardamos o evento PASSWORD_RECOVERY ou uma sessão presente antes de habilitar o form.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setValidLink(true);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setValidLink(true);
      }
      setReady(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha redefinida com sucesso!");
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/auth" }), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-hero">
      <Toaster richColors />
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-elevated bg-card rounded-2xl">
        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-2">Redefinir senha</h1>
        <p className="text-muted-foreground mb-6 text-sm">Escolha uma nova senha para sua conta.</p>

        {!ready ? (
          <p className="text-sm text-muted-foreground">Validando link...</p>
        ) : !validLink ? (
          <div className="space-y-4">
            <p className="text-sm">
              Link inválido ou expirado. Solicite um novo link de recuperação.
            </p>
            <Button asChild className="w-full h-11">
              <Link to="/forgot-password">Solicitar novo link</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="h-11"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
