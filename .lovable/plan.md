# Corrigir manifesto para o PWABuilder

## Alterações
- Criar `public/manifest.json` como JSON estritamente válido, com nome, URL inicial `/`, escopo, modo standalone, cores e ícones 192/512.
- Manter `manifest.webmanifest` compatível para instalações existentes, com o mesmo conteúdo válido.
- Apontar a página e a configuração Android para o novo endereço público `/manifest.json`.
- Não adicionar service worker: o pedido é empacotamento/instalação, não uso offline, e atualmente não existe worker para corrigir.

## Validação
- Validar os dois arquivos com parser JSON.
- Confirmar dimensões e formato dos ícones.
- Confirmar via HTTP que `/manifest.json` responde publicamente como JSON e que `/` continua sendo a URL inicial, nunca `/auth`.
