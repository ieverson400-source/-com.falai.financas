// Cron: segunda-feira 11 UTC (8h Brasília). Resumo da semana anterior
// (segunda→domingo) com total, nº de lançamentos, top 3 categorias e
// variação vs semana anterior. Só envia se houver lançamentos.

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
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/public/hooks/whatsapp-weekly-summary")({
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

        // Semana anterior em Brasília: segunda→domingo passados.
        const now = new Date();
        const brasilia = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        // Hoje é segunda. Início desta semana = hoje 00:00 UTC.
        const todayUTC = new Date(Date.UTC(
          brasilia.getUTCFullYear(), brasilia.getUTCMonth(), brasilia.getUTCDate(),
        ));
        const lastMon = new Date(todayUTC); lastMon.setUTCDate(todayUTC.getUTCDate() - 7);
        const lastSunEnd = new Date(todayUTC); // exclusivo
        const prevMon = new Date(lastMon); prevMon.setUTCDate(lastMon.getUTCDate() - 7);
        const startStr = iso(lastMon);
        const endStr = iso(lastSunEnd);
        const prevStartStr = iso(prevMon);
        const prevEndStr = iso(lastMon);

        const { data: profiles, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id, whatsapp_phone, display_name")
          .not("whatsapp_phone", "is", null)
          .eq("notify_weekly_summary", true);
        if (pErr) return json({ error: pErr.message }, 500);

        let sent = 0, skipped = 0, failed = 0;
        for (const p of profiles ?? []) {
          if (!p.whatsapp_phone) continue;
          const [thisWeek, prevWeek] = await Promise.all([
            supabaseAdmin.from("expenses").select("amount, category")
              .eq("user_id", p.user_id).gte("expense_date", startStr).lt("expense_date", endStr),
            supabaseAdmin.from("expenses").select("amount")
              .eq("user_id", p.user_id).gte("expense_date", prevStartStr).lt("expense_date", prevEndStr),
          ]);
          if (thisWeek.error) { failed++; continue; }
          const rows = thisWeek.data ?? [];
          if (rows.length === 0) { skipped++; continue; }

          const total = rows.reduce((s, e) => s + Number(e.amount), 0);
          const prevTotal = (prevWeek.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
          const byCat = new Map<string, number>();
          for (const e of rows) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
          const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
          const topLines = top.map(([c, v], i) => `${i + 1}. ${c}: ${brl(v)}`).join("\n");

          let compare = "";
          if (prevTotal > 0) {
            const diff = ((total - prevTotal) / prevTotal) * 100;
            const emoji = diff > 5 ? "📈" : diff < -5 ? "📉" : "➖";
            const label = diff > 0 ? `+${diff.toFixed(0)}%` : `${diff.toFixed(0)}%`;
            compare = `\n${emoji} ${label} vs semana anterior (${brl(prevTotal)})`;
          }

          const greeting = p.display_name ? `Bom dia, ${p.display_name.split(" ")[0]}!` : "Bom dia!";
          const body = `${greeting} ☕\n\n📊 *Sua semana em números*\n\n💰 Total: ${brl(total)}\n📦 ${rows.length} lançamentos${compare}\n\nTop categorias:\n${topLines}\n\nBoa semana! 💙`;

          const res = await sendWhatsAppText({ toPhone: p.whatsapp_phone, body });
          if (res.ok) sent++; else failed++;
        }

        return json({ ok: true, week_start: startStr, sent, skipped, failed });
      },
    },
  },
});
