# Notificação push administrativa

## Implementação
- Conectar Firebase Cloud Messaging ao app para envio seguro e registro de dispositivos web/PWA.
- Criar a tabela `push_tokens`, vinculada ao usuário, com token único, plataforma, datas de atividade e política para cada usuário gerenciar apenas seus dispositivos.
- Reutilizar `notification_logs` para o histórico, acrescentando os campos de título, corpo, remetente e totais de sucesso/falha, sem criar uma tabela duplicada.
- Registrar o token após uma ação clara do usuário na primeira experiência autenticada; navegadores exigem clique para liberar notificações e o preview em iframe orientará abrir em nova aba.
- Criar o envio no servidor do aplicativo, com validação de administrador e limites de título/mensagem também no backend. Não será criada uma nova Edge Function porque este projeto TanStack usa funções de servidor para ações internas.
- Enviar em lotes para todos os tokens, remover tokens inválidos e registrar sucesso/falha no histórico.
- Adicionar ao Admin o botão, formulário, preview, contagem de destinatários e confirmação final.
- Validar permissão, registro, envio de teste sem entrega, interface mobile, console e build.
