-- =============================================================================
-- PROPOSTA DE ESQUEMA: recarga de celular por PIX (Celcoin BaaS v2)
--
-- *** NÃO É UMA MIGRAÇÃO. NÃO APLICAR. ***
--   * Este arquivo fica em docs/ de propósito. Não mover para supabase/migrations/
--     sem aprovação explícita (o Lovable/Supabase pode aplicar esse diretório).
--   * Só cria objetos NOVOS com prefixo recharge_ / celcoin_. Não referencia, não
--     altera e não remove nenhuma tabela existente (inclui `recargas` e
--     `recarga_settings`, que permanecem como estão).
--   * Depende apenas de objetos que já existem: auth.users, public.has_role(uuid, app_role).
--
-- Convenções:
--   * Valores monetários em centavos (integer). Nunca float.
--   * Só a service role (servidor) escreve. Clientes autenticados apenas LEEM,
--     filtrados por RLS. Não há política de INSERT/UPDATE/DELETE para clientes.
--   * A lista de transições abaixo deve ser idêntica a src/lib/recharge/state-machine.ts
--     (rules.test.ts compara as duas).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilitário: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.recharge_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. recharge_settings: linha única, controlada pelo admin
-- ---------------------------------------------------------------------------
create table public.recharge_settings (
  id boolean primary key default true check (id),            -- garante linha única
  enabled boolean not null default false,                    -- tudo nasce desligado
  min_cents integer not null default 1000 check (min_cents > 0),
  max_cents integer not null default 20000 check (max_cents >= min_cents),
  fee_bps integer not null default 0 check (fee_bps between 0 and 5000),   -- 100 bps = 1%
  fee_fixed_cents integer not null default 0 check (fee_fixed_cents >= 0),
  daily_limit_per_user_cents integer not null default 50000 check (daily_limit_per_user_cents > 0),
  pix_expiry_minutes integer not null default 15 check (pix_expiry_minutes between 1 and 1440),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.recharge_settings (id) values (true);

create trigger recharge_settings_touch
before update on public.recharge_settings
for each row execute function public.recharge_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. recharge_orders: pedido e máquina de estados
-- ---------------------------------------------------------------------------
create table public.recharge_orders (
  id uuid primary key default gen_random_uuid(),            -- também é o clientRequestId da recarga
  user_id uuid not null references auth.users(id),
  phone_country_code smallint not null default 55,
  phone_state_code smallint not null check (phone_state_code between 11 and 99),
  phone_number text not null check (phone_number ~ '^[0-9]{8,9}$'),
  provider_id integer not null check (provider_id > 0),
  operator_name text,
  amount_cents integer not null check (amount_cents > 0),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  total_cents integer not null,
  status text not null default 'pix_pending' check (status in (
    'pix_pending', 'pix_expired', 'pix_confirmed',
    'topup_submitting', 'topup_pending', 'topup_done', 'topup_failed',
    'needs_review', 'closed'
  )),
  review_reason text check (review_reason is null or review_reason in (
    'amount_mismatch', 'receiver_mismatch', 'late_payment', 'unknown_pix_status',
    'topup_error', 'topup_unknown_status', 'topup_timeout', 'topup_not_found',
    'provider_validation_error', 'manual'
  )),
  last_error text,                                           -- mensagem curta, sem segredos
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recharge_orders_total_ck check (total_cents = amount_cents + fee_cents),
  constraint recharge_orders_review_ck check (
    (status = 'needs_review') = (review_reason is not null) or status = 'closed'
  )
);

create index recharge_orders_user_created_idx
  on public.recharge_orders (user_id, created_at desc);
-- Fila da reconciliação: só estados não terminais
create index recharge_orders_open_idx
  on public.recharge_orders (status, updated_at)
  where status in ('pix_pending', 'topup_submitting', 'topup_pending', 'needs_review');

create trigger recharge_orders_touch
before update on public.recharge_orders
for each row execute function public.recharge_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. recharge_pix_charges: cobrança PIX (provedor ainda a definir)
-- ---------------------------------------------------------------------------
create table public.recharge_pix_charges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.recharge_orders(id) on delete restrict,
  provider_charge_id text unique,                            -- id da cobrança no provedor
  txid text unique,                                          -- identificação da transação PIX
  end_to_end_id text unique,                                 -- EndToEndId do pagamento (deduplicação)
  amount_cents integer not null check (amount_cents > 0),
  paid_amount_cents integer check (paid_amount_cents is null or paid_amount_cents > 0),
  receiver_key text not null,                                -- chave que deve receber
  emv text,                                                  -- copia e cola (retornado pelo provedor)
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'expired', 'canceled')),
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger recharge_pix_charges_touch
before update on public.recharge_pix_charges
for each row execute function public.recharge_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. recharge_topups: no máximo UMA recarga por pedido
-- ---------------------------------------------------------------------------
create table public.recharge_topups (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.recharge_orders(id) on delete restrict,
  client_request_id text not null unique
    check (char_length(client_request_id) between 1 and 200),  -- limite da Celcoin: 200
  provider_topup_id text unique,                             -- id retornado pela Celcoin
  provider_status text,                                      -- INITIATED | PROCESSING | CONFIRMED | ERROR
  provider_error_code text,
  account_used text,                                         -- conta BaaS usada (sem segredos)
  response_redacted jsonb,                                   -- resposta sem PIN, sem tokens
  submitted_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger recharge_topups_touch
before update on public.recharge_topups
for each row execute function public.recharge_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. celcoin_events: webhooks recebidos (idempotência por event_key)
-- ---------------------------------------------------------------------------
create table public.celcoin_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,                            -- ex.: EndToEndId, ou hash do corpo
  entity text,                                               -- tipo do evento informado
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result text
);

