// Cron: 00 UTC diário (21h Brasília). Envia resumo do dia para usuários
// com WhatsApp vinculado e notify_daily_summary = true. Só envia se houver
// lançamentos no dia.

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

export const Route = createFileRoute("/api/public/hooks/whatsapp-daily-summary")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || provided !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWhatsAppText } = await import("@/lib/whatsapp-notify.server");

        // Dia de referência: hoje em Brasília (UTC-3).
        const now = new Date();
        const brasilia = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        const y = brasilia.getUTCFullYear();
        const m = brasilia.getUTCMonth();
        const d = brasilia.getUTCDate();
        const dayStr = new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

        const { data: profiles, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id, whatsapp_phone, display_name")
          .not("whatsapp_phone", "is", null)
          .eq("notify_daily_summary", true);
        if (pErr) return json({ error: pErr.message }, 500);

        let sent = 0, skipped = 0, failed = 0;
        for (const p of profiles ?? []) {
          if (!p.whatsapp_phone) continue;
          const { data: rows, error } = await supabaseAdmin
            .from("expenses")
            .select("amount, category")
            .eq("user_id", p.user_id)
            .eq("expense_date", dayStr);
          if (error) { failed++; continue; }
          if (!rows || rows.length === 0) { skipped++; continue; }

          const total = rows.reduce((s, e) => s + Number(e.amount), 0);
          const byCat = new Map<string, number>();
          for (const e of rows) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
          const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
          const topLines = top.map(([c, v]) => `• ${c}: ${brl(v)}`).join("\n");

          const greeting = p.display_name ? `Boa noite, ${p.display_name.split(" ")[0]}!` : "Boa noite!";
          const body = `${greeting} 🌙\n\n📊 *Resumo de hoje*\n\n💰 Total: ${brl(total)}\n📦 ${rows.length} ${rows.length === 1 ? "lançamento" : "lançamentos"}\n\n${topLines}\n\nDurma tranquilo, seus gastos estão anotados. 💙`;

          const res = await sendWhatsAppText({ toPhone: p.whatsapp_phone, body });
          if (res.ok) sent++; else failed++;
        }

        return json({ ok: true, day: dayStr, sent, skipped, failed });
      },
    },
  },
});
