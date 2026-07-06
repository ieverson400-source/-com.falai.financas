
## Objetivo

Tornar o WhatsApp o canal central do app. Todo usuário novo vincula o número antes de usar qualquer tela; a partir daí o app envia automaticamente boas-vindas, confirmação de cada gasto, resumo diário/semanal/mensal, alertas de orçamento, dica financeira semanal com IA e lembrete se ficar dias sem lançar.

## O que muda para o usuário

1. **Onboarding obrigatório**: ao entrar no app pela primeira vez sem WhatsApp vinculado, cai numa tela dedicada `/app/onboarding-whatsapp`. Não é possível navegar para Home, Bancos, Recarga etc. até salvar um número válido. Ao salvar, dispara a mensagem de boas-vindas e libera o app.
2. **Boas-vindas** (já existe, fica automática no onboarding).
3. **Confirmação de gasto** (já existe, passa a vir ativada por padrão).
4. **Resumo diário** — todo dia 21h (Brasília): total do dia + top 3 categorias. Só envia se houver lançamentos.
5. **Resumo semanal** — toda segunda 8h: total, nº de lançamentos, top 3 categorias e variação vs semana anterior.
6. **Resumo mensal** (já existe).
7. **Alerta de orçamento** — quando um gasto criado leva a categoria a ultrapassar 80% e 100% da meta mensal do usuário (usa a tabela de metas já existente / a criar se não houver).
8. **Dica financeira semanal com IA** — toda sexta 18h: manda 2-3 frases personalizadas a partir dos gastos da semana, via Lovable AI (`google/gemini-2.5-flash`).
9. **Lembrete de inatividade** — se o usuário passa 5 dias sem registrar nada, recebe um cutuque amigável (no máximo 1 por semana).

## O que sai / fica escondido

- Card avançado atual em `app/conectar-whatsapp` (com logs de envio, "testar envio real", diagnósticos, mapeamentos, inbox) deixa de ser a porta de entrada. Fica acessível só em `/app/conectar-whatsapp` como página de configuração/diagnóstico (link discreto nas configurações), sem alterar seu comportamento.
- Toggles individuais somem do onboarding. Todas as notificações vêm ligadas por padrão; usuário desliga na página de configuração.

## Estrutura técnica

### Rotas
- `src/routes/app.onboarding-whatsapp.tsx` (novo) — tela dedicada, minimalista: título, campo telefone (com `normalizeWhatsAppPhone`), botão salvar. Redireciona pra `/app/home` ao concluir.
- Guard em `src/routes/_authenticated/route.tsx` (ou wrapper equivalente): após validar sessão, checa `profiles.whatsapp_phone`; se null → `redirect({ to: '/app/onboarding-whatsapp' })`. A própria rota do onboarding não é redirecionada.

### Banco (migração)
- `profiles`: adicionar coluna `notify_daily_summary boolean not null default true`, `notify_weekly_summary boolean not null default true`, `notify_budget_alert boolean not null default true`, `notify_weekly_tip boolean not null default true`, `notify_inactivity boolean not null default true`, `last_inactivity_reminder_at timestamptz`.
- Default dos toggles `notify_expense_confirmation` e `notify_monthly_summary` já é true; sem mudança.
- Nova tabela `budget_alerts_sent(user_id, category, month, threshold)` para não enviar o mesmo alerta 80%/100% duas vezes no mês. GRANTs + RLS por `auth.uid()`.
- Se o app ainda não tem tabela de metas por categoria: criar `category_budgets(user_id, category, monthly_limit numeric)` com RLS. (Confirmo antes de gerar.)

### Rotas cron (`/api/public/hooks/...`) — todas com header `apikey`
- `whatsapp-daily-summary.ts` — 21h Brasília (00 UTC).
- `whatsapp-weekly-summary.ts` — segunda 8h Brasília (11 UTC).
- `whatsapp-weekly-tip.ts` — sexta 18h Brasília (21 UTC), usa Lovable AI.
- `whatsapp-inactivity.ts` — diário 19h Brasília.
- `whatsapp-monthly-summary.ts` — já existe, mantém.

### Alerta de orçamento (tempo real)
- Novo helper server-only `maybeSendBudgetAlert(userId, category, month)` chamado após cada insert de expense (ao criar gasto por chat, áudio, manual, WhatsApp, spreadsheet, receipt).
- Compara soma do mês com `category_budgets.monthly_limit`; se cruzou 80% ou 100% e ainda não avisou no mês, envia WhatsApp e grava em `budget_alerts_sent`.

### Provedor
Mantém Twilio via `src/lib/whatsapp-notify.server.ts` (já usa `TWILIO_MESSAGING_SERVICE_SID`/`TWILIO_WHATSAPP_FROM`).

### Página de configuração
`app/conectar-whatsapp` passa a mostrar apenas: número atual, botão trocar, 6 switches (confirmação de gasto, resumo diário, semanal, mensal, alerta de orçamento, dica IA, inatividade). Cards de diagnóstico/inbox/mapping ficam num `<details>` "Ferramentas avançadas".

## Cron scheduling

Cria com `supabase--insert` chamando `cron.schedule` para os 4 novos jobs, usando a URL `https://project--724889f1-e026-4a50-8f4a-842975d93e05.lovable.app/api/public/hooks/...` e `apikey` = anon key.

## Fora do escopo agora

- Não vamos mexer no fluxo Z-API existente (o webhook `/api/public/zapi` fica como está).
- Não vamos remover código das antigas funções `whatsapp-*` para não quebrar a página avançada — apenas escondê-las.

## Perguntas antes de começar

1. **Metas por categoria já existem?** Vi `goal-highlight` no código mas não uma tabela de orçamento mensal por categoria. Posso criar `category_budgets` do zero? (Sem ela o alerta de orçamento não tem como funcionar.)
2. **Onboarding pode pular telefone estrangeiro?** Assumo aceitar qualquer DDI válido (função `normalizeWhatsAppPhone` já cuida disso). Ok?

Responda "pode ir" (ou aponte ajustes) que eu implemento tudo numa sequência: migração → guard + rota onboarding → 4 rotas cron + hook de alerta → agendamento no cron → limpeza da página de configuração.
