// Server-only helper to send a freeform WhatsApp text via Twilio.
// Used for in-app notifications (expense confirmations, monthly summary).
// Failures are swallowed by the caller (notifications are best-effort).

import { normalizeWhatsAppPhone } from "@/lib/phone";

export interface SendWhatsAppTextOptions {
  toPhone: string;
  body: string;
}

export interface SendWhatsAppTextResult {
  ok: boolean;
  sid: string | null;
  error?: string;
}

export async function sendWhatsAppText({
  toPhone,
  body,
}: SendWhatsAppTextOptions): Promise<SendWhatsAppTextResult> {
  const normalized = normalizeWhatsAppPhone(toPhone);
  if (!normalized) return { ok: false, sid: null, error: "Número inválido" };

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromRaw = process.env.TWILIO_WHATSAPP_FROM;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

  if (!accountSid || !authToken) {
    return { ok: false, sid: null, error: "Twilio não configurado" };
  }
  if (!fromRaw && !messagingServiceSid) {
    return { ok: false, sid: null, error: "TWILIO_WHATSAPP_FROM ou TWILIO_MESSAGING_SERVICE_SID ausente" };
  }

  const fromNormalized = fromRaw
    ? fromRaw.startsWith("whatsapp:")
      ? fromRaw
      : `whatsapp:${fromRaw.startsWith("+") ? fromRaw : `+${fromRaw.replace(/\D/g, "")}`}`
    : null;

  const params = new URLSearchParams();
  params.set("To", `whatsapp:${normalized}`);
  if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
  else if (fromNormalized) params.set("From", fromNormalized);
  params.set("Body", body.slice(0, 1500));

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    const payload = (await res.json()) as { sid?: string; message?: string; code?: number };
    if (!res.ok) {
      return {
        ok: false,
        sid: null,
        error: `Twilio ${payload.code ?? res.status}: ${payload.message ?? "erro"}`,
      };
    }
    return { ok: true, sid: payload.sid ?? null };
  } catch (e) {
    return { ok: false, sid: null, error: e instanceof Error ? e.message : "Falha desconhecida" };
  }
}

export function formatExpenseConfirmation(args: {
  amount: number;
  category: string;
  description: string | null;
  expense_date: string;
}): string {
  const value = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(args.amount);
  const date = (() => {
    try {
      const [y, m, d] = args.expense_date.split("-").map(Number);
      return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    } catch {
      return args.expense_date;
    }
  })();
  const desc = args.description ? `\n📝 ${args.description}` : "";
  return `✅ Gasto registrado\n\n💰 ${value}\n🏷️ ${args.category}\n📅 ${date}${desc}`;
}
