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

    return { expense: inserted, transcript: extracted.transcript };
  });
