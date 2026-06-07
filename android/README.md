# Android / Play Store build

Produces a signed `.aab` (Android App Bundle) that wraps the deployed PWA
(`https://falai-finan-as.lovable.app`) via a Trusted Web Activity, using
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).

## Files

- `app.config.json` — package id, host, icons, colors. Edit if you change branding or domain.
- `version.json` — single source of truth for `versionName` / `versionCode`. Do **not** edit by hand; use the bump script.
- `build/app-release-bundle.aab` — output (gitignored).

## Versioning

Play Store requires `versionCode` to strictly increase with every upload.
Use the bump script — it always increments `versionCode` by 1:

```bash
node scripts/bump-version.mjs patch   # 1.0.0 -> 1.0.1
node scripts/bump-version.mjs minor   # 1.0.0 -> 1.1.0
node scripts/bump-version.mjs major   # 1.0.0 -> 2.0.0
node scripts/bump-version.mjs set 1.2.3
```

## Build locally

```bash
# one-time: JDK 17 + Android SDK (cmdline-tools + build-tools 34) must be installed
node scripts/build-aab.mjs
```

Output: `android/build/app-release-bundle.aab`.

## Build in CI (recommended)

`.github/workflows/android-release.yml` builds the `.aab` automatically:

- **Manual run** (Actions → "Android Release (AAB)" → Run workflow): pick
  `patch` / `minor` / `major` / `none`. The bump is committed back to `main`.
- **Tag push** (`git tag v1.2.3 && git push --tags`): the tag's version is
  written to `version.json` and the bundle is built.

The artifact `app-release-bundle` is attached to the run.

## Signing

Add these GitHub repository secrets so CI can sign the bundle (without them
the build still runs but the `.aab` is unsigned and not uploadable to Play):

| Secret | Description |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | Key password |

Generate a keystore once:

```bash
keytool -genkey -v -keystore release.keystore -alias android \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep the keystore offline — losing it means losing the ability to update the app on Play.

## Digital Asset Links

After the first upload, copy the SHA-256 fingerprint shown in Play Console →
Setup → App integrity into `public/.well-known/assetlinks.json` so the TWA
runs without the browser address bar. See `public/README-ASSETLINKS.md`.
