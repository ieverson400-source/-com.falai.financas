Falaí Finanças — PWA (Progressive Web App)
============================================

Este app é instalável como aplicativo nativo no celular e desktop.

ARQUIVOS:
- public/manifest.webmanifest  → metadados do PWA (nome, ícones, cores, display)
- public/icon-*.png            → ícones em 72, 96, 128, 144, 152, 192, 384, 512
- src/components/InstallPWAButton.tsx → botão "Instalar app" (flutuante)
- src/routes/__root.tsx        → injeta <link rel="manifest">, theme-color e
                                  meta tags do iOS no <head>.

COMO TESTAR:
1) Abra a versão PUBLICADA (https://falai-finan-as.lovable.app) — o PWA
   NÃO funciona dentro do iframe do editor do Lovable (por design).
2) Android (Chrome): aparece um botão flutuante "Instalar app".
   Toque → confirme no prompt nativo → ícone vai pra home screen.
3) iOS (Safari): toque em Compartilhar → "Adicionar à Tela de Início".
   Não existe API para forçar o prompt no iOS — é manual.
4) Desktop (Chrome/Edge): aparece um ícone de instalação na barra de
   endereço, ou use o botão "Instalar app" do próprio app.

OBSERVAÇÕES:
- Esta versão NÃO usa Service Worker, então não tem suporte offline.
  Isso é intencional: SWs causam problemas de cache no preview do Lovable.
- A splash screen e a cor da barra de status são geradas automaticamente
  a partir de theme_color e background_color do manifest.
- O botão "Instalar app" fica escondido quando o app já está instalado
  (detectado via display-mode: standalone).
