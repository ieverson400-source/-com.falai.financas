#!/usr/bin/env node
/**
 * Bump version for Android (Play Store) submission.
 *
 * Usage:
 *   node scripts/bump-version.mjs patch   # 1.0.0 -> 1.0.1
 *   node scripts/bump-version.mjs minor   # 1.0.0 -> 1.1.0
 *   node scripts/bump-version.mjs major   # 1.0.0 -> 2.0.0
 *   node scripts/bump-version.mjs set 1.2.3
 *
 * Always increments versionCode by 1 (Play Store requires monotonically
 * increasing integer per upload).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionFile = resolve(__dirname, "../android/version.json");
const pkgFile = resolve(__dirname, "../package.json");

const mode = process.argv[2] ?? "patch";
const explicit = process.argv[3];

const current = JSON.parse(readFileSync(versionFile, "utf8"));
let [major, minor, patch] = current.versionName.split(".").map(Number);

if (mode === "set") {
  if (!explicit || !/^\d+\.\d+\.\d+$/.test(explicit)) {
    console.error("Usage: bump-version.mjs set X.Y.Z");
    process.exit(1);
  }
  [major, minor, patch] = explicit.split(".").map(Number);
} else if (mode === "major") {
  major += 1; minor = 0; patch = 0;
} else if (mode === "minor") {
  minor += 1; patch = 0;
} else if (mode === "patch") {
  patch += 1;
} else {
  console.error(`Unknown mode: ${mode}`);
  process.exit(1);
}

const next = {
  versionName: `${major}.${minor}.${patch}`,
  versionCode: current.versionCode + 1,
};

writeFileSync(versionFile, JSON.stringify(next, null, 2) + "\n");

// Keep package.json in sync (semver only).
const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
pkg.version = next.versionName;
writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + "\n");

console.log(`Bumped to ${next.versionName} (versionCode ${next.versionCode})`);
