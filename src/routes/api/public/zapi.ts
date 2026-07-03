import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractExpenseFromText } from "@/lib/expense-ai";
import { normalizeWhatsAppPhone } from "@/lib/phone";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Client-Token",
};

// Z-API envia payloads JSON com formato variável. Aceitamos os campos
// mais comuns (phone, text.message, message, body) e ignoramos o resto.
const PayloadSchema = z.object({
  phone: z.string().min(5).max(40).optional(),
  from: z.string().min(5).max(40).optional(),
  sender: z.string().min(5).max(40).optional(),
  messageId: z.string().max(200).optional(),
  message: z.union([z.string(), z.object({ message: z.string().optional() }).partial()]).optional(),
  text: z
    .union([z.string(), z.object({ message: z.string().optional(), body: z.string().optional() }).partial()])
    .optional(),
  body: z.string().max(4000).optional(),
  fromMe: z.boolean().optional(),
  isStatusReply: z.boolean().optional(),
}).passthrough();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
  });
}

function extractPhone(data: z.infer<typeof PayloadSchema>): string | null {
  const raw = data.phone ?? data.from ?? data.sender;
  if (!raw) return null;
  return normalizeWhatsAppPhone(raw);
}

function extractText(data: z.infer<typeof PayloadSchema>): string {
  if (typeof data.body === "string") return data.body;
  if (typeof data.message === "string") return data.message;
  if (data.message && typeof data.message === "object" && "message" in data.message) {
    const m = (data.message as { message?: string }).message;
    if (m) return m;
  }
  if (typeof data.text === "string") return data.text;
  if (data.text && typeof data.text === "object") {
    const t = data.text as { message?: string; body?: string };
    if (t.message) return t.message;
    if (t.body) return t.body;
  }
  return "";
}

async function sendZapiReply(phoneDigits: string, message: string) {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const instanceToken = process.env.ZAPI_INSTANCE_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!instanceId || !instanceToken) return; // best-effort

  const url = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;

  try {
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: phoneDigits, message }),
    });
  } catch (err) {
    console.error("zapi send-text failed", err);
  }
}

function formatConfirmation(e: {
  amount: number;
  category: string;
  description?: string | null;
  expense_date: string;
}) {
  const brl = e.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const desc = e.description ? ` — ${e.description}` : "";
  return `✅ Gasto registrado: ${brl} em ${e.category}${desc} (${e.expense_date}).`;
}

export const Route = createFileRoute("/api/public/zapi")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        // Verificação opcional via token no header (configure em ZAPI_WEBHOOK_TOKEN
        // e no painel da Z-API em "Client-Token" do webhook).
        const expectedToken = process.env.ZAPI_WEBHOOK_TOKEN;
        if (expectedToken) {
          const provided = request.headers.get("client-token") ?? request.headers.get("x-webhook-token");
          if (provided !== expectedToken) {
            return jsonResponse({ error: "invalid token" }, 401);
          }
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return jsonResponse({ error: "invalid json" }, 400);
        }

        const parsed = PayloadSchema.safeParse(raw);
        if (!parsed.success) {
          return jsonResponse({ error: "invalid payload" }, 400);
        }

        // Ignora ecos das próprias mensagens enviadas pelo bot.
        if (parsed.data.fromMe || parsed.data.isStatusReply) {
          return jsonResponse({ ok: true, ignored: "fromMe" });
        }

        const phone = extractPhone(parsed.data);
        if (!phone) return jsonResponse({ error: "missing phone" }, 400);

        const text = extractText(parsed.data).trim();
        if (!text) return jsonResponse({ ok: true, ignored: "no text" });

        const { data: profile, error: profileErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id, whatsapp_phone")
          .eq("whatsapp_phone", phone)
          .maybeSingle();

        if (profileErr) {
          console.error("zapi profile lookup", profileErr.message);
          return jsonResponse({ error: "internal" }, 500);
        }

        if (!profile) {
          const phoneDigits = phone.replace(/^\+/, "");
          await sendZapiReply(
            phoneDigits,
            "Olá! Seu número ainda não está vinculado a uma conta no Falaí Finanças. Acesse o app e conecte este WhatsApp em 'Conectar WhatsApp'.",
          );
          return jsonResponse({ ok: true, unmapped: true });
        }

        try {
          const today = new Date().toISOString().slice(0, 10);
          const extracted = await extractExpenseFromText({ text, today });

          const { data: expense, error: expenseErr } = await supabaseAdmin
            .from("expenses")
            .insert({
              user_id: profile.user_id,
              amount: extracted.amount,
              category: extracted.category,
              description: extracted.description ?? null,
              expense_date: extracted.expense_date,
              source: "audio",
              raw_transcript: extracted.transcript,
            })
            .select("id")
            .single();

          if (expenseErr) throw new Error(expenseErr.message);

          const phoneDigits = phone.replace(/^\+/, "");
          await sendZapiReply(phoneDigits, formatConfirmation(extracted));

          return jsonResponse({
            ok: true,
            expense_id: expense.id,
            amount: extracted.amount,
            category: extracted.category,
            description: extracted.description,
            expense_date: extracted.expense_date,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Falha ao processar";
          console.error("zapi processing failed", msg);
          const phoneDigits = phone.replace(/^\+/, "");
          await sendZapiReply(
            phoneDigits,
            "Não consegui entender essa mensagem 😕. Tente algo como: 'gastei 30 no almoço' ou 'paguei 80 de gasolina'.",
          );
          return jsonResponse({ ok: false, error: msg }, 200);
        }
      },
    },
  },
});
