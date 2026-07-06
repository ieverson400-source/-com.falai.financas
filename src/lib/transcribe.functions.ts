import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractExpenseFromAudio } from "@/lib/expense-ai";

const InputSchema = z.object({
  audioBase64: z.string().min(10).max(15_000_000),
  mimeType: z.string().min(3).max(100),
});

export const transcribeExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const extracted = await extractExpenseFromAudio({
      audioBase64: data.audioBase64,
      mimeType: data.mimeType,
      today,
    });

    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
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
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Notificação de confirmação + alerta de orçamento por WhatsApp (best-effort).
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp_phone, notify_expense_confirmation")
        .eq("user_id", userId)
        .maybeSingle();
      if (profile?.whatsapp_phone && profile.notify_expense_confirmation) {
        const { sendWhatsAppText, formatExpenseConfirmation } = await import(
          "@/lib/whatsapp-notify.server"
        );
        await sendWhatsAppText({
          toPhone: profile.whatsapp_phone,
          body: formatExpenseConfirmation({
            amount: Number(inserted.amount),
            category: inserted.category,
            description: inserted.description,
            expense_date: inserted.expense_date,
          }),
        });
      }
      const { maybeSendBudgetAlert } = await import("@/lib/budget-alert.server");
      await maybeSendBudgetAlert({
        userId,
        category: inserted.category,
        expenseDate: inserted.expense_date,
      });
    } catch (e) {
      console.error("transcribeExpense: notify failed", e);
    }

    return { expense: inserted, transcript: extracted.transcript };
  });
