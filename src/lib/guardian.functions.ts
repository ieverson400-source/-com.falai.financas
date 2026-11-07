import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/assert-admin";

export const GUARDIAN_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "openai/gpt-5-mini",
] as const;

const guardianSchema = z.object({
  enabled: z.boolean(),
  model: z.enum(GUARDIAN_MODELS),
  systemPrompt: z.string().trim().min(20).max(4000),
  monthlyInsightLimit: z.number().int().min(1).max(500),
  shareCategoryTotalsOnly: z.boolean(),
  includeBudgetAlerts: z.boolean(),
});

export const adminGetGuardianSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("guardian_settings").select("*").eq("setting_key", "global").single();
    if (error) throw error;
    return { settings: data };
  });

export const adminSaveGuardianSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => guardianSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("guardian_settings").upsert({
      setting_key: "global",
      enabled: data.enabled,
      model: data.model,
      system_prompt: data.systemPrompt,
      monthly_insight_limit: data.monthlyInsightLimit,
      share_category_totals_only: data.shareCategoryTotalsOnly,
      include_budget_alerts: data.includeBudgetAlerts,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "setting_key" });
    if (error) throw error;
    return { ok: true };
  });
