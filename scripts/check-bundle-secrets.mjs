#!/usr/bin/env node
// Runs after `next build`: fails if the exported app in out/ contains a secret.
// Checks (1) the actual values of known secret env vars, read from the process env
// and the local env files, and (2) server-only variable names that should never
// appear in client code. Never prints a secret value — only which variable leaked.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out");

const SECRET_VARS = [
  "NEXT_PUBLIC_DEV_AUTO_LOGIN_EMAIL",
  "NEXT_PUBLIC_DEV_AUTO_LOGIN_PASSWORD",
  "POCKETBASE_ADMIN_EMAIL",
  "POCKETBASE_ADMIN_PASSWORD",
  "POCKETBASE_USER_PASSWORD",
  "POCKETBASE_USER_TOKEN",
  "MCP_SECRET",
  "TAURI_SIGNING_PRIVATE_KEY",
  "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
];
const SERVER_ONLY_NAMES = ["POCKETBASE_ADMIN_PASSWORD", "POCKETBASE_USER_TOKEN", "MCP_SECRET", "TAURI_SIGNING_PRIVATE_KEY"];
const ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local", ".env.development.local", "mcp-server/.env"];

function readEnvFile(file) {
  const values = {};
  const full = path.join(root, file);
  if (!existsSync(full)) return values;
  for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2").trim();
  }
  return values;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(js|html|txt|json|css|map)$/.test(name)) yield full;
  }
}

if (!existsSync(outDir)) {
  console.error("check-bundle-secrets: out/ not found — run `next build` first.");
  process.exit(1);
}

// Values to look for: from the process env and every local env file (>= 6 chars, to avoid noise).
const needles = new Map();
for (const source of [process.env, ...ENV_FILES.map(readEnvFile)]) {
  for (const name of SECRET_VARS) {
    const value = source[name]?.trim();
    if (value && value.length >= 6) needles.set(value, name);
  }
}

const leaks = new Set();
for (const file of walk(outDir)) {
  const text = readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  for (const [value, name] of needles) {
    if (text.includes(value)) leaks.add(`${name} value found in ${relative}`);
  }
  for (const name of SERVER_ONLY_NAMES) {
    if (text.includes(name)) leaks.add(`server-only name ${name} found in ${relative}`);
  }
}

if (leaks.size > 0) {
  console.error("check-bundle-secrets: secrets would ship in the app:");
  for (const leak of leaks) console.error(`  - ${leak}`);
  process.exit(1);
}
console.log(`check-bundle-secrets: OK (${needles.size} secret value(s) checked).`);
