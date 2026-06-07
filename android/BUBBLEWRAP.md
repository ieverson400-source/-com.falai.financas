# Como o Bubblewrap Gera o App Android

Este documento explica **passo a passo** como o [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) transforma sua PWA (Progressive Web App) em um `.aab` (Android App Bundle) pronto para a Play Store.

---

## Visão Geral

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Sua PWA       │────▶│  TWA Manifest │────▶│  Projeto Android │────▶│   .aab       │
│  (Web)          │     │  (JSON)       │     │  (Gradle/Java)   │     │  (Play Store)│
└─────────────────┘     └──────────────┘     └─────────────────┘     └──────────────┘
        │                       │                    │                    │
        │                       │                    │                    │
   falai-finan-as.        twa-manifest.json      Android Studio      app-release
   lovable.app            + app.config.json      + Bubblewrap        -bundle.aab
   (deployed)            + version.json         CLI commands
```

---

## O Que é uma Trusted Web Activity (TWA)?

Uma **Trusted Web Activity** é um app Android que:

1. **Abre seu site em tela cheia** — sem barra de endereço do navegador
2. **Usa o Chrome como engine** — renderização 100% web, mas parece app nativo
3. **Exige validação de domínio** — via `assetlinks.json` para remover a barra de navegação
4. **É empacotada como .aab** — formato exigido pela Play Store desde 2021

> **Diferença de PWA vs TWA:** PWA é instalada pelo navegador (Add to Home Screen). TWA é um app Android real distribuído pela Play Store.

---

## Fluxo de Geração (3 Comandos)

### Comando 1: `bubblewrap init`

```bash
npx @bubblewrap/cli init --manifest=./twa-manifest.json --directory=. --skipPwaValidation
```

**O que faz:**

| Ação | Descrição |
|------|-----------|
| Lê `twa-manifest.json` | Extrai packageId, host, nome, ícones, versão |
| Baixa o ícone da PWA | Faz download do `iconUrl` e `maskableIconUrl` |
| Gera projeto Android | Cria estrutura Gradle em `android/build/twa/` |
| Configura assinatura | Aponta para o keystore de release |
| Cria `build.gradle` | Define versões, dependências, plugins |

**Arquivos gerados em `android/build/twa/`:**
```
twa/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml      ← Permissões, intent-filters
│   │   ├── java/.../LauncherActivity.java  ← Entry point TWA
│   │   └── res/                      ← Ícones, strings, cores
│   └── build.gradle                  ← Config do app module
├── build.gradle                      ← Config root
├── gradle.properties                 ← Versões do Android SDK
├── settings.gradle                   ← Nome do projeto
└── gradlew                           ← Wrapper Gradle
```

---

### Comando 2: `bubblewrap update`

```bash
npx @bubblewrap/cli update
```

**O que faz:**

- Re-sincroniza o `twa-manifest.json` com o projeto Android
- Atualiza versões (`versionCode`, `versionName`)
- Re-processa ícones se mudaram
- Atualiza dependências do TWA (androidx.browser, etc.)

> Normalmente é redundante após `init`, mas garante que qualquer mudança no manifest seja aplicada.

---

### Comando 3: `bubblewrap build`

```bash
npx @bubblewrap/cli build --skipPwaValidation
```

**O que faz:**

| Etapa | Comando interno | Resultado |
|-------|-----------------|-----------|
| 1. Compila código Java | `./gradlew assembleRelease` | `.apk` intermediário |
| 2. Converte para App Bundle | `./gradlew bundleRelease` | `.aab` final |
| 3. Assina digitalmente | `jarsigner` / `apksigner` | Bundle assinado com keystore |
| 4. Verifica alinhamento | `zipalign` | Otimizado para instalação |

**Saída:** `android/build/twa/app-release-bundle.aab`

Nosso script copia para: `android/build/app-release-bundle.aab`

---

## Configuração do TWA Manifest

O `twa-manifest.json` é o **coração** do processo. Veja o que cada campo controla:

```json
{
  "packageId": "app.lovable.falaifinancas",    // ID único na Play Store
  "host": "falai-finan-as.lovable.app",        // Domínio da PWA
  "name": "Falaí Finanças",                     // Nome exibido
  "launcherName": "Falaí",                      // Nome curto (ícone)
  "display": "standalone",                    // Sem UI do navegador
  "themeColor": "#0f1b2d",                      // Cor da barra de status
  "backgroundColor": "#0f1b2d",                 // Cor de fundo splash
  "startUrl": "/",                              // Página inicial
  "iconUrl": "https://.../icon-512.png",        // Ícone do app
  "appVersionName": "1.0.0",                   // Versão visível
  "appVersionCode": 1,                          // Versão interna (obrigatório incrementar!)
  "signingKey": {
    "path": "/path/to/release.keystore",        // Keystore de assinatura
    "alias": "android"                          // Alias da chave
  },
  "webManifestUrl": "https://.../manifest.webmanifest",
  "fallbackType": "customtabs"                  // Chrome Custom Tabs se TWA falhar
}
```

---

## Assinatura Digital (Segurança)

### Por que assinar?

- **Play Store exige** — só aceita bundles assinados
- **Proteção de identidade** — garante que você é o autor do app
- **Atualizações** — Play Store só aceita updates com a mesma chave

### Processo de assinatura no build:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Keystore .jks  │────▶│  Gradle +        │────▶│  .aab assinado  │
│  (sua chave)    │     │  Android Plugin  │     │  + zipaligned   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Sequência no Bubblewrap:**
1. Gradle compila o código Java/Kotlin
2. Android Gradle Plugin empacota em `.aab` (formato otimizado da Google)
3. Plugin aplica assinatura com keystore configurado no `twa-manifest.json`
4. `zipalign` otimiza o alinhamento de bytes para memória

### Sem keystore?

O build funciona, mas o `.aab` é **rejeitado pela Play Store**:

```
⚠ No ANDROID_KEYSTORE_BASE64 — bundle will be unsigned and NOT uploadable to Play.
```

---

## O Que Acontece na Play Store?

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   .aab enviado  │────▶│  Play Console   │────▶│  Google gera    │
│   por você      │     │  (upload)       │     │  APKs otimizados│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │  App Signing    │
                        │  by Google Play │
                        └─────────────────┘
```

