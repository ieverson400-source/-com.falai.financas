import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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
      { property: "og:url", content: "https://falai-finan-as.lovable.app/auth" },
    ],
    links: [
      { rel: "canonical", href: "https://falai-finan-as.lovable.app/auth" },
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const sendWelcome = useServerFn(sendWhatsAppMessage);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/app",
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      window.location.href = "/app";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar com Google");
      setGoogleLoading(false);
    }
  };

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
        const normalized = normalizeWhatsAppPhone(phone);
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: {
              display_name: name || email.split("@")[0],
              whatsapp_phone: normalized ?? null,
            },
          },
        });
        if (error) throw error;

        // Se já veio sessão (auto-confirm), grava o telefone no perfil imediatamente
        if (signUpData.session && signUpData.user && normalized) {
          await supabase
            .from("profiles")
            .upsert(
              {
                user_id: signUpData.user.id,
                display_name: name || email.split("@")[0],
                whatsapp_phone: normalized,
              },
              { onConflict: "user_id" },
            );
        }

        if (normalized) {
          try {
            await sendWelcome({
              data: {
                toNumber: `whatsapp:${normalized}`,
                messageBody:
                  "Olá! Bem-vindo ao Falaí Finanças 🚀\n\nA partir de agora você vai receber por aqui:\n• Confirmação de cada gasto registrado\n• Resumo diário no fim do dia\n• Resumo semanal e mensal\n• Alertas de orçamento\n• Dica financeira semanal\n\nBoa organização! 💚",
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
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Sincroniza telefone do metadata para o perfil caso ainda não esteja gravado
        const metaPhone = signInData.user?.user_metadata?.whatsapp_phone;
        if (signInData.user && metaPhone) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("whatsapp_phone")
            .eq("user_id", signInData.user.id)
            .maybeSingle();
          if (!prof?.whatsapp_phone) {
            await supabase
              .from("profiles")
              .upsert(
                {
                  user_id: signInData.user.id,
                  display_name:
                    signInData.user.user_metadata?.display_name ??
                    signInData.user.email ??
                    null,
                  whatsapp_phone: metaPhone,
                },
                { onConflict: "user_id" },
              );
          }
        }
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
          {mode === "signin" ? "Acesse seus gastos" : "É rápido — só email e senha"}
        </p>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="w-full h-11 mb-4 gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.5 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4 5.6l6.2 5.2C41 34.9 44 30 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          {googleLoading ? "Abrindo..." : "Continuar com Google"}
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou com email</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="h-11" />
          </div>

          {mode === "signup" && (
            <>
              {showWhatsapp ? (
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp (opcional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+5519996020358"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">Receba alertas e resumos automáticos.</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowWhatsapp(true)}
                  className="text-sm text-primary hover:underline"
                >
                  + Adicionar WhatsApp para receber alertas (opcional)
                </button>
              )}
            </>
          )}

          <Button type="submit" className="w-full h-11 transition-transform hover:scale-[1.01]" disabled={loading || googleLoading}>
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        {mode === "signin" && (
          <div className="mt-3 text-center">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">
              Esqueci minha senha
            </Link>
          </div>
        )}

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-sm text-primary hover:underline w-full text-center min-h-11"
        >
          {mode === "signin" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </button>
      </Card>
    </main>
  );
}
