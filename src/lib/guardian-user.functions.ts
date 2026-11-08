import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GuardianCategory = { category: string; spent: number; limit: number | null; alert: "ok" | "near" | "over" | null };

export const getMyGuardianAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin.from("guardian_settings").select("*").eq("setting_key", "global").maybeSingle();
    if (!settings?.enabled) return { enabled: false as const, categories: [], recommendations: [] as string[], error: null };

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const [{ data: budgets }, { data: expenses }] = await Promise.all([
      context.supabase.from("category_budgets").select("category, monthly_limit").eq("user_id", context.userId),
      context.supabase.from("expenses").select("category, amount").eq("user_id", context.userId).gte("expense_date", monthStart),
    ]);
    const spent: Record<string, number> = {};
    (expenses ?? []).forEach((e) => { spent[e.category] = (spent[e.category] ?? 0) + Number(e.amount); });
    const limits: Record<string, number> = {};
    (budgets ?? []).forEach((b) => { limits[b.category] = Number(b.monthly_limit); });
    const cats = Array.from(new Set([...Object.keys(spent), ...Object.keys(limits)]));
    const categories: GuardianCategory[] = cats.map((c) => {
      const s = Math.round((spent[c] ?? 0) * 100) / 100;
      const l = limits[c] ?? null;
      const alert = !settings.include_budget_alerts || !l ? null : s > l ? "over" : s >= l * 0.8 ? "near" : "ok";
      return { category: c, spent: s, limit: l, alert };
    }).sort((a, b) => b.spent - a.spent);

    if (categories.length === 0) return { enabled: true as const, categories, recommendations: [], error: null };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { enabled: true as const, categories, recommendations: [], error: "IA indisponível no momento." };
    // Privacy: only category totals and limits are sent to the AI.
    const payload = categories.map((c) => ({ categoria: c.category, gasto: c.spent, limite: c.limit, alerta: c.alert }));
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: "system", content: `${settings.system_prompt}\nResponda apenas com até 5 recomendações curtas em português, uma por linha, sem numeração.` },
            { role: "user", content: `Totais do mês atual por categoria (R$): ${JSON.stringify(payload)}` },
          ],
        }),
      });
      if (!res.ok) {
        console.error("guardian ai", res.status, await res.text());
        return { enabled: true as const, categories, recommendations: [], error: res.status === 429 ? "Muitas análises agora. Tente em instantes." : "Não foi possível analisar agora." };
      }
      const json = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "";
      const recommendations = text.split("\n").map((l) => l.replace(/^[-*•\d.\s]+/, "").trim()).filter(Boolean).slice(0, 5);
      return { enabled: true as const, categories, recommendations, error: null };
    } catch (e) {
      console.error("guardian ai", e);
      return { enabled: true as const, categories, recommendations: [], error: "Não foi possível analisar agora." };
    }
  });
