import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Sparkles, Bell, TrendingUp, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { sendWhatsAppWelcome } from "@/lib/whatsapp-send.functions";

export const Route = createFileRoute("/app/onboarding-whatsapp")({
  component: OnboardingWhatsApp,
  head: () => ({
    meta: [
      { title: "Ativar WhatsApp — Falaí Finanças" },
      {
        name: "description",
        content:
          "Vincule seu WhatsApp para receber confirmações de gastos, resumos e alertas financeiros direto no seu celular.",
      },
    ],
  }),
});

function OnboardingWhatsApp() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const sendWelcome = useServerFn(sendWhatsAppWelcome);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Se já tem número, vai direto para o app
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("whatsapp_phone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.whatsapp_phone) navigate({ to: "/app" });
      });
  }, [user, navigate]);

  const handleSave = async () => {
    if (!user) return;
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) {
      toast.error("Use o formato internacional: +55 11 99999-9999");
      return;
    }
    setSaving(true);
    try {
      const { data: conflict } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("whatsapp_phone", normalized)
        .maybeSingle();
      if (conflict && conflict.user_id !== user.id) {
        throw new Error("Esse número já está vinculado a outra conta.");
      }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ whatsapp_phone: normalized })
        .eq("user_id", user.id);

      if (updateErr) {
        // Perfil pode não existir ainda
        const { error: insertErr } = await supabase.from("profiles").insert({
          user_id: user.id,
          display_name:
            user.user_metadata?.display_name ?? user.email ?? null,
          whatsapp_phone: normalized,
        });
        if (insertErr) throw new Error(insertErr.message);
      }

      // Boas-vindas (best-effort, não bloqueia)
      sendWelcome({ data: { phone: normalized } }).catch(() => {});

      toast.success("WhatsApp vinculado! Enviamos uma mensagem de boas-vindas.");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao vincular número.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Toaster richColors />
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto size-14 rounded-2xl bg-gradient-hero flex items-center justify-center shadow-elevated">
            <MessageCircle className="size-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">
            Ative seu WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            O Falaí usa o WhatsApp para te avisar sobre cada gasto e mandar
            resumos automáticos. Leva 10 segundos.
          </p>
        </div>

        <Card className="p-5 space-y-4 bg-card">
          <div className="space-y-2">
            <Label htmlFor="wa-phone">Seu WhatsApp</Label>
            <Input
              id="wa-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
              inputMode="tel"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Formato internacional com DDI. Ex: +5511999999999
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || phone.trim().length === 0}
            className="w-full"
            size="lg"
          >
            {saving ? "Vinculando..." : "Ativar WhatsApp"}
          </Button>
        </Card>

        <Card className="p-5 bg-secondary/60 border-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-medium">
            O que você vai receber
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
              <span>
                <strong>Confirmação instantânea</strong> de cada gasto registrado
              </span>
            </li>
            <li className="flex items-start gap-3">
              <TrendingUp className="size-4 text-primary mt-0.5 shrink-0" />
              <span>
                <strong>Resumos diário, semanal e mensal</strong> com totais e top categorias
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Bell className="size-4 text-primary mt-0.5 shrink-0" />
              <span>
                <strong>Alertas de orçamento</strong> quando uma categoria estourar sua meta
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Lightbulb className="size-4 text-primary mt-0.5 shrink-0" />
              <span>
                <strong>Dica financeira semanal com IA</strong> personalizada pelos seus gastos
              </span>
            </li>
          </ul>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Você pode desligar cada notificação depois em Configurações.
        </p>
      </div>
    </div>
  );
}
