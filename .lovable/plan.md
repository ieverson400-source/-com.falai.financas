# IA Guardião Financeiro — auditoria e correções por etapas

## Resultado da auditoria inicial

O aplicativo foi preservado: nenhuma função, tela, integração ou dado foi alterado nesta auditoria. Foram executadas verificações básicas, análise aprofundada do código, inspeção das políticas reais do banco e revisão independente das funções e webhooks.

**Proteções existentes:** todas as 27 tabelas públicas inspecionadas têm RLS habilitada. Despesas, orçamentos, perfis e registros bancários possuem políticas de propriedade baseadas na identidade autenticada. Administradores são autorizados por `user_roles`/`has_role` no servidor. Não foi demonstrado um acesso financeiro cruzado através das consultas comuns autenticadas. Isso não garante segurança dos caminhos privilegiados abaixo.

### Prioridade 0 — impedir operações financeiras não autorizadas

1. **WhatsApp/Z-API:** o código só verifica o segredo do webhook quando ele está configurado. Sem esse segredo, um telefone informado pelo solicitante pode levar à criação de despesa na conta correspondente. Corrigir para rejeitar chamadas quando a configuração estiver ausente ou a credencial estiver incorreta, antes de consultar usuários ou gravar despesas.
2. **Open Finance/Pluggy:** autenticação do webhook também é opcional; eventos de exclusão podem apagar conexões por identificador. Tornar a autenticação obrigatória e validar eventos antes de qualquer alteração privilegiada. Na sincronização e emissão de token de reconexão, verificar se a conexão externa realmente pertence ao usuário; validar apenas o formato de `itemId` não é suficiente. Primeiras conexões devem ser vinculadas pelo identificador de usuário comprovado pelo provedor, sem aceitar reivindicações arbitrárias.
3. **Resumos automáticos WhatsApp:** tarefas públicas aceitam a chave pública do aplicativo como credencial. Essa chave não é secreta. Substituir por segredo exclusivo das tarefas e atualizar os agendamentos correspondentes de forma coordenada, preservando o envio legítimo. Respostas não devem conter detalhes internos do banco.
4. **Google Play:** o scanner apontou reaproveitamento de compra sem vínculo comprovado com o usuário. A revisão também encontrou um caminho manual que aceita plano/status e pode continuar mesmo quando a verificação falha. Exigir compra válida, vínculo inequívoco com o titular e impedir uso da mesma compra por contas diferentes; eliminar o fallback inseguro de produção sem interromper compras legítimas.
5. **Stripe:** o scanner apontou associação de cliente por e-mail sem identidade comprovada. Conferir a configuração de confirmação de e-mail no serviço antes de concluir essa parte do diagnóstico; corrigir o vínculo de cliente por usuário e verificação de titularidade, não por e-mail informado ou não verificado. Restringir destinos de checkout e portal a URLs autorizadas.

### Prioridade 1 — reforçar isolamento e privacidade

- Testar SELECT/INSERT/UPDATE/DELETE com dois usuários diferentes e sem sessão; repetir as tentativas diretamente no banco, não apenas na interface.
- Verificar vínculos entre item bancário, conta, transação e proprietário: as chaves estrangeiras atuais referenciam o registro pai, mas não comprovam que pai e filho pertencem ao mesmo usuário. Adicionar proteção compatível após verificar os dados existentes.
- Aplicar bloqueio administrativo também nas operações e leituras protegidas, inclusive acesso direto permitido pelo banco; atualmente políticas financeiras verificam propriedade, mas não o estado `is_active`.
- Impedir que uma empresa anunciante aprove seu próprio status por atualização direta.
- Rever exposição de credenciais de recarga: a leitura atual retorna `api_key` junto das configurações. Preservar a configuração existente, mas devolver somente indicação de chave cadastrada e tratar a credencial como segredo no servidor. Rever redirecionamentos nas chamadas externas para evitar contorno da validação de destino.
- Validar limites de entradas no servidor; tratar mensagens anteriores de chat como dados não confiáveis, sem permitir papéis de sistema fornecidos pelo navegador.
- Revisar funções antigas ainda implantadas e seus usos antes de alterar ou desativar qualquer uma.

### Prioridade 1 — dependências

O scanner leu `package-lock.json` e reportou versões antigas. A instalação efetiva contém TanStack Start 1.168.60, Router 1.170.41 e Seroval 1.7.2, portanto parte dos alertas é divergência do arquivo de dependências, não prova de vulnerabilidade na versão executada. Auditar e alinhar os arquivos antes de atualizar.

