import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTwilioStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const request = getRequest();
    const url = new URL(request!.url);
    const origin = `${url.protocol}//${url.host}`;
    const webhookUrl = `${origin}/api/public/whatsapp`;

    const hasAccountSid = Boolean(process.env.TWILIO_ACCOUNT_SID);
    const hasAuthToken = Boolean(process.env.TWILIO_AUTH_TOKEN);

    let reachable = false;
    let reachError: string | null = null;
    try {
      const res = await fetch(webhookUrl, { method: "OPTIONS" });
      reachable = res.ok || res.status === 204;
      if (!reachable) reachError = `HTTP ${res.status}`;
    } catch (err) {
      reachError = err instanceof Error ? err.message : "Falha ao acessar webhook";
    }

    return {
      webhookUrl,
      hasAccountSid,
      hasAuthToken,
      credentialsConfigured: hasAccountSid && hasAuthToken,
      reachable,
      reachError,
    };
  });
