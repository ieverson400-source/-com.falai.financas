import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { enablePush } from "@/lib/push-client";
import { registerPushToken } from "@/lib/push-notifications.functions";

const PROMPT_KEY = "falai-push-prompted";

export function PushNotificationRegistration() {
  const { user } = useAuth();
  const saveToken = useServerFn(registerPushToken);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !("Notification" in window) || Notification.permission !== "default" || localStorage.getItem(PROMPT_KEY)) return;
    const timer = window.setTimeout(() => setOpen(true), 5600);
    return () => window.clearTimeout(timer);
  }, [user]);

  const activate = async () => {
    setBusy(true);
    try {
      const result = await enablePush();
      if (result.status === "registered") {
        await saveToken({ data: { token: result.token, platform: "web" } });
        localStorage.setItem(PROMPT_KEY, "registered");
        setOpen(false);
        toast.success("Notificações ativadas neste dispositivo.");
      } else if (result.status === "open-in-new-tab") {
        toast.info("Abra o aplicativo em uma nova aba para permitir notificações.");
      } else if (result.status === "denied") {
        localStorage.setItem(PROMPT_KEY, "denied");
        setOpen(false);
        toast.error("Permissão recusada. Você pode liberá-la nas configurações do navegador.");
      } else if (result.status === "not-configured") {
        toast.error("O recebimento de notificações ainda não está configurado.");
      } else {
        localStorage.setItem(PROMPT_KEY, "unsupported");
        setOpen(false);
        toast.error("Este dispositivo não oferece suporte a notificações push.");
      }
    } catch {
      toast.error("Não foi possível ativar as notificações agora.");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(PROMPT_KEY, "later");
    setOpen(false);
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-w-sm rounded-xl">
      <DialogHeader>
        <span className="mx-auto mb-2 grid size-11 place-items-center rounded-lg bg-primary/15 sm:mx-0"><BellRing className="size-5 text-primary" /></span>
        <DialogTitle>Ativar notificações</DialogTitle>
        <DialogDescription>Receba avisos importantes do Falaí Finanças neste dispositivo.</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={dismiss} disabled={busy}>Agora não</Button>
        <Button onClick={() => void activate()} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}Ativar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}