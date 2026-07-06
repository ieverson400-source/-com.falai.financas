// Cron: sexta 21 UTC (18h Brasília). Dica financeira semanal gerada
// por IA (Lovable AI Gateway) baseada nos gastos dos últimos 7 dias.

import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

async function generateTip(input: {
  name: string | null;
  total: number;
  count: number;
  topCategories: Array<[string, number]>;
}): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const fallback =
    input.topCategories.length > 0
      ? `💡 *Dica da semana*\n\nVocê gastou ${brl(input.total)} nos últimos 7 dias, com destaque em *${input.topCategories[0][0]}*. Que tal definir um teto pra essa categoria e acompanhar durante a próxima semana? Pequenos limites geram grandes economias. 💙`
      : `💡 *Dica da semana*\n\nSemana calma nos gastos! Aproveite pra revisar seus objetivos e planejar o próximo mês. 💙`;

  if (!apiKey) return fallback;

  const catsStr = input.topCategories
    .map(([c, v]) => `${c}: ${brl(v)}`)
    .join(", ") || "nenhum gasto significativo";
  const prompt = `Você é um assistente financeiro brasileiro amigável. Gere uma dica curta (máx 3 frases, use "você") baseada nos gastos da semana do usuário${input.name ? ` ${input.name}` : ""}: total ${brl(input.total)}, ${input.count} lançamentos, top categorias: ${catsStr}. Seja concreto, sem clichês. Não repita os números — traga um insight ou ação prática. Comece com um emoji apropriado.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você responde em português brasileiro, tom acolhedor, curto e direto." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const tip = payload.choices?.[0]?.message?.content?.trim();
    if (!tip) return fallback;
    return `💡 *Dica da semana*\n\n${tip}`;
  } catch {
    return fallback;
  }
}

export const Route = createFileRoute("/api/public/hooks/whatsapp-weekly-tip")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || provided !== expected) return json({ error: "Unauthorized" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWhatsAppText } = await import("@/lib/whatsapp-notify.server");

        const now = new Date();
        const brasilia = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        const today = new Date(Date.UTC(
          brasilia.getUTCFullYear(), brasilia.getUTCMonth(), brasilia.getUTCDate(),
        ));
        const start = new Date(today); start.setUTCDate(today.getUTCDate() - 7);
        const startStr = start.toISOString().slice(0, 10);
        const endStr = today.toISOString().slice(0, 10);

        const { data: profiles, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id, whatsapp_phone, display_name")
          .not("whatsapp_phone", "is", null)
          .eq("notify_weekly_tip", true);
        if (pErr) return json({ error: pErr.message }, 500);

        let sent = 0, skipped = 0, failed = 0;
        for (const p of profiles ?? []) {
          if (!p.whatsapp_phone) continue;
          const { data: rows, error } = await supabaseAdmin
            .from("expenses")
            .select("amount, category")
            .eq("user_id", p.user_id)
            .gte("expense_date", startStr)
            .lt("expense_date", endStr);
          if (error) { failed++; continue; }
          const total = (rows ?? []).reduce((s, e) => s + Number(e.amount), 0);
          if (!rows || rows.length === 0) { skipped++; continue; }
          const byCat = new Map<string, number>();
          for (const e of rows) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
          const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

          const body = await generateTip({
            name: p.display_name?.split(" ")[0] ?? null,
            total,
            count: rows.length,
            topCategories: top,
          });

          const res = await sendWhatsAppText({ toPhone: p.whatsapp_phone, body });
          if (res.ok) sent++; else failed++;
        }

        return json({ ok: true, sent, skipped, failed });
      },
    },
  },
});
