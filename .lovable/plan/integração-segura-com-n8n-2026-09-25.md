# Integração segura com n8n

## Objetivo

Conectar o Falaí Finanças ao webhook de teste do n8n sem alterar o layout, as integrações ou os fluxos existentes.

## Implementação

- Armazenar o endereço informado como configuração protegida do servidor.
- Criar uma função reutilizável e autenticada para enviar `user_id`, `email`, `event` e `timestamp` em JSON por HTTP POST.
- Obter o ID e e-mail da sessão validada no servidor, sem aceitar identidade enviada pelo navegador.
- Tratar indisponibilidade, timeout e respostas de erro do n8n com mensagens seguras.
- Registrar o resultado na estrutura atual de notificações, sem substituir Twilio ou Z-API.
- Aproveitar a área n8n já existente em Administração → Notificações para permitir o teste e exibir sucesso ou erro por mensagem, sem redesenhar a tela.

## Verificação

- Confirmar compilação e ausência de erros novos.
- Testar acesso autenticado e a mensagem visual do envio.
- Confirmar que a URL e eventuais credenciais não aparecem no código enviado ao navegador.
- Validar que as demais notificações e telas permanecem intactas.

## Observação

O endereço `/webhook-test/` do n8n normalmente só recebe chamadas enquanto o workflow está em modo de escuta para testes.
