import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  notify_expense_confirmation: z.boolean().optional(),
  notify_monthly_summary: z.boolean().optional(),
});

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const update: {
      notify_expense_confirmation?: boolean;
      notify_monthly_summary?: boolean;
    } = {};
    if (typeof data.notify_expense_confirmation === "boolean")
      update.notify_expense_confirmation = data.notify_expense_confirmation;
    if (typeof data.notify_monthly_summary === "boolean")
      update.notify_monthly_summary = data.notify_monthly_summary;
    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("profiles")
      .update(update)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("notify_expense_confirmation, notify_monthly_summary, whatsapp_phone")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      notify_expense_confirmation: data?.notify_expense_confirmation ?? true,
      notify_monthly_summary: data?.notify_monthly_summary ?? true,
      whatsapp_phone: data?.whatsapp_phone ?? null,
    };
  });
