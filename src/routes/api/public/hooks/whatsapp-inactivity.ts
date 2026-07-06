// Cron diário 22 UTC (19h Brasília). Se o usuário passou 5+ dias sem
// registrar gastos e não recebeu lembrete nos últimos 7 dias, envia
// um cutuque amigável e atualiza last_inactivity_reminder_at.

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

const INACTIVE_DAYS = 5;
const REMINDER_COOLDOWN_DAYS = 7;

export const Route = createFileRoute("/api/public/hooks/whatsapp-inactivity")({
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
        const cooldown = new Date(now.getTime() - REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
        const thresholdDate = new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
        const thresholdStr = thresholdDate.toISOString().slice(0, 10);

        const { data: profiles, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id, whatsapp_phone, display_name, last_inactivity_reminder_at")
          .not("whatsapp_phone", "is", null)
          .eq("notify_inactivity", true);
        if (pErr) return json({ error: pErr.message }, 500);

        let sent = 0, skipped = 0, failed = 0;
        for (const p of profiles ?? []) {
          if (!p.whatsapp_phone) continue;
          if (p.last_inactivity_reminder_at) {
            const last = new Date(p.last_inactivity_reminder_at);
            if (last > cooldown) { skipped++; continue; }
          }

          const { data: recent, error } = await supabaseAdmin
            .from("expenses")
            .select("id, expense_date")
            .eq("user_id", p.user_id)
            .gte("expense_date", thresholdStr)
            .limit(1);
          if (error) { failed++; continue; }
          if (recent && recent.length > 0) { skipped++; continue; }

          const greeting = p.display_name ? `Ei, ${p.display_name.split(" ")[0]}!` : "Ei!";
          const body = `${greeting} 👋\n\nFaz alguns dias que você não registra nada no Falaí. Tudo bem?\n\nSe rolou algum gasto essa semana, manda um áudio rápido pra gente organizar. Se estiver economizando, parabéns! 💪💙`;

          const res = await sendWhatsAppText({ toPhone: p.whatsapp_phone, body });
          if (res.ok) {
            sent++;
            await supabaseAdmin
              .from("profiles")
              .update({ last_inactivity_reminder_at: now.toISOString() })
              .eq("user_id", p.user_id);
          } else {
            failed++;
          }
        }

        return json({ ok: true, sent, skipped, failed });
      },
    },
  },
});
