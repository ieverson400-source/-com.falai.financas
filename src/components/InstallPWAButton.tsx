import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Evento `beforeinstallprompt` (Chrome/Edge/Android).
 * Não é tipado por padrão, então definimos a interface mínima aqui.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Botão flutuante "Instalar app".
 *
 * - Em Android/desktop Chromium: captura `beforeinstallprompt` e dispara o
 *   prompt nativo de instalação.
 * - Em iOS Safari: mostra instruções para "Adicionar à Tela de Início"
 *   (iOS não expõe API programática de instalação).
 * - Some quando o app já está rodando em modo standalone (já instalado).
 */
export function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Detecta iframe (editor do Lovable) — não mostra o botão no preview.
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    // Detecta iOS (Safari não dispara beforeinstallprompt).
    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIOS(iOS);

    // Já está rodando como app instalado?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS-only
      window.navigator.standalone === true;
    setIsInstalled(standalone);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success("App instalado com sucesso!");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  // Não exibe no preview do Lovable nem após instalado.
  if (isInIframe || isInstalled) return null;

  // iOS: mostra instruções manuais.
  if (isIOS && !deferredPrompt) {
    return (
      <Button
        onClick={() =>
          toast.info("Como instalar no iPhone", {
            description:
              'Toque no botão Compartilhar do Safari e depois em "Adicionar à Tela de Início".',
            duration: 8000,
          })
        }
        size="sm"
        className="fixed bottom-20 right-4 z-50 shadow-lg md:bottom-4"
      >
        <Download className="mr-2 h-4 w-4" />
        Instalar app
      </Button>
    );
  }

  // Android/desktop: só aparece quando o navegador disparou o evento.
  if (!deferredPrompt) return null;

  const handleInstall = async () => {
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast.success("Instalando o app...");
      }
      setDeferredPrompt(null);
    } catch {
      toast.error("Não foi possível instalar agora.");
    }
  };

  return (
    <Button
      onClick={handleInstall}
      size="sm"
      className="fixed bottom-20 right-4 z-50 shadow-lg md:bottom-4"
    >
      {isInstalled ? (
        <Check className="mr-2 h-4 w-4" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Instalar app
    </Button>
  );
}
