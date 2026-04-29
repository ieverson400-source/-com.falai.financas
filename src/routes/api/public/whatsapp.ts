import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractExpenseFromAudio, extractExpenseFromText } from "@/server/expense-ai";
import { normalizeWhatsAppPhone } from "@/lib/phone";
import type { TablesUpdate } from "@/integrations/supabase/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Twilio-Signature",
};

const FormSchema = z.object({
  From: z.string().min(5).max(40),
  MessageSid: z.string().min(10).max(100),
  NumMedia: z.string().optional(),
  MediaUrl0: z.string().url().optional(),
  MediaContentType0: z.string().min(3).max(120).optional(),
});

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders },
  });
}

function buildSignature(url: string, formEntries: [string, string][]) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("TWILIO_AUTH_TOKEN não configurado");
  }

  const sorted = [...formEntries].sort(([a], [b]) => a.localeCompare(b));
  const payload = sorted.reduce((acc, [key, value]) => `${acc}${key}${value}`, url);
  return createHmac("sha1", authToken).update(payload).digest("base64");
}

async function fetchTwilioMedia(url: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid) throw new Error("TWILIO_ACCOUNT_SID não configurado");
  if (!authToken) throw new Error("TWILIO_AUTH_TOKEN não configurado");

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao baixar áudio do Twilio [${response.status}]: ${body.slice(0, 160)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

async function markInbox(messageSid: string, updates: TablesUpdate<"whatsapp_inbox">) {
  await supabaseAdmin.from("whatsapp_inbox").update(updates).eq("message_sid", messageSid);
}

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const raw = await request.text();
        const params = new URLSearchParams(raw);
        const parsed = FormSchema.safeParse(Object.fromEntries(params.entries()));
        if (!parsed.success) {
          return textResponse("Payload inválido", 400);
        }

        const signature = request.headers.get("x-twilio-signature");
        const expected = buildSignature(request.url, [...params.entries()]);

        if (!signature) {
          return textResponse("Assinatura ausente", 401);
        }

        const provided = Buffer.from(signature);
        const computed = Buffer.from(expected);
        if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
          return textResponse("Assinatura inválida", 401);
        }

        const phone = normalizeWhatsAppPhone(parsed.data.From);
        if (!phone) {
          return textResponse("Número inválido", 400);
        }

        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("whatsapp_phone", phone)
          .maybeSingle();

        if (profileError) {
          return textResponse(profileError.message, 500);
        }

        if (!profile) {
          // Registra/atualiza o número não mapeado para revisão posterior
          const { data: existing } = await supabaseAdmin
            .from("whatsapp_unmapped_numbers")
            .select("id, hits")
            .eq("from_phone", phone)
            .maybeSingle();

          if (existing) {
            await supabaseAdmin
              .from("whatsapp_unmapped_numbers")
              .update({
                hits: existing.hits + 1,
                last_seen_at: new Date().toISOString(),
                last_message_sid: parsed.data.MessageSid,
                last_payload: Object.fromEntries(params.entries()),
              })
              .eq("id", existing.id);
          } else {
            await supabaseAdmin.from("whatsapp_unmapped_numbers").insert({
              from_phone: phone,
              last_message_sid: parsed.data.MessageSid,
              last_payload: Object.fromEntries(params.entries()),
            });
          }
          return textResponse("Número não vinculado", 200);
        }

        const inboxPayload = {
          user_id: profile.user_id,
          from_phone: phone,
          message_sid: parsed.data.MessageSid,
          media_url: parsed.data.MediaUrl0 ?? null,
          media_content_type: parsed.data.MediaContentType0 ?? null,
          processing_status: "processing",
          payload: Object.fromEntries(params.entries()),
        };

        const { error: upsertError } = await supabaseAdmin
          .from("whatsapp_inbox")
          .upsert(inboxPayload, { onConflict: "message_sid", ignoreDuplicates: false });

        if (upsertError) {
          return textResponse(upsertError.message, 500);
        }

        const mediaUrl = parsed.data.MediaUrl0;
        const mediaContentType = parsed.data.MediaContentType0;

        if (!mediaUrl || !mediaContentType || !mediaContentType.startsWith("audio/")) {
          await markInbox(parsed.data.MessageSid, {
            processing_status: "ignored",
            error_message: "Mensagem recebida sem áudio compatível",
          });
          return textResponse("Mensagem sem áudio", 200);
        }

        try {
          const today = new Date().toISOString().slice(0, 10);
          const audioBase64 = await fetchTwilioMedia(mediaUrl);
          const extracted = await extractExpenseFromAudio({
            audioBase64,
            mimeType: mediaContentType,
            today,
          });

          const { data: expense, error: expenseError } = await supabaseAdmin
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

          if (expenseError) throw new Error(expenseError.message);

          await markInbox(parsed.data.MessageSid, {
            processing_status: "processed",
            transcript: extracted.transcript,
            expense_id: expense.id,
            error_message: null,
          });

          return textResponse("OK", 200);
        } catch (error) {
          await markInbox(parsed.data.MessageSid, {
            processing_status: "failed",
            error_message: error instanceof Error ? error.message : "Falha ao processar áudio",
          });
          return textResponse("Falha ao processar", 200);
        }
      },
    },
  },
});