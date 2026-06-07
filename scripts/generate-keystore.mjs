#!/usr/bin/env node
/**
 * Helper script to generate an Android release keystore for Play Store signing.
 *
 * This creates:
 *   - android/build/release.keystore   (keep this SAFE and offline!)
 *   - android/build/release.keystore.base64.txt  (for CI secret)
 *
 * After running, you will still need to manually set GitHub secrets:
 *   ANDROID_KEYSTORE_BASE64    ← copy from .base64.txt
 *   ANDROID_KEYSTORE_PASSWORD    ← the password you chose
 *   ANDROID_KEY_ALIAS            ← alias you chose (default: android)
 *   ANDROID_KEY_PASSWORD         ← key password (default: same as keystore)
 *
 * USAGE:
 *   node scripts/generate-keystore.mjs [alias] [keystore-password] [key-password]
 *
 * Defaults:
 *   alias = android
 *   keystore-password = prompts if not provided
 *   key-password = same as keystore-password
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const buildDir = resolve(root, "android", "build");

const question = (prompt) =>
  new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });

async function main() {
  mkdirSync(buildDir, { recursive: true });

  const alias = process.argv[2] || "android";
  const storePass = process.argv[3] || (await question("Senha do keystore (min 6 chars): "));
  const keyPass = process.argv[4] || storePass;

  if (!storePass || storePass.length < 6) {
    console.error("✗ Keystore password must be at least 6 characters.");
    process.exit(1);
  }

  const keystorePath = resolve(buildDir, "release.keystore");
  const base64Path = resolve(buildDir, "release.keystore.base64.txt");
  const dname = "CN=Falaí Finanças, O=Falaí, C=BR";

  console.log(`→ Gerando keystore: ${keystorePath}`);
  console.log(`   Alias: ${alias}`);
  console.log(`   Validade: 10.000 dias (~27 anos)`);

  execSync(
    `keytool -genkey ` +
      `-v ` +
      `-keystore "${keystorePath}" ` +
      `-alias "${alias}" ` +
      `-keyalg RSA ` +
      `-keysize 2048 ` +
      `-validity 10000 ` +
      `-storepass "${storePass}" ` +
      `-keypass "${keyPass}" ` +
      `-dname "${dname}"`,
    { stdio: "inherit" }
  );

  const keystoreBytes = readFileSync(keystorePath);
  const base64 = keystoreBytes.toString("base64");
  writeFileSync(base64Path, base64);

  console.log(`\n✓ Keystore gerado: ${keystorePath}`);
  console.log(`✓ Base64 salvo:   ${base64Path}`);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  AGORA CONFIGURE ESTES SECRETS NO GITHUB (Settings → Secrets):`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ANDROID_KEYSTORE_BASE64    ← conteúdo de ${base64Path}`);
  console.log(`  ANDROID_KEYSTORE_PASSWORD  ← ${storePass}`);
  console.log(`  ANDROID_KEY_ALIAS          ← ${alias}`);
  console.log(`  ANDROID_KEY_PASSWORD       ← ${keyPass}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log(`⚠️  IMPORTANTE: Guarde o arquivo .keystore em local seguro e offline.`);
  console.log(`    Perder esta chave = impossibilidade de atualizar o app na Play Store.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
