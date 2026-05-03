import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractExpenseFromAudio, extractExpenseFromText } from "@/server/expense-ai";
import { normalizeWhatsAppPhone } from "@/lib/phone";

export interface LastInboxEntry {
  id: string;
  message_sid: string;
  from_phone: string;
  processing_status: string;
  transcript: string | null;
  error_message: string | null;
  media_url: string | null;
  media_content_type: string | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
  expense_id: string | null;
}

export const getLastWhatsAppCall = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LastInboxEntry | null> => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("whatsapp_inbox")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    const { payload, ...rest } = data as Record<string, unknown> & { payload: unknown };
    return { ...(rest as Omit<LastInboxEntry, "payload_json">), payload_json: JSON.stringify(payload ?? {}, null, 2) };
  });

const SimulateInput = z.object({
  text: z.string().max(2000).optional(),
  audioBase64: z.string().min(10).optional(),
  audioMimeType: z.string().min(3).max(120).optional(),
}).refine(
  (v) => (v.text && v.text.trim().length > 0) || (v.audioBase64 && v.audioMimeType),
  { message: "Forneça um texto ou um áudio para simular." },
);

export const simulateWhatsAppWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SimulateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("whatsapp_phone")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileErr) throw new Error(profileErr.message);
    if (!profile?.whatsapp_phone) {
      throw new Error("Você precisa vincular um número de WhatsApp ao perfil antes de simular.");
    }

    const hasAudio = !!(data.audioBase64 && data.audioMimeType);
    const phone = normalizeWhatsAppPhone(profile.whatsapp_phone) ?? profile.whatsapp_phone;
    const messageSid = `SIMULATED_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const simulatedPayload: Record<string, unknown> = {
      From: `whatsapp:${phone}`,
      MessageSid: messageSid,
      _simulated: true,
      _simulatedAt: new Date().toISOString(),
    };
    if (hasAudio) {
      simulatedPayload.NumMedia = "1";
      simulatedPayload.MediaContentType0 = data.audioMimeType;
      simulatedPayload._audioBytes = Math.floor((data.audioBase64!.length * 3) / 4);
    } else {
      simulatedPayload.Body = data.text;
    }

    const { error: insertErr } = await supabaseAdmin.from("whatsapp_inbox").insert([
      {
        user_id: userId,
        from_phone: phone,
        message_sid: messageSid,
        processing_status: "processing",
        payload: simulatedPayload as Record<string, string | number | boolean | null>,
        media_content_type: hasAudio ? data.audioMimeType! : null,
        media_url: hasAudio ? "simulated://audio" : null,
      },
    ]);

    if (insertErr) throw new Error(`Falha ao registrar inbox: ${insertErr.message}`);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const extracted = hasAudio
        ? await extractExpenseFromAudio({
            audioBase64: data.audioBase64!,
            mimeType: data.audioMimeType!,
            today,
          })
        : await extractExpenseFromText({ text: data.text!, today });

      const { data: expense, error: expenseErr } = await supabaseAdmin
        .from("expenses")
        .insert({
          user_id: userId,
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

      await supabaseAdmin
        .from("whatsapp_inbox")
        .update({
          processing_status: "processed",
          transcript: extracted.transcript,
          expense_id: expense.id,
          error_message: null,
        })
        .eq("message_sid", messageSid);

      return {
        ok: true as const,
        messageSid,
        expenseId: expense.id,
        transcript: extracted.transcript,
        amount: extracted.amount,
        category: extracted.category,
        description: extracted.description ?? null,
        expense_date: extracted.expense_date,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida";
      await supabaseAdmin
        .from("whatsapp_inbox")
        .update({ processing_status: "failed", error_message: message })
        .eq("message_sid", messageSid);
      throw new Error(message);
    }
  });
