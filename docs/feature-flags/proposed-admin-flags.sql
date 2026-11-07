-- =============================================================================
-- PROPOSTA: permitir ligar/desligar recursos pelo painel admin (persistente)
--
-- *** NÃO É UMA MIGRAÇÃO. NÃO APLICAR sem aprovação explícita. ***
--   * Fica em docs/ de propósito (não em supabase/migrations/).
--   * Não cria tabela: reaproveita a linha 'global' de public.app_settings.
--
-- Por que precisa de migração:
--   public.app_settings só tem colunas fixas (maintenance_mode, registrations_enabled,
--   automatic_whatsapp_enabled, home_banner_text, ...). Não há onde gravar o estado de
--   assinaturas, Open Finance e recarga. Hoje esse estado vem de variáveis de ambiente do
--   servidor (SUBS_ENABLED, OF_ENABLED, RECHARGE_ENABLED) e o painel só o mostra.
--
-- RLS (já existente, não muda):
--   SELECT: qualquer pessoa lê a linha 'global'  -> estes três booleanos NÃO são segredo.
--   INSERT/UPDATE/DELETE: somente administradores (has_role).
-- =============================================================================

alter table public.app_settings
  add column if not exists subscriptions_enabled boolean not null default false,
  add column if not exists open_finance_enabled  boolean not null default false,
  add column if not exists recharge_enabled      boolean not null default false;

-- Observações:
--   * Padrão desligado: nenhum recurso é ligado pela migração. Linhas existentes ficam 'false'.
--   * Não altera dados, políticas nem as tabelas pluggy_*.
--   * Reversível: alter table public.app_settings drop column ... (se nada mais depender delas).
--
-- DECISÃO DE PRODUTO PENDENTE (precedência quando houver as duas fontes):
--   (a) o valor do banco manda e a variável de ambiente é só o padrão;
--   (b) a variável de ambiente é uma chave-mestra: o recurso só liga se AMBOS estiverem ligados
--       (mais conservador; permite desligar tudo sem acessar o painel).
--   Recomendação: (b). Em qualquer caso, o código do servidor e o painel precisarão ser
--   alterados depois da migração (adminSaveSettings, getFeatureFlags e os guardas de rota).
