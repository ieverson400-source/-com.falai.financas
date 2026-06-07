# assetlinks.json — Digital Asset Links

Este arquivo valida seu PWA como um Trusted Web Activity (TWA) no Android.

## O que faz?

O Google exige este arquivo para que seu app Android (gerado pelo PWABuilder)
possa abrir seu PWA em tela cheia **sem a barra de endereço do Chrome**.
Sem ele, o app abre como um navegador comum — com URL visível.

## Como preencher

Abra `public/.well-known/assetlinks.json` e substitua:

### 1. `SEU_PACKAGE_NAME_AQUI`
→ O package name que você definiu no PWABuilder.  
Exemplo: `com.falai.financas`

### 2. `SEU_SHA256_AQUI`
→ O fingerprint SHA-256 da sua keystore.  
Formato: 32 pares hexadecimais separados por dois-pontos.  
Exemplo: `A1:B2:C3:D4:E5:F6:...` (96 caracteres + 31 dois-pontos)

## Como obter o SHA-256

### Opção A — PWABuilder (mais fácil)
Ao gerar seu Android package no PWABuilder, ele exibe o fingerprint no passo de signing keys. Copie o valor SHA-256.

### Opção B — keytool (se você gerou a keystore localmente)
```bash
keytool -list -v -keystore minha-keystore.jks -alias my-alias -storepass sua-senha
```
Procure por `SHA256:`. O valor vem em pares separados por dois-pontos — use exatamente esse formato.

### Opção C — Play Console (se ativou Play App Signing)
1. Acesse Play Console → seu app → Configuração → App Integrity
2. Copie o **SHA-256 certificate fingerprint** do certificado de assinatura do app

## ⚠️ Onde publicar

Este arquivo DEVE estar acessível publicamente em:
```
https://SEU-DOMINIO.com/.well-known/assetlinks.json
```

**Importante:**
- NÃO funciona com o domínio `lovable.app` — você precisa de um **domínio próprio**.
- Configure seu domínio customizado nas configurações do projeto Lovable.
- O arquivo deve ser servido com `Content-Type: application/json`.
- O Google precisa acessar esse arquivo sem autenticação.

## Verificação

Após publicar, teste no navegador:
```
https://SEU-DOMINIO.com/.well-known/assetlinks.json
```

Deve exibir o JSON corretamente (sem download, sem erro 404).

## Teste no Android

Instale o app gerado e execute:
```bash
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://SEU-DOMINIO.com" \
  SEU_PACKAGE_NAME_AQUI
```

Se a Digital Asset Link estiver correta, o app abre sem barra de endereço.

## Links úteis

- [Google Digital Asset Links](https://developers.google.com/digital-asset-links)
- [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/)
- PWABuilder docs: [Generate an Android package](https://docs.pwabuilder.com/#/builder/android)
