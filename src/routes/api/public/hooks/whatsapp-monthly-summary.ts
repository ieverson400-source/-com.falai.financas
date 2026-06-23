// Cron-triggered route that sends a WhatsApp monthly summary to every
// user with a linked phone and notify_monthly_summary = true.
// Auth: requires Supabase anon key in the `apikey` header.

import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, authorization",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export const Route = createFileRoute("/api/public/hooks/whatsapp-monthly-summary")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const expectedKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        const providedKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expectedKey || providedKey !== expectedKey) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendWhatsAppText } = await import("@/lib/whatsapp-notify.server");

        // Mês anterior em horário de Brasília (UTC-3, sem DST).
        const now = new Date();
        const brasilia = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        const refMonth = brasilia.getUTCMonth() - 1;
        const year = refMonth < 0 ? brasilia.getUTCFullYear() - 1 : brasilia.getUTCFullYear();
        const month = (refMonth + 12) % 12;
        const start = new Date(Date.UTC(year, month, 1));
        const end = new Date(Date.UTC(year, month + 1, 1));
        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);
        const monthLabel = start.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });

        const { data: profiles, error: profilesError } = await supabaseAdmin
          .from("profiles")
          .select("user_id, whatsapp_phone, display_name")
          .not("whatsapp_phone", "is", null)
          .eq("notify_monthly_summary", true);

        if (profilesError) {
          console.error("monthly-summary profilesError", profilesError.message);
          return jsonResponse({ error: profilesError.message }, 500);
        }

        let sent = 0;
        let skipped = 0;
        let failed = 0;

        for (const p of profiles ?? []) {
          if (!p.whatsapp_phone) continue;
          const { data: expenses, error: expError } = await supabaseAdmin
            .from("expenses")
            .select("amount, category")
            .eq("user_id", p.user_id)
            .gte("expense_date", startStr)
            .lt("expense_date", endStr);

          if (expError) {
            console.error("monthly-summary expError", p.user_id, expError.message);
            failed++;
            continue;
          }

          const rows = expenses ?? [];
          if (rows.length === 0) {
            skipped++;
            continue;
          }

          const total = rows.reduce((s, e) => s + Number(e.amount), 0);
          const byCat = new Map<string, number>();
          for (const e of rows) {
            byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
          }
          const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
          const topLines = top
            .map(([c, v], i) => `${i + 1}. ${c}: ${brl(v)}`)
            .join("\n");

          const greeting = p.display_name ? `Olá, ${p.display_name.split(" ")[0]}!` : "Olá!";
          const body = `${greeting} 📊\n\nResumo de ${monthLabel}\n\n💰 Total: ${brl(total)}\n📦 Lançamentos: ${rows.length}\n\nTop categorias:\n${topLines}\n\nAbra o app para ver detalhes e dicas. 💙`;

          const res = await sendWhatsAppText({ toPhone: p.whatsapp_phone, body });
          if (res.ok) sent++;
          else failed++;
        }

        return jsonResponse({ ok: true, sent, skipped, failed, month: monthLabel });
      },
    },
  },
});
