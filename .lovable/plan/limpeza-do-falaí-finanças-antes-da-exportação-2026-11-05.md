# Limpeza do Falaí Finanças antes da exportação

## Resultado esperado
Remover completamente Pluggy/Open Finance, Meus Bancos, recarga de celular, chat e WhatsApp, mantendo o restante do aplicativo funcionando e sem links quebrados.

**Nada será excluído antes da sua aprovação.** A escolha já confirmada é remover chat e WhatsApp e manter push e n8n sem histórico de envios.

## 1. Remover funções e telas
- Retirar Meus Bancos, Conectar contas, conectores, saldos bancários da Pluggy e todas as chamadas de sincronização.
- Retirar Recarga de Celular, suas configurações e referências nos benefícios dos planos, sem alterar preços, assinaturas ou pagamentos.
- Remover chat, histórico de conversas, conexão/testes/agenda do WhatsApp, mensagens automáticas e seus controles no Perfil/Admin.
- Desativar os cinco agendamentos de WhatsApp existentes e retirar os pontos de recebimento de mensagens e eventos da Pluggy.
- Manter lançamentos financeiros manuais e por voz que funcionem independentemente dessas integrações, orçamentos, relatórios, usuários, Shop, publicidade, AdSense e pagamentos.
- Recalcular os indicadores somente com os registros financeiros restantes, sem inventar saldos nem apagar despesas já salvas.

## 2. Preservar push e n8n
- Manter registro dos aparelhos, autorização de notificações, envio administrativo e confirmação com contagem de sucesso/falha.
- Manter o teste/envio para n8n e o retorno de sucesso/erro.
- Remover gravação, consulta, reenvio e indicadores dependentes de `notification_logs`, sem criar outra tabela de histórico.
- Ajustar o Admin para não consultar tabelas excluídas e manter as permissões administrativas existentes.

## 3. Limpar o banco com exclusões explícitas
Preparar script SQL de migração para estas tabelas:

```text
whatsapp_unmapped_numbers
notification_logs
chat_messages
pluggy_webhook_events
recargas
whatsapp_inbox
whatsapp_templates
pluggy_accounts
pluggy_sync_logs
```

Para cumprir “tirar tudo da Pluggy” e toda a lógica de recargas, incluir também:

```text
pluggy_transactions
pluggy_items
recarga_settings
```

- A tabela genérica `webhooks` não existe no banco atual. Só será incluída se existir na conferência final.
- Excluir em ordem de dependência: transações da Pluggy antes de contas e contas antes de conexões.
- Remover os triggers, políticas, índices e vínculos pertencentes aos objetos excluídos; conferir funções compartilhadas antes de removê-las.
- Não usar `CASCADE` indiscriminadamente: uma chave de `pluggy_transactions` referencia `pluggy_accounts`, e dependências precisam ser tratadas explicitamente.
- Não apagar usuários, despesas, orçamentos, ofertas, publicidade, assinaturas nem `push_tokens`.

**Atenção:** excluir essas tabelas apagará permanentemente conversas, mensagens, templates, histórico de envios, registros de recargas e dados bancários importados pela Pluggy. Despesas já gravadas em `expenses` serão preservadas. A versão publicada também usa este banco e será afetada.

### Permissão necessária para exclusão definitiva
As permissões atuais bloqueiam exclusões incompatíveis do banco. Após aprovar o plano, será necessário alterar **Configurações → Permissões do agente → Executar migrações de banco incompatíveis** de “Nunca permitir” para “Perguntar a cada vez” ou “Sempre permitir”. Com “Perguntar a cada vez”, a exclusão terá uma confirmação própria. Não substituir a exclusão por uma simples marcação de desuso sem avisar.

## 4. Limpeza para exportação
- Remover imports, estados, funções, componentes e dependências exclusivos das funções retiradas, incluindo Twilio se não houver outro uso.
- Retirar a função implantada do assistente após conferir que ela não atende outra função mantida.
- Limpar menus, textos de planos, política de privacidade e sitemap relacionados às funções removidas.
- Preservar endereços antigos de páginas publicadas com redirecionamento para `/app`, sem deixar a funcionalidade antiga acessível.
- Preservar o histórico de migrações gerenciado e registrar a limpeza em nova migração; não apagar arquivos históricos de forma que impeça recriar o banco.
- Não exportar credenciais privadas nem alterar os webhooks de Stripe/Google Play. Revogar conexões externas ou apagar segredos compartilhados exige conferir seus consumidores antes.

## 5. Ordem de execução e verificação
1. Aprovar este plano e preparar a permissão de exclusão definitiva.
2. Remover/adaptar o código e testar com o banco ainda intacto.
3. Publicar a versão compatível antes de excluir tabelas para não quebrar a versão antiga em uso.
4. Aplicar a migração autorizada e conferir os objetos restantes no banco.
5. Verificar erros de compilação/TypeScript/console e corrigir os encontrados.
6. Testar navegação em celular e computador, acesso administrativo, lançamentos financeiros, Shop e n8n. Verificar push até onde houver aparelho autorizado disponível.
7. Conferir que não há referências executáveis às funções retiradas nem consultas a tabelas apagadas; entregar o script e o resumo do resultado.

**Limite da verificação de push:** a entrega real depende de um aparelho autorizado. Não declarar entrega confirmada apenas por abrir o formulário do Admin.

## Detalhes técnicos
- Reutilizar TanStack Start/Router, Lovable Cloud e componentes existentes; não reconstruir o app.
- Usar a ferramenta de migração para mudanças de esquema e atualizar os tipos gerados pelo fluxo gerenciado.
- Deixar a árvore de rotas se regenerar automaticamente; não editar arquivos gerados manualmente.
- Adicionar testes pontuais para regras alteradas e executar os testes relevantes; verificar a compilação pelos diagnósticos automáticos.
- Não há erro recente disponível nos arquivos de diagnóstico consultados; a validação será repetida após a limpeza.