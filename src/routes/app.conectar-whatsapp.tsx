import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizeWhatsAppPhone } from "@/lib/phone";

export const Route = createFileRoute("/app/conectar-whatsapp")({
  component: ConectarWhatsAppPage,
  head: () => ({
    meta: [
      { title: "Conectar WhatsApp — Falaí Finanças" },
      {
        name: "description",
        content:
          "Vincule seu número de WhatsApp ao Falaí Finanças para registrar gastos por áudio e receber notificações.",
      },
      { property: "og:title", content: "Conectar WhatsApp — Falaí Finanças" },
      {
        property: "og:description",
        content: "Vincule seu WhatsApp ao Falaí Finanças em poucos segundos.",
      },
    ],
  }),
});

function ConectarWhatsAppPage() {
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConectar = async () => {
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) {
      toast.error("Informe um número válido com DDI, ex: +5511999999999.");
      return;
    }

    setSaving(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        throw new Error("Sessão não encontrada. Faça login novamente.");
      }

      const { data: conflict, error: conflictErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("whatsapp_phone", normalized)
        .maybeSingle();
      if (conflictErr) throw new Error(conflictErr.message);
      if (conflict && conflict.user_id !== userRes.user.id) {
        throw new Error("Esse número já está vinculado a outro usuário.");
      }

      const { data: updated, error: updateErr } = await supabase
        .from("profiles")
        .update({ whatsapp_phone: normalized })
        .eq("user_id", userRes.user.id)
        .select("whatsapp_phone")
        .maybeSingle();
      if (updateErr) throw new Error(updateErr.message);

      if (!updated) {
        const { error: insertErr } = await supabase.from("profiles").insert({
          user_id: userRes.user.id,
          display_name:
            userRes.user.user_metadata?.display_name ?? userRes.user.email ?? null,
          whatsapp_phone: normalized,
        });
        if (insertErr) throw new Error(insertErr.message);
      }

      toast.success(`WhatsApp ${normalized} conectado com sucesso!`);
      setPhone(normalized);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao conectar WhatsApp.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/app">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="font-display text-xl font-semibold">Conectar WhatsApp</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
              <MessageCircle className="size-5" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Vincule seu WhatsApp
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Informe seu número em formato internacional (DDI + DDD + número)
                  para receber e enviar registros de gastos por WhatsApp.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">Número do WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+5511999999999"
                  inputMode="tel"
                />
              </div>

              <Button
                onClick={handleConectar}
                disabled={saving || phone.trim().length === 0}
                className="gap-2"
              >
                <Save className="size-4" />
                {saving ? "Conectando..." : "Conectar"}
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <footer className="border-t bg-background px-4 py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-2xl">
          © 2026 Falaí Finanças ·{" "}
          <Link to="/privacy" className="underline hover:text-foreground">
            Política de Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