create index celcoin_events_unprocessed_idx
  on public.celcoin_events (received_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- 6. recharge_audit: trilha append-only
-- ---------------------------------------------------------------------------
create table public.recharge_audit (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.recharge_orders(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor text not null,                                       -- system | webhook | reconcile | admin:<uuid>
  detail jsonb,
  at timestamptz not null default now()
);

create index recharge_audit_order_idx on public.recharge_audit (order_id, at);

create or replace function public.recharge_audit_block_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'recharge_audit is append-only';
end;
$$;

create trigger recharge_audit_no_update
before update or delete on public.recharge_audit
for each row execute function public.recharge_audit_block_mutation();

-- ---------------------------------------------------------------------------
-- 7. Transição atômica e auditada (única via de mudança de status)
--    A lista de pares e as regras de ator espelham state-machine.ts.
-- ---------------------------------------------------------------------------
create or replace function public.recharge_transition(
  p_order_id uuid,
  p_from text,
  p_to text,
  p_actor text,
  p_review_reason text default null,
  p_detail jsonb default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
  v_pair text := p_from || '>' || p_to;
  v_kind text := split_part(p_actor, ':', 1);
  v_allowed constant text[] := array[
    'pix_pending>pix_confirmed',
    'pix_pending>pix_expired',
    'pix_pending>needs_review',
    'pix_expired>needs_review',
    'pix_confirmed>topup_submitting',
    'pix_confirmed>needs_review',
    'topup_submitting>topup_pending',
    'topup_submitting>topup_done',
    'topup_submitting>topup_failed',
    'topup_submitting>needs_review',
    'topup_pending>topup_done',
    'topup_pending>topup_failed',
    'topup_pending>needs_review',
    'topup_failed>needs_review',
    'needs_review>topup_submitting',
    'needs_review>topup_done',
    'needs_review>closed'
  ];
  v_admin_only constant text[] := array[
    'needs_review>topup_submitting',
    'needs_review>closed'
  ];
  v_admin_or_reconcile constant text[] := array[
    'needs_review>topup_done'
  ];
begin
  if not (v_pair = any (v_allowed)) then
    raise exception 'transition not allowed: %', v_pair;
  end if;

  if v_pair = any (v_admin_or_reconcile) then
    if v_kind not in ('admin', 'reconcile') then
      raise exception 'actor % may not perform %', p_actor, v_pair;
    end if;
  elsif v_pair = any (v_admin_only) then
    if v_kind <> 'admin' then
      raise exception 'actor % may not perform %', p_actor, v_pair;
    end if;
  elsif v_kind not in ('system', 'webhook', 'reconcile') then
    raise exception 'actor % may not perform %', p_actor, v_pair;
  end if;

  if p_to = 'needs_review' and p_review_reason is null then
    raise exception 'review reason required for needs_review';
  end if;

  -- Trava a linha: apenas um processo vence uma corrida (envio único da recarga).
  select status into v_current
    from public.recharge_orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'order not found';
  end if;
  if v_current <> p_from then
    raise exception 'stale transition: order is %, expected %', v_current, p_from;
  end if;

  update public.recharge_orders
     set status = p_to,
         review_reason = case when p_to = 'needs_review' then p_review_reason else null end
   where id = p_order_id;

  insert into public.recharge_audit (order_id, from_status, to_status, actor, detail)
  values (p_order_id, p_from, p_to, p_actor, p_detail);

  return p_to;
end;
$$;

revoke all on function public.recharge_transition(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.recharge_transition(uuid, text, text, text, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 8. RLS: leitura restrita; nenhuma escrita para clientes
-- ---------------------------------------------------------------------------
alter table public.recharge_settings   enable row level security;
alter table public.recharge_orders     enable row level security;
alter table public.recharge_pix_charges enable row level security;
alter table public.recharge_topups     enable row level security;
alter table public.celcoin_events      enable row level security;
alter table public.recharge_audit      enable row level security;

-- Defesa em profundidade: sem privilégios de tabela para anon; só SELECT para authenticated.
revoke all on public.recharge_settings, public.recharge_orders, public.recharge_pix_charges,
              public.recharge_topups, public.celcoin_events, public.recharge_audit
  from anon, authenticated;
grant select on public.recharge_settings, public.recharge_orders, public.recharge_pix_charges,
                public.recharge_topups, public.celcoin_events, public.recharge_audit
  to authenticated;

-- Pedidos: dono ou admin
create policy "recharge_orders: owner reads"
  on public.recharge_orders for select to authenticated
  using (auth.uid() = user_id);
create policy "recharge_orders: admin reads"
  on public.recharge_orders for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Cobranças PIX: dono do pedido ou admin
create policy "recharge_pix_charges: owner reads"
  on public.recharge_pix_charges for select to authenticated
  using (exists (
    select 1 from public.recharge_orders o
     where o.id = order_id and o.user_id = auth.uid()
  ));
create policy "recharge_pix_charges: admin reads"
  on public.recharge_pix_charges for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Recargas, eventos, auditoria e configurações: somente admin
create policy "recharge_topups: admin reads"
  on public.recharge_topups for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "celcoin_events: admin reads"
  on public.celcoin_events for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "recharge_audit: admin reads"
  on public.recharge_audit for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "recharge_settings: admin reads"
  on public.recharge_settings for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Sem políticas de INSERT/UPDATE/DELETE: a service role (servidor) ignora RLS e é
-- a única que escreve. Alterações de configuração pelo admin passarão por server
-- function com assertAdmin (etapa 4), não por escrita direta do cliente.
