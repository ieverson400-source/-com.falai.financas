import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeWhatsAppPhone } from "@/lib/phone";

const InputSchema = z.object({
  phone: z.string().min(8).max(30),
  name: z.string().trim().max(80).optional(),
});

/**
 * Sends a WhatsApp welcome message via Twilio REST API.
 * Requires secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM.
 * TWILIO_WHATSAPP_FROM should be the sandbox/dedicated number, e.g. "+14155238886".
 */
export const sendWhatsAppWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromRaw = process.env.TWILIO_WHATSAPP_FROM;

    if (!accountSid || !authToken) {
      throw new Error("Credenciais do Twilio não configuradas no servidor.");
    }
    if (!fromRaw) {
      throw new Error("TWILIO_WHATSAPP_FROM não configurado (ex: +14155238886).");
    }

    const to = normalizeWhatsAppPhone(data.phone);
    if (!to) {
      throw new Error("Número inválido. Use formato internacional, ex: +5519996020358.");
    }

    const fromNormalized = fromRaw.startsWith("whatsapp:")
      ? fromRaw
      : `whatsapp:${fromRaw.startsWith("+") ? fromRaw : `+${fromRaw.replace(/\D/g, "")}`}`;

    const greetingName = data.name?.trim() || "cliente";
    const body = `Olá, ${greetingName}! Seja bem-vindo ao nosso serviço da Falai Finance. 💙`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: `whatsapp:${to}`,
      From: fromNormalized,
      Body: body,
    });

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const payload = (await res.json()) as { sid?: string; message?: string; code?: number };

    if (!res.ok) {
      const reason = payload?.message ?? `HTTP ${res.status}`;
      throw new Error(`Falha ao enviar WhatsApp via Twilio: ${reason}`);
    }

    return { sid: payload.sid ?? null, to, from: fromNormalized };
  });
