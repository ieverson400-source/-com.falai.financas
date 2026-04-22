import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveWhatsAppPhone } from "@/server/whatsapp.functions";

interface Props {
  currentPhone: string | null;
  onSaved: (phone: string) => void;
}

export function WhatsAppLinkCard({ currentPhone, onSaved }: Props) {
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [saving, setSaving] = useState(false);
  const savePhone = useServerFn(saveWhatsAppPhone);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await savePhone({ data: { phone } });
      onSaved(result.whatsapp_phone);
      toast.success("Número do WhatsApp salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o número.");
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

          <Button onClick={handleSave} disabled={saving || phone.trim().length === 0} className="gap-2">
            <Save className="size-4" />
            {saving ? "Salvando..." : "Salvar número"}
          </Button>
        </div>
      </div>
    </Card>
  );
}