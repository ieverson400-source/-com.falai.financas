#!/usr/bin/env node
/**
 * Validate that the Android signing secrets are usable BEFORE running a
 * long Bubblewrap build that would otherwise fail at the signing step.
 *
 * Checks (in order):
 *   1. All four secrets are present and non-empty.
 *   2. ANDROID_KEYSTORE_BASE64 decodes to valid bytes.
 *   3. Decoded bytes are a readable JKS/PKCS12 keystore that opens with
 *      ANDROID_KEYSTORE_PASSWORD (via `keytool -list`).
 *   4. ANDROID_KEY_ALIAS exists inside the keystore.
 *   5. ANDROID_KEY_PASSWORD unlocks the private key entry for that alias
 *      (via `keytool -list -rfc` which requires the key password).
 *
 * Exits non-zero with a clear message on the first failure so the CI job
 * fails fast before the signing step.
 *
 * Required env:
 *   ANDROID_KEYSTORE_BASE64
 *   ANDROID_KEYSTORE_PASSWORD
 *   ANDROID_KEY_ALIAS
 *   ANDROID_KEY_PASSWORD
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const required = [
  "ANDROID_KEYSTORE_BASE64",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
];

const missing = required.filter((k) => !process.env[k] || process.env[k].trim() === "");
if (missing.length) {
  console.error(`✗ Missing required signing secret(s): ${missing.join(", ")}`);
  console.error("  Add them in GitHub → Settings → Secrets and variables → Actions.");
  process.exit(1);
}

const storePass = process.env.ANDROID_KEYSTORE_PASSWORD;
const keyPass = process.env.ANDROID_KEY_PASSWORD;
const alias = process.env.ANDROID_KEY_ALIAS;

let keystoreBytes;
try {
  keystoreBytes = Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, "base64");
  if (keystoreBytes.length < 100) throw new Error("decoded payload is too small");
} catch (err) {
  console.error(`✗ ANDROID_KEYSTORE_BASE64 is not valid base64: ${err.message}`);
  console.error("  Re-encode with: base64 -w0 release.keystore");
  process.exit(1);
}

const workDir = mkdtempSync(join(tmpdir(), "ks-verify-"));
const keystorePath = join(workDir, "release.keystore");
writeFileSync(keystorePath, keystoreBytes);

const keytool = (args) =>
  execFileSync("keytool", args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });

try {
  // 1) Keystore + store password.
  let listing;
  try {
    listing = keytool([
      "-list",
      "-keystore", keystorePath,
      "-storepass", storePass,
    ]);
  } catch (err) {
    const stderr = (err.stderr || "").toString();
    if (/password was incorrect|Keystore was tampered|integrity/i.test(stderr)) {
      console.error("✗ ANDROID_KEYSTORE_PASSWORD is incorrect for the provided keystore.");
    } else if (/Invalid keystore format|not a valid/i.test(stderr)) {
      console.error("✗ ANDROID_KEYSTORE_BASE64 does not contain a valid JKS/PKCS12 keystore.");
    } else {
      console.error(`✗ Failed to open keystore:\n${stderr.trim()}`);
    }
    process.exit(1);
  }

  // 2) Alias exists. keytool -list prints one line per entry: "<alias>, <date>, <type>"
  const aliasRegex = new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},`, "im");
  if (!aliasRegex.test(listing)) {
    console.error(`✗ Alias "${alias}" not found in keystore.`);
    console.error("  Aliases present:");
    listing
      .split("\n")
      .filter((l) => /,\s*(PrivateKey|trustedCert)/i.test(l))
      .forEach((l) => console.error(`    - ${l.split(",")[0].trim()}`));
    process.exit(1);
  }

  // 3) Key password unlocks the private key for that alias.
  //    `-list -rfc` for a specific alias requires the key password and will
  //    fail with "Cannot recover key" if ANDROID_KEY_PASSWORD is wrong.
  try {
    keytool([
      "-list",
      "-rfc",
      "-alias", alias,
      "-keystore", keystorePath,
      "-storepass", storePass,
      "-keypass", keyPass,
    ]);
  } catch (err) {
    const stderr = (err.stderr || "").toString();
    if (/Cannot recover key|wrong password|UnrecoverableKey/i.test(stderr)) {
      console.error(`✗ ANDROID_KEY_PASSWORD is incorrect for alias "${alias}".`);
    } else {
      console.error(`✗ Failed to access key for alias "${alias}":\n${stderr.trim()}`);
    }
    process.exit(1);
  }

  console.log(`✓ Keystore valid. Alias "${alias}" unlocks with provided key password.`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
