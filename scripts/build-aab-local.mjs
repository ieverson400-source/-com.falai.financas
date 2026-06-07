#!/usr/bin/env node
/**
 * Local AAB build pipeline:
 *   1. Verify keystore & alias signatures via verify-keystore.mjs
 *   2. Build the .aab via build-aab.mjs
 *
 * Aborts immediately if keystore validation fails.
 *
 * Usage:
 *   bun run android:build:local
 *   # or
 *   node scripts/build-aab-local.mjs
 */
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function runScript(scriptName) {
  const path = resolve(root, "scripts", scriptName);
  console.log(`\n▶ ${scriptName}`);
  try {
    execFileSync("node", [path], { stdio: "inherit", cwd: root, env: process.env });
  } catch (err) {
    process.exit(err.status ?? 1);
  }
}

console.log("═══════════════════════════════════════════");
console.log("  Local AAB Build — Keystore + Bundle");
console.log("═══════════════════════════════════════════");

runScript("verify-keystore.mjs");
runScript("build-aab.mjs");

console.log("\n═══════════════════════════════════════════");
console.log("  ✓ AAB build completed successfully.");
console.log("═══════════════════════════════════════════");

const aabPath = resolve(root, "android", "build", "app-release-bundle.aab");
console.log(`\n📦 Output file:`);
console.log(`   ${aabPath}`);
console.log(`\nNext steps:`);
console.log(`   • Upload to Play Console: https://play.google.com/console`);
console.log(`   • Or run: open ${resolve(root, "android", "build")}`);
