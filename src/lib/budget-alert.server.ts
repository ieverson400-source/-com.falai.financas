// Server-only: envia alerta de orçamento por WhatsApp quando um gasto
// leva a categoria a cruzar 80% ou 100% do limite mensal definido pelo
// usuário em category_budgets. Best-effort — falhas são ignoradas.

import { sendWhatsAppText } from "@/lib/whatsapp-notify.server";

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}

export async function maybeSendBudgetAlert(args: {
  userId: string;
  category: string;
  expenseDate: string; // YYYY-MM-DD
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Perfil (telefone + preferência)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("whatsapp_phone, notify_budget_alert, display_name")
      .eq("user_id", args.userId)
      .maybeSingle();
    if (!profile?.whatsapp_phone || !profile.notify_budget_alert) return;

    // Orçamento da categoria
    const { data: budget } = await supabaseAdmin
      .from("category_budgets")
      .select("monthly_limit")
      .eq("user_id", args.userId)
      .eq("category", args.category)
      .maybeSingle();
    if (!budget) return;
    const limit = Number(budget.monthly_limit);
    if (!(limit > 0)) return;

    // Primeiro dia do mês do gasto (chave de idempotência)
    const [y, m] = args.expenseDate.split("-").map(Number);
    const monthStart = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const nextMonth = new Date(Date.UTC(y, (m ?? 1), 1));
    const nextMonthStr = nextMonth.toISOString().slice(0, 10);

    // Total gasto na categoria no mês
    const { data: rows } = await supabaseAdmin
      .from("expenses")
      .select("amount")
      .eq("user_id", args.userId)
      .eq("category", args.category)
      .gte("expense_date", monthStartStr)
      .lt("expense_date", nextMonthStr);
    const total = (rows ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const pct = (total / limit) * 100;

    let threshold: 80 | 100 | null = null;
    if (pct >= 100) threshold = 100;
    else if (pct >= 80) threshold = 80;
    if (!threshold) return;

    // Idempotência: já mandou esse alerta neste mês?
    const { data: existing } = await supabaseAdmin
      .from("budget_alerts_sent")
      .select("id")
      .eq("user_id", args.userId)
      .eq("category", args.category)
      .eq("month", monthStartStr)
      .eq("threshold", threshold)
      .maybeSingle();
    if (existing) return;

    const greeting = profile.display_name
      ? `${profile.display_name.split(" ")[0]},`
      : "Ei,";
    const body =
      threshold === 100
        ? `🚨 ${greeting} você estourou o orçamento de *${args.category}* neste mês.\n\n💸 Gasto: ${brl(total)}\n🎯 Limite: ${brl(limit)}\n📊 ${pct.toFixed(0)}% do teto\n\nQue tal pausar por uns dias?`
        : `⚠️ ${greeting} atenção no orçamento de *${args.category}*.\n\n💸 Gasto: ${brl(total)}\n🎯 Limite: ${brl(limit)}\n📊 ${pct.toFixed(0)}% do teto\n\nAinda dá pra segurar o mês.`;

    const res = await sendWhatsAppText({
      toPhone: profile.whatsapp_phone,
      body,
    });
    if (res.ok) {
      await supabaseAdmin.from("budget_alerts_sent").insert({
        user_id: args.userId,
        category: args.category,
        month: monthStartStr,
        threshold,
      });
    }
  } catch (e) {
    console.error("maybeSendBudgetAlert failed", e);
  }
}
