import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type AdSenseSettings = {
  publisher_id: string;
  ad_slot_id: string;
  ad_format: string;
  max_width: number;
  margin_top: number;
  margin_bottom: number;
  test_mode: boolean;
};

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

function validPublisher(value: string) {
  return /^ca-pub-\d+$/.test(value);
}

export function AdSenseBanner({ settings, preview = false }: { settings: AdSenseSettings; preview?: boolean }) {
  const requested = useRef(false);
  const configured = validPublisher(settings.publisher_id) && /^\d+$/.test(settings.ad_slot_id);

  useEffect(() => {
    if (preview || !configured) return;
    const scriptId = "google-adsense-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(settings.publisher_id)}`;
      document.head.appendChild(script);
    }
    if (!requested.current) {
      requested.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      } catch {
        requested.current = false;
      }
    }
  }, [configured, preview, settings.publisher_id]);

  if (!configured && !preview) return null;

  return (
    <div
      className="mx-auto w-full overflow-hidden rounded-lg border border-border/70 bg-card/60"
      style={{
        maxWidth: `${settings.max_width}px`,
        marginTop: `${settings.margin_top}px`,
        marginBottom: `${settings.margin_bottom}px`,
      }}
      aria-label="Publicidade"
    >
      <div className="px-3 pt-2 text-[10px] uppercase text-muted-foreground">Publicidade</div>
      {preview ? (
        <div className="grid min-h-24 place-items-center px-4 py-5 text-center text-xs text-muted-foreground">
          Prévia do espaço do Google AdSense
        </div>
      ) : (
        <ins
          className={cn("adsbygoogle block min-h-20 w-full", settings.ad_format === "fluid" && "min-h-24")}
          data-ad-client={settings.publisher_id}
          data-ad-slot={settings.ad_slot_id}
          data-ad-format={settings.ad_format || "auto"}
          data-full-width-responsive="true"
          {...(settings.test_mode ? { "data-adtest": "on" } : {})}
        />
      )}
    </div>
  );
}