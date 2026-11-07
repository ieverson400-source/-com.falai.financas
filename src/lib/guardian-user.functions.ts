import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { guardianMonth, summarizeGuardian } from './guardian/summary';

export const getMyGuardian = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error: profileError } = await context.supabase.from('profiles').select('is_active').eq('user_id', context.userId).single();
    if (profileError || !profile?.is_active) throw new Error('Acesso temporariamente bloqueado.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const month = guardianMonth();
    const nextMonth = new Date(`${month}T12:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const [settingsRes, budgetsRes, historyRes, usageRes, stateRes] = await Promise.all([
      supabaseAdmin.from('guardian_settings').select('enabled, monthly_insight_limit, include_budget_alerts').eq('setting_key', 'global').single(),
      context.supabase.from('category_budgets').select('category, monthly_limit').eq('user_id', context.userId),
      context.supabase.from('guardian_analyses').select('id, recommendation, created_at, month').eq('user_id', context.userId).eq('status', 'completed').order('created_at', { ascending: false }).limit(10),
      context.supabase.from('guardian_analyses').select('id', { count: 'exact', head: true }).eq('user_id', context.userId).eq('month', month),
      supabaseAdmin.from('guardian_gateway_state').select('message').eq('blocked', true).limit(1),
    ]);
    for (const res of [settingsRes, budgetsRes, historyRes, usageRes, stateRes]) if (res.error) throw new Error('Não foi possível carregar o Guardião.');
    const expenses: { category: string; amount: number }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await context.supabase.from('expenses').select('category, amount').eq('user_id', context.userId).gte('expense_date', month).lt('expense_date', nextMonth.toISOString().slice(0, 10)).order('id').range(from, from + 999);
      if (error) throw new Error('Não foi possível carregar seus gastos.');
      expenses.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return { month, summary: summarizeGuardian(expenses, budgetsRes.data ?? []), enabled: settingsRes.data?.enabled ?? false, includeBudgetAlerts: settingsRes.data?.include_budget_alerts ?? false, limit: settingsRes.data?.monthly_insight_limit ?? 30, used: usageRes.count ?? 0, history: historyRes.data ?? [], blockedMessage: stateRes.data?.[0]?.message ?? null };
  });

export const generateMyGuardian = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase.from('profiles').select('is_active').eq('user_id', context.userId).single();
    if (!profile?.is_active) return { ok: false as const, message: 'Acesso temporariamente bloqueado.' };
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: settings, error } = await supabaseAdmin.from('guardian_settings').select('*').eq('setting_key', 'global').single();
    if (error || !settings?.enabled) return { ok: false as const, message: 'O Guardião está indisponível no momento.' };
    const { data: block } = await supabaseAdmin.from('guardian_gateway_state').select('message').eq('blocked', true).limit(1);
    if (block?.length) return { ok: false as const, message: block[0]?.message ?? 'Guardião temporariamente indisponível.' };
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) return { ok: false as const, message: 'A geração de recomendações ainda não está configurada.' };
    const month = guardianMonth();
    const next = new Date(`${month}T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
    const rows: { category: string; amount: number }[] = [];
    for (let from = 0; ; from += 1000) {
      const res = await context.supabase.from('expenses').select('category, amount').eq('user_id', context.userId).gte('expense_date', month).lt('expense_date', next.toISOString().slice(0, 10)).order('id').range(from, from + 999);
      if (res.error) return { ok: false as const, message: 'Não foi possível carregar seus gastos.' };
      rows.push(...(res.data ?? [])); if (!res.data || res.data.length < 1000) break;
    }
    if (!rows.length) return { ok: false as const, message: 'Registre gastos neste mês para receber recomendações.' };
    const budgets = settings.include_budget_alerts ? await context.supabase.from('category_budgets').select('category, monthly_limit').eq('user_id', context.userId) : { data: [], error: null };
    if (budgets.error) return { ok: false as const, message: 'Não foi possível carregar seus orçamentos.' };
    const { data: id, error: reserveError } = await supabaseAdmin.rpc('reserve_guardian_analysis', { p_user_id: context.userId });
    if (reserveError || !id) return { ok: false as const, message: reserveError?.message ?? 'Não foi possível iniciar a análise.' };
    try {
      const { recommendGuardian } = await import('./guardian/recommend.server');
      const recommendation = await recommendGuardian(apiKey, settings.model, settings.system_prompt, { month, ...summarizeGuardian(rows, budgets.data ?? []) });
      const saved = await supabaseAdmin.from('guardian_analyses').update({ status: 'completed', recommendation }).eq('id', id).eq('user_id', context.userId);
      if (saved.error) throw new Error('Não foi possível salvar a recomendação.');
      return { ok: true as const, recommendation };
    } catch (cause) {
      const err = cause as { statusCode?: number; responseBody?: string; message?: string };
      let message = err.message ?? 'Não foi possível concluir a análise.';
      try { const body = JSON.parse(err.responseBody ?? '{}'); message = body.message ?? body.error?.message ?? message; } catch { /* no response body */ }
      if ([401, 402, 403, 404].includes(err.statusCode ?? 0)) {
        await supabaseAdmin.from('guardian_gateway_state').upsert({ setting_key: err.statusCode === 403 ? 'denied' : 'paused', blocked: true, message });
      }
      await supabaseAdmin.from('guardian_analyses').update({ status: 'failed' }).eq('id', id).eq('user_id', context.userId);
      return { ok: false as const, message };
    }
  });