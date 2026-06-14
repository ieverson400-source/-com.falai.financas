import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { sendWhatsAppMessage } from "@/lib/twilio";
import { normalizeWhatsAppPhone } from "@/lib/phone";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar — Falaí Finanças" },
      { name: "description", content: "Entre ou crie sua conta no Falaí Finanças para registrar gastos por voz, foto e WhatsApp com organização automática por IA." },
      { property: "og:title", content: "Entrar — Falaí Finanças" },
      { property: "og:description", content: "Acesse o Falaí Finanças para registrar gastos por voz, foto ou WhatsApp e ver relatórios automáticos." },
    ],
  }),
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const sendWelcome = useServerFn(sendWhatsAppMessage);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/app";
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;

        // Envia mensagem de boas-vindas via WhatsApp (não bloqueia o cadastro em caso de falha)
        const normalized = normalizeWhatsAppPhone(phone);
        if (normalized) {
          try {
            await sendWelcome({
              data: {
                toNumber: `whatsapp:${normalized}`,
                messageBody: "Olá! Seja bem-vindo ao Falai Finanças! 🚀",
              },
            });
            toast.success("Conta criada! Enviamos uma mensagem no seu WhatsApp.");
          } catch (waErr) {
            console.error("Falha ao enviar WhatsApp de boas-vindas:", waErr);
            toast.success("Conta criada! (Não foi possível enviar o WhatsApp de boas-vindas)");
          }
        } else {
          toast.success("Conta criada! Você já pode entrar.");
        }
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/app";
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-hero">
      <Toaster richColors />
      <Card className="w-full max-w-md p-6 sm:p-8 shadow-elevated bg-card rounded-2xl">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary mb-6 inline-flex items-center min-h-11">
          ← Voltar
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-2">{mode === "signin" ? "Entrar" : "Criar conta"}</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          {mode === "signin" ? "Acesse seus gastos" : "Comece a registrar gastos por voz"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+5519996020358"
                  className="h-11"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          </div>
          <Button type="submit" className="w-full h-11 transition-transform hover:scale-[1.01]" disabled={loading}>
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-sm text-primary hover:underline w-full text-center min-h-11"
        >
          {mode === "signin" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </button>
      </Card>
    </div>
  );
}
