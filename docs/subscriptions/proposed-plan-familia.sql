-- =============================================================================
-- PROPOSTA: permitir o plano 'familia' na tabela public.subscriptions
--
-- *** NÃO É UMA MIGRAÇÃO. NÃO APLICAR sem aprovação explícita. ***
--   * Fica em docs/ de propósito (não em supabase/migrations/).
--   * Não cria tabela nova: a tabela public.subscriptions JÁ EXISTE e é reutilizável.
--
-- Diagnóstico (a partir de supabase/migrations/20260602231820_*.sql e types.ts):
--   Colunas existentes: id, user_id (UNIQUE), plan, status, provider, provider_product_id,
--     provider_subscription_id, purchase_token, current_period_end, cancel_at_period_end, raw,
--     created_at, updated_at.
--   RLS: SELECT somente do próprio usuário (auth.uid() = user_id). Sem política de escrita:
--     só a service role (servidor) escreve. Já atende ao requisito "escrita só do servidor".
--   provider: CHECK IN ('play', 'stripe', 'manual')  -> já existe o campo provider.
--
-- Único problema encontrado:
--   plan: CHECK (plan IN ('free', 'pro', 'premium'))  -> NÃO aceita 'familia'.
--   O código do servidor (play-billing.server.ts e o webhook do Stripe) grava plan = 'familia',
--   o que seria recusado pela restrição se o banco real estiver como na migração.
--
-- ANTES de aplicar, confirmar o estado REAL do banco (somente leitura):
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.subscriptions'::regclass and contype = 'c';
-- Se a restrição já incluir 'familia', nada precisa ser feito.
-- =============================================================================

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'pro', 'premium', 'familia'));

-- -----------------------------------------------------------------------------
-- Provedor "google_play_pwa" (Google Play Billing + Digital Goods API, TWA/PWABuilder)
--
-- Hoje: provider CHECK IN ('play', 'stripe', 'manual'), DEFAULT 'play'.
-- O servidor existente grava provider = 'play' explicitamente (play-billing.server.ts), então
-- linhas e código atuais continuam válidos. A proposta MANTÉM 'play' e acrescenta o novo valor,
-- com o novo padrão pedido. Quando a integração real for feita, o código do servidor precisará
-- passar a gravar 'google_play_pwa' (alteração em arquivo existente, não feita agora).
-- O nome 'subscriptions_provider_check' é o gerado pelo PostgreSQL; confirmar com a consulta acima.
-- -----------------------------------------------------------------------------
alter table public.subscriptions
  drop constraint if exists subscriptions_provider_check;

alter table public.subscriptions
  add constraint subscriptions_provider_check
  check (provider in ('play', 'google_play_pwa', 'stripe', 'manual'));

alter table public.subscriptions
  alter column provider set default 'google_play_pwa';

-- Observações:
--   * Não altera nenhum dado existente: todas as linhas atuais continuam válidas.
--   * Não mexe em RLS, índices, nem nas tabelas pluggy_*.
--   * O nome 'subscriptions_plan_check' é o que o PostgreSQL gera para uma restrição CHECK de coluna;
--     confirmar com a consulta acima (se o nome for outro, ajustar o DROP).
--   * 'pending' (exibido na UI) NÃO é um estado da tabela: hoje seria derivado de status
--     ('in_grace_period', 'on_hold' etc.). Decisão de produto pendente.