Verificar separadamente os alertas de XLSX 0.18.5 e demais dependências efetivamente presentes; qualquer correção deve preservar importação de planilhas e ter teste de regressão. Não fazer atualização indiscriminada ou substituição sem avaliar compatibilidade.

## Entrega em etapas pequenas

### Etapa 1 — segurança crítica

Corrigir primeiro autenticação de webhooks/tarefas e vínculo de conexões bancárias; depois vínculo de compras e clientes. Cada grupo terá testes específicos e verificação das integrações antes de avançar. Configurações ausentes serão explicitamente informadas: rejeitar chamada insegura pode pausar uma integração até que seu segredo seja configurado.

### Etapa 2 — auditoria restrita e Segurança no Admin

- Criar um registro específico de eventos e ações administrativas, separado do histórico de notificações, que hoje é editável por administradores.
- Armazenar somente identidade necessária, tipo de evento, horário, gravidade, resultado e metadados permitidos; nunca senha, token, saldo, extrato ou conteúdo financeiro completo.
- Gravação apenas por código confiável; usuários comuns não poderão inserir, alterar ou excluir logs. Investigação terá status próprio e mudanças registradas sem reescrever a evidência original.
- Adicionar **Segurança** ao Admin existente, sem mudar navegação do usuário: eventos recentes, risco, filtros, pesquisa, investigação e histórico de ações.
- Oferecer revogação de sessões somente após verificar o suporte real; explicar que tokens já emitidos podem continuar válidos até expirar, e combinar com bloqueio de acesso quando necessário.
- Proposta de retenção: eventos identificáveis por 90 dias, eliminação controlada e agregados sem identificação quando necessários; documentar finalidade, acesso e rotina de exclusão. É uma medida de privacidade, não certificação de conformidade LGPD.

### Etapa 3 — detecção e IA com privacidade

- Regras determinísticas fazem os bloqueios de autorização; a IA não decide se alguém pode acessar dados privados.
- Detectar repetição, tentativas negadas, alterações suspeitas e desvios apenas a partir dos eventos disponíveis. Não apresentar uma visão completa das tentativas de login sem integração com eventos confiáveis do serviço de autenticação.
- Análise por ação explícita do administrador inicialmente, enviando somente contagens, tipos de evento e intervalos de tempo, sem identificadores pessoais ou detalhes financeiros.
- Gerar risco, justificativa e recomendação com saída estruturada validada; registrar modelo e resultado. Mostrar indisponibilidade ou erro real quando a IA não estiver configurada ou não responder.
- Chamadas de IA usam créditos do workspace; sem processamento contínuo ou tarefas em segundo plano nesta primeira etapa.

### Limitação de requisições — decisão pendente

A plataforma não possui um limitador padrão de requisições no backend. Uma solução própria exige manutenção, testes de concorrência e pode bloquear tráfego legítimo. **Não implementar sem confirmação explícita dessa escolha.** Se aceita, usar contadores persistentes/atômicos, limites separados para cada operação e preservar chamadas legítimas dos provedores; nunca contadores em memória como proteção de produção.

## Verificação e critérios de aceite

- Chamadas sem sessão, usuário comum e administrador: acesso negado ou autorizado conforme a operação.
- Dois usuários: tentativas de consultar/mudar dados alheios falham; registros originais permanecem intactos.
- Webhooks: segredo ausente/incorreto não provoca escrita nem envio; eventos legítimos e repetidos são tratados com segurança.
- Bancos e compras: identificadores de outro titular não são aceitos, mesmo que seu formato ou compra sejam válidos.
- Testes existentes de publicidade, push, ofertas e Stripe, mais testes pequenos para cada nova regra de segurança.
- Fluxos reais autenticados do financeiro e Admin; conferir erros do aplicativo e apresentação do Admin em celular/computador.
- IA: verificar chamada e resultado reais com eventos mínimos; sem simular proteção ativa.
- Repetir verificações de segurança após correções. Entrega final separa corrigido, configurações pendentes, testes executados e riscos residuais.

## Detalhes técnicos

Manter TanStack Start e Lovable Cloud. Funções internas usam `createServerFn` com identidade validada; webhooks continuam em rotas públicas com autorização dentro do handler. Cliente privilegiado somente após validação, carregado dentro do handler. Alterações do banco serão aditivas, com GRANTs e RLS na mesma migração, sem remoção de tabelas, usuários ou dados existentes.

**Pendente nesta fase:** nenhuma correção do aplicativo foi aplicada; testes de exploração ponta a ponta, configuração de autenticação hospedada, segredos dos provedores e entrega real de push ainda não foram verificados. A auditoria aponta os caminhos de risco; não foram executados ataques que apagassem conexões, criassem despesas ou disparassem mensagens aos usuários.