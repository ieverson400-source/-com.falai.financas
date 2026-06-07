#!/usr/bin/env node
/**
 * Build the Android App Bundle (.aab) for Play Store submission using
 * Bubblewrap (Trusted Web Activity wrapper around the deployed PWA).
 *
 * Prerequisites (CI installs these automatically — see .github/workflows/android-release.yml):
 *   - Node 20+
 *   - Java 17 (JDK)
 *   - Android SDK + build-tools
 *   - @bubblewrap/cli (installed on demand via `bunx`/`npx`)
 *
 * Required environment variables for signing (only needed to produce a
 * Play-uploadable .aab; without them an unsigned bundle is produced):
 *   ANDROID_KEYSTORE_BASE64   base64 of your release keystore (.jks)
 *   ANDROID_KEYSTORE_PASSWORD keystore password
 *   ANDROID_KEY_ALIAS         key alias inside the keystore
 *   ANDROID_KEY_PASSWORD      key password
 *
 * Output: android/build/app-release-bundle.aab
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const androidDir = resolve(root, "android");
const buildDir = resolve(androidDir, "build");
const twaDir = resolve(buildDir, "twa");

const appConfig = JSON.parse(
  readFileSync(resolve(androidDir, "app.config.json"), "utf8"),
);
const version = JSON.parse(
  readFileSync(resolve(androidDir, "version.json"), "utf8"),
);

console.log(
  `→ Building AAB for ${appConfig.name} v${version.versionName} (code ${version.versionCode})`,
);

mkdirSync(buildDir, { recursive: true });
rmSync(twaDir, { recursive: true, force: true });
mkdirSync(twaDir, { recursive: true });

// Bubblewrap config — written before `bubblewrap init` to keep build reproducible.
const twaManifest = {
  packageId: appConfig.packageId,
  host: appConfig.host,
  name: appConfig.name,
  launcherName: appConfig.launcherName,
  display: "standalone",
  themeColor: appConfig.themeColor,
  navigationColor: appConfig.themeColor,
  backgroundColor: appConfig.backgroundColor,
  enableNotifications: false,
  startUrl: appConfig.startUrl,
  iconUrl: appConfig.iconUrl,
  maskableIconUrl: appConfig.maskableIconUrl,
  appVersionName: version.versionName,
  appVersionCode: version.versionCode,
  signingKey: {
    path: resolve(buildDir, "release.keystore"),
    alias: process.env.ANDROID_KEY_ALIAS ?? "android",
  },
  webManifestUrl: appConfig.manifestUrl,
  fallbackType: "customtabs",
  features: { locationDelegation: { enabled: false }, playBilling: { enabled: false } },
  alphaDependencies: { enabled: false },
  enableSiteSettingsShortcut: true,
  isChromeOSOnly: false,
  orientation: "portrait",
};
writeFileSync(
  resolve(twaDir, "twa-manifest.json"),
  JSON.stringify(twaManifest, null, 2),
);

// Optionally materialize keystore from base64 env var.
const ks = process.env.ANDROID_KEYSTORE_BASE64;
if (ks) {
  writeFileSync(twaManifest.signingKey.path, Buffer.from(ks, "base64"));
  console.log("→ Keystore materialized from ANDROID_KEYSTORE_BASE64");
} else {
  console.warn(
    "⚠ No ANDROID_KEYSTORE_BASE64 — bundle will be unsigned and NOT uploadable to Play.",
  );
}

const run = (cmd) => {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: twaDir, env: process.env });
};

// Bubblewrap update reads twa-manifest.json and regenerates the Android project.
run("npx --yes @bubblewrap/cli@latest init --manifest=./twa-manifest.json --directory=. --skipPwaValidation");
run("npx --yes @bubblewrap/cli@latest update");
run("npx --yes @bubblewrap/cli@latest build --skipPwaValidation");

const producedAab = resolve(twaDir, "app-release-bundle.aab");
const targetAab = resolve(buildDir, "app-release-bundle.aab");
if (existsSync(producedAab)) {
  copyFileSync(producedAab, targetAab);
  console.log(`✓ AAB ready: ${targetAab}`);
} else {
  console.error("✗ Build finished but app-release-bundle.aab was not produced.");
  process.exit(1);
}
