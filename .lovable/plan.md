# Painel Administrativo Falaí Finanças

## Objetivo

Evoluir o painel administrativo existente para uma área completa em `/admin`, sem reconstruir o app e sem alterar o funcionamento de Open Finance, WhatsApp atual, Shop ou pagamentos.

## Decisões confirmadas

- A conta `ieverson400@gmail.com` será o primeiro administrador.
- O painel principal ficará em `/admin`; os endereços administrativos atuais continuarão funcionando por compatibilidade.
- A área de notificações será preparada para n8n, sem substituir Twilio/Z-API.
- Funções administrativas continuarão na tabela segura `user_roles`; não será criada coluna de função em `profiles`.
- O painel não aparecerá no menu inferior do aplicativo comum.

## Entregas

### 1. Segurança e dados

- Conceder a função `admin` à conta informada por uma migração segura e idempotente.
- Adicionar estado de acesso ativo/bloqueado ao perfil, sem apagar usuários ou transações.
- Criar tabelas administrativas para:
  - configurações globais do app;
  - modelos de mensagens;
  - registros de notificações preparados para n8n e compatíveis com os provedores atuais.
- Aplicar permissões de banco para que somente administradores leiam ou alterem esses dados.
- Manter `user_roles` + `has_role` como fonte única de permissões.

### 2. Estrutura do painel

- Criar layout protegido em `/admin` com barra lateral no computador e menu administrativo compacto no celular.
- Seções: Visão geral, Usuários, Anúncios, Notificações e Configurações.
- Exibir acesso negado para contas comuns e redirecionar visitantes sem sessão para o login.
- Preservar `/app/admin` e `/app/admin/ofertas`, encaminhando-os para as novas telas equivalentes.

### 3. Visão geral

- Cards com dados reais: total de usuários, ativos hoje, anúncios ativos, mensagens registradas e volume transacionado.
- Gráfico de crescimento de usuários nos últimos 30 dias.
- Resumo de saúde de Open Finance e notificações sem alterar as integrações.

### 4. Usuários

- Busca por nome ou e-mail.
- Lista com nome, e-mail, telefone, cadastro, saldo disponível e função.
- Modal de edição para promover/rebaixar função e bloquear/desbloquear acesso.
- Histórico financeiro somente leitura, paginado e protegido no servidor.
- Impedir que o administrador remova acidentalmente o próprio último acesso administrativo.

### 5. Anúncios

- Reutilizar o CRUD atual de `shop_offers`; não criar tabela `ads` duplicada.
- Manter criação, edição, exclusão, vigência, ativação e destaque no carrossel.
- Adicionar pré-visualização fiel do card antes de salvar.
- Trocar mensagens soltas por feedback visual consistente.

### 6. Notificações

- Lista de registros com data, usuário, tipo, provedor, status e erro.
- Preparar o modelo de dados e a interface para n8n; a conexão externa ficará pendente até existir URL e segredo compartilhado.
- Manter os registros e envios atuais de Twilio/Z-API intactos.
- Permitir reenvio somente quando houver conteúdo e destino válidos, sempre pelo servidor.
- CRUD de modelos de boas-vindas, resumo diário e resumo semanal.

### 7. Configurações

- Controles para manutenção, novos cadastros e notificações automáticas.
- Campo para o aviso exibido no início.
- Aplicar as regras globais nos pontos de entrada necessários, com exceção segura para administradores durante manutenção.

## Direção visual

- Tema escuro atual com verde/turquesa dos tokens existentes.
- Cards compactos, ícones Lucide, hierarquia clara e animações discretas.
- Tabelas adaptadas para cartões no celular, áreas de toque confortáveis e navegação separada do app comum.
- Reutilizar componentes de diálogo, formulário, tabela, seletor, gráfico e notificações já instalados.

## Verificação

- Testar acesso como administrador, usuário comum e visitante.
- Validar busca, alteração de função, bloqueio, histórico, CRUD e prévia de anúncios, modelos e configurações.
- Confirmar que login/logout, Shop pública, Open Finance, Twilio/Z-API, assinaturas e menu inferior permanecem funcionando.
- Verificar telas mobile e desktop, erros no navegador e compilação final.

## Limite desta entrega

A preparação para n8n será concluída, mas o envio real pelo n8n dependerá da URL do webhook e de um segredo compartilhado configurados posteriormente.
