import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractExpenseFromText } from "@/server/expense-ai";
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
  payload: unknown;
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
    return (data as LastInboxEntry | null) ?? null;
  });

const SimulateInput = z.object({
  text: z.string().min(1).max(2000),
});

export const simulateWhatsAppWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SimulateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Encontra o número vinculado ao usuário
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("whatsapp_phone")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileErr) throw new Error(profileErr.message);
    if (!profile?.whatsapp_phone) {
      throw new Error("Você precisa vincular um número de WhatsApp ao perfil antes de simular.");
    }

    const phone = normalizeWhatsAppPhone(profile.whatsapp_phone) ?? profile.whatsapp_phone;
    const messageSid = `SIMULATED_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const simulatedPayload = {
      From: `whatsapp:${phone}`,
      Body: data.text,
      MessageSid: messageSid,
      _simulated: true,
      _simulatedAt: new Date().toISOString(),
    };

    const { error: insertErr } = await supabaseAdmin.from("whatsapp_inbox").insert({
      user_id: userId,
      from_phone: phone,
      message_sid: messageSid,
      processing_status: "processing",
      payload: simulatedPayload,
    });

    if (insertErr) throw new Error(`Falha ao registrar inbox: ${insertErr.message}`);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const extracted = await extractExpenseFromText({ text: data.text, today });

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

      return { ok: true, messageSid, expenseId: expense.id, extracted };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida";
      await supabaseAdmin
        .from("whatsapp_inbox")
        .update({ processing_status: "failed", error_message: message })
        .eq("message_sid", messageSid);
      throw new Error(message);
    }
  });
