import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  notify_expense_confirmation: z.boolean().optional(),
  notify_monthly_summary: z.boolean().optional(),
  notify_daily_summary: z.boolean().optional(),
  notify_weekly_summary: z.boolean().optional(),
  notify_budget_alert: z.boolean().optional(),
  notify_weekly_tip: z.boolean().optional(),
  notify_inactivity: z.boolean().optional(),
});

type PrefKey = keyof z.infer<typeof InputSchema>;
const KEYS: PrefKey[] = [
  "notify_expense_confirmation",
  "notify_monthly_summary",
  "notify_daily_summary",
  "notify_weekly_summary",
  "notify_budget_alert",
  "notify_weekly_tip",
  "notify_inactivity",
];

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const update: Record<string, boolean> = {};
    for (const k of KEYS) {
      const v = data[k];
      if (typeof v === "boolean") update[k] = v;
    }
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
      .select(
        "notify_expense_confirmation, notify_monthly_summary, notify_daily_summary, notify_weekly_summary, notify_budget_alert, notify_weekly_tip, notify_inactivity, whatsapp_phone",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      notify_expense_confirmation: data?.notify_expense_confirmation ?? true,
      notify_monthly_summary: data?.notify_monthly_summary ?? true,
      notify_daily_summary: data?.notify_daily_summary ?? true,
      notify_weekly_summary: data?.notify_weekly_summary ?? true,
      notify_budget_alert: data?.notify_budget_alert ?? true,
      notify_weekly_tip: data?.notify_weekly_tip ?? true,
      notify_inactivity: data?.notify_inactivity ?? true,
      whatsapp_phone: data?.whatsapp_phone ?? null,
    };
  });
