# Evolução segura do Shop e publicidade

## Objetivo
Transformar o Shop existente em uma Central de Ofertas com publicidade real e mensurável, preservando ofertas atuais, autenticação, navegação, integrações e demais telas.

## O que será feito

1. **Dados e segurança**
   - Manter `shop_offers` como fonte das ofertas já existentes, sem apagar ou migrar registros atuais.
   - Criar `advertisers` para empresas, `advertisements` para campanhas pagas, `advertisement_events` para impressões/cliques e `adsense_settings` para configuração do AdSense.
   - Incluir posições `SHOP_TOP`, `SHOP_MIDDLE`, `SHOP_OFFERS` e `SHOP_BOTTOM`, prioridade, ordem, limite por posição, destaque, status, vigência e valor contratado para métricas reais de receita.
   - Aplicar RLS: público autenticado lê apenas anúncios ativos e vigentes; registra eventos permitidos; administradores gerenciam tudo. A futura conta empresarial fica preparada com vínculo opcional ao usuário, sem liberar uma área ainda.
   - Limitar impressões repetidas por sessão através de um identificador anônimo e janela de deduplicação no banco.

2. **AdSense real e configurável**
   - Criar o componente reutilizável `AdSenseBanner`, responsivo e sem conteúdo falso.
   - Carregar o script oficial apenas quando ativado e com Publisher ID/bloco válidos.
   - Em desenvolvimento/teste, usar o modo de teste oficial; se não houver configuração, o espaço não quebra nem ocupa altura excessiva.
   - Adicionar ao Admin os controles solicitados, validação, salvar e testar. Publisher ID e ID do bloco são identificadores públicos, nunca chaves secretas.

3. **Shop para o usuário**
   - Preservar a rota, autenticação e rodapé existentes.
   - Reorganizar somente o conteúdo do Shop: AdSense configurável, destaques atuais, anúncios pagos por posição, “Ofertas Relâmpago - Parceiros”, categorias e mais ofertas.
   - Manter anúncios atuais de `shop_offers`; não cadastrar marcas ou cashback fictícios.
   - Identificar campanhas pagas como “Patrocinado”, registrar impressão visível e clique, e abrir destinos com segurança.
   - Aplicar o visual dark atual com detalhes em laranja e comportamento mobile-first.

4. **Administração de publicidade**
   - Acrescentar “Publicidade” e “Monetização” à navegação administrativa existente.
   - Criar painel com empresas, anúncios por status, impressões, cliques, CTR e receita real cadastrada.
   - Implementar empresas e anúncios: criar, editar, ativar, pausar, excluir, duplicar e visualizar.
   - Incluir logo/imagem por URL nesta etapa, preservando o armazenamento atual; nenhum pagamento será criado agora.

5. **Validação final**
   - Validar permissões, estados vazio/erro, deduplicação, AdSense desconfigurado, Shop e Admin.
   - Conferir celular e desktop, console, rede e build.
   - Não alterar o menu inferior existente, pois o pedido também exige preservar a navegação atual; a lista “Início, Invest, Forum, Shop, Todos” não substituirá as abas já instaladas.

## Detalhes técnicos
- Leituras públicas usarão políticas restritas e projeções seguras; operações administrativas continuarão protegidas por `requireSupabaseAuth` + `has_role`.
- Os eventos serão gravados por função validada, sem expor acesso administrativo ou credenciais.
- Métricas de receita serão calculadas apenas a partir de valores cadastrados nas campanhas; sem valores simulados.
- A estrutura de cobrança futura terá campos neutros de referência/status, sem acoplar Stripe ou Mercado Pago nesta entrega.
