-- =============================================================================
-- PROPOSTAS DE BANCO: (A) push de reajuste/cobrança nova  e  (B) entradas (receitas)
--
-- *** NÃO É UMA MIGRAÇÃO. NÃO APLICAR sem aprovação explícita. ***
--   * Fica em docs/ de propósito (não em supabase/migrations/).
--   * Cada parte é independente: pode aprovar só uma.
--   * Não altera tabelas existentes nem as tabelas pluggy_*.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A) Push de reajuste de assinatura / nova cobrança recorrente
--
-- O que o app já faz sem isto: avisa DENTRO do app, quando o usuário abre (PriceChangeAlerts).
-- Para avisar com o app fechado (push) é preciso, além desta tabela, um processo no servidor:
--   1. uma rotina agendada (Cloudflare Cron ou pg_cron chamando uma rota protegida por segredo,
--      como já ocorre nos resumos automáticos) que, para cada usuário, lê os gastos com a service
--      role, detecta reajustes (mesma lógica de src/lib/insights/recurring.ts) e envia o push pelo
--      Firebase já usado no app (tabela push_tokens);
--   2. esta tabela, para nunca avisar duas vezes a mesma cobrança.
-- Atenção de privacidade: a rotina lê os gastos de TODOS os usuários no servidor. Vale informar na
-- política de privacidade e permitir que o usuário desative esses avisos.
-- -----------------------------------------------------------------------------
create table public.recurring_alerts_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_key text not null,                         -- ex.: 'netflix|2026-10-10' (nome + data da última cobrança)
  kind text not null check (kind in ('price_increase', 'new_recurring')),
  sent_at timestamptz not null default now(),
  unique (user_id, alert_key, kind)
);

create index recurring_alerts_sent_user_idx on public.recurring_alerts_sent (user_id, sent_at desc);

alter table public.recurring_alerts_sent enable row level security;
revoke all on public.recurring_alerts_sent from anon, authenticated;
grant select on public.recurring_alerts_sent to authenticated;
-- O usuário só lê os próprios avisos; ninguém escreve pelo cliente (só a service role, no servidor).
create policy "recurring_alerts_sent: owner reads"
  on public.recurring_alerts_sent for select to authenticated
  using (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- B) Entradas (receitas)
--
-- Hoje o app registra só gastos: expenses tem CHECK (amount >= 0) e não há coluna de tipo, e o
-- cartão "Fluxo de caixa" mostra Entradas fixo em R$ 0,00. O AGENTS.md também registra que os totais
-- financeiros usam apenas gastos; aprovar esta parte muda essa regra.
-- Tabela separada (em vez de misturar em expenses) para não alterar nenhum total, gráfico ou
-- relatório existente. Depois da migração seria preciso: tela/botão para lançar entrada, o cartão de
-- Fluxo de caixa, e a projeção do mês passar a mostrar o saldo previsto (entradas - gastos).
-- -----------------------------------------------------------------------------
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  description text,
  income_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'notification')),
  created_at timestamptz not null default now()
);

create index incomes_user_date_idx on public.incomes (user_id, income_date desc);

alter table public.incomes enable row level security;

create policy "incomes: owner select" on public.incomes
  for select using (auth.uid() = user_id);
create policy "incomes: owner insert" on public.incomes
  for insert with check (auth.uid() = user_id);
create policy "incomes: owner update" on public.incomes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "incomes: owner delete" on public.incomes
  for delete using (auth.uid() = user_id);