1. Você faz upload do `.aab` único
2. Google Play **re-assina** com chave própria (App Signing)
3. Google gera **APKs otimizados** por dispositivo (só o que cada celular precisa)
4. Usuário baixa APK menor e otimizado para seu hardware

---

## Pré-requisitos do Sistema

| Componente | Versão | Para que serve |
|------------|--------|----------------|
| Node.js | 20+ | Executar Bubblewrap CLI |
| Java JDK | 17 | Compilar código Android |
| Android SDK | API 34+ | Bibliotecas Android |
| Build Tools | 34.0.0 | `aapt`, `zipalign`, `apksigner` |

---

## Troubleshooting Comum

### "Keystore was tampered with"
→ Senha do keystore está errada. Verifique `ANDROID_KEYSTORE_PASSWORD`.

### "Cannot recover key"
→ Senha da chave (key password) está errada. Verifique `ANDROID_KEY_PASSWORD`.

### "Alias not found"
→ O alias não existe no keystore. Liste com: `keytool -list -keystore release.keystore`

### "Invalid keystore format"
→ O base64 está corrompido. Regenere com: `base64 -w0 release.keystore`

### Build passa mas `.aab` não é gerado
→ Verifique se há erros no `./gradlew bundleRelease`. Pode ser falta de Android SDK.

---

## Comandos Úteis

```bash
# Build completo local (valida keystore + build)
bun run android:build:local

# Só validar keystore
node scripts/verify-keystore.mjs

# Só build (sem validação prévia)
node scripts/build-aab.mjs

# Incrementar versão
node scripts/bump-version.mjs patch
```

---

## Recursos

- [Bubblewrap GitHub](https://github.com/GoogleChromeLabs/bubblewrap)
- [Trusted Web Activity Docs](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [Play Store App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Asset Links Generator](https://developers.google.com/digital-asset-links/tools/generator)
