import { useState } from "react";
import { MessageCircle, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import { sendWhatsAppWelcome } from "@/server/whatsapp-send.functions";

interface Props {
  currentPhone: string | null;
  onSaved: (phone: string) => void;
}

export function WhatsAppLinkCard({ currentPhone, onSaved }: Props) {
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [sendHint, setSendHint] = useState<string | null>(null);
  const sendWelcome = useServerFn(sendWhatsAppWelcome);

  const handleSendWelcome = async () => {
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) {
      toast.error("Informe um número válido em formato internacional, ex: +5519996020358.");
      return;
    }
    setSending(true);
    setSendHint(null);
    try {
      const result = await sendWelcome({ data: { phone: normalized } });
      if (result.mode === "template") {
        toast.success("Mensagem enviada via template aprovado (HSM).");
      } else if (result.sandbox) {
        toast.success(
          "Mensagem enviada pelo sandbox do Twilio. Se não chegar, o destinatário precisa fazer o opt-in (join).",
        );
      } else {
        toast.success("Mensagem de boas-vindas enviada via WhatsApp.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      toast.error("Não foi possível enviar a mensagem de boas-vindas.");
      // Detecta cenário de opt-in do sandbox e oferece guia.
      if (/63015|63016|opt-in|join /i.test(message)) {
        setSendHint(
          'Sandbox do Twilio: peça que o destinatário envie no WhatsApp a mensagem "join <sua-palavra-chave>" para +1 415 523 8886. A palavra-chave aparece no console do Twilio em Messaging → Try it out → WhatsApp sandbox.',
        );
      } else if (/63018|63003|template|HSM|ContentSid/i.test(message)) {
        setSendHint(
          'Para enviar fora da janela de 24h, configure um template HSM aprovado no Twilio (ex: nome "bem_vindo", categoria UTILITY, variável {{1}} para o nome) e salve o ContentSid em TWILIO_WELCOME_CONTENT_SID.',
        );
      } else {
        setSendHint(message);
      }
    } finally {
      setSending(false);
    }
  };

  const handleSave = async () => {
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) {
      const message = `Etapa: validação do número. Erro: "${phone}" não parece estar em formato internacional. Use DDI + DDD + número, ex: +5511999999999.`;
      setDiagnostic(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setDiagnostic(`Etapa: iniciando vínculo. Número normalizado: ${normalized}.`);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        throw new Error(
          `Etapa: autenticação. Não foi possível confirmar seu login. Detalhe: ${userErr?.message ?? "sessão ausente"}.`,
        );
      }

      // Verifica conflito com outro usuário
      setDiagnostic("Etapa: verificando se o número já está vinculado ao seu perfil.");
      const { data: conflict, error: conflictErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("whatsapp_phone", normalized)
        .maybeSingle();
      if (conflictErr) {
        throw new Error(
          `Etapa: consulta de conflito. Código: ${conflictErr.code ?? "sem código"}. Detalhe: ${conflictErr.message}`,
        );
      }
      if (conflict && conflict.user_id !== userRes.user.id) {
        throw new Error("Etapa: consulta de conflito. Esse número já está vinculado a outro cliente.");
      }

      setDiagnostic("Etapa: atualizando seu perfil com o número informado.");
      const { data: savedProfile, error: updateErr } = await supabase
        .from("profiles")
        .update({ whatsapp_phone: normalized })
        .eq("user_id", userRes.user.id)
        .select("whatsapp_phone")
        .maybeSingle();
      if (updateErr) {
        throw new Error(
          `Etapa: atualização do perfil. Código: ${updateErr.code ?? "sem código"}. Detalhe: ${updateErr.message}`,
        );
      }

      if (!savedProfile) {
        setDiagnostic("Etapa: perfil não existia; criando perfil com o número informado.");
        const { error: insertErr } = await supabase.from("profiles").insert({
          user_id: userRes.user.id,
          display_name: userRes.user.user_metadata?.display_name ?? userRes.user.email ?? null,
          whatsapp_phone: normalized,
        });
        if (insertErr) {
          throw new Error(
            `Etapa: criação do perfil. Código: ${insertErr.code ?? "sem código"}. Detalhe: ${insertErr.message}`,
          );
        }
      }

      onSaved(normalized);
      setDiagnostic(`Sucesso: número ${normalized} salvo no seu perfil.`);
      toast.success("Número do WhatsApp salvo.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o número.";
      setDiagnostic(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 bg-card">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
          <MessageCircle className="size-5" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Vincular WhatsApp do cliente</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use o número em formato internacional para que os áudios recebidos caiam neste painel.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp-phone">Número do WhatsApp</Label>
            <Input
              id="whatsapp-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+5511999999999"
              inputMode="tel"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || phone.trim().length === 0}
              className="gap-2"
            >
              <Save className="size-4" />
              {saving ? "Salvando..." : "Salvar número"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSendWelcome}
              disabled={sending || phone.trim().length === 0}
              className="gap-2"
            >
              <Send className="size-4" />
              {sending ? "Enviando..." : "Enviar boas-vindas"}
            </Button>
          </div>

          {diagnostic && (
            <div className="rounded-md border border-border bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Diagnóstico: </span>
              {diagnostic}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
