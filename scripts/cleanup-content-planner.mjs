import fs from "node:fs";
import path from "node:path";
import PocketBase from "pocketbase";

import { cleanupLegacyContentPlanner } from "./lib/content-planner-cleanup.mjs";

function parseEnvValue(rawValue) {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  const commentIndex = trimmed.indexOf(" #");
  return commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed;
}

function loadLocalEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] != null) continue;
    process.env[key] = parseEnvValue(trimmed.slice(separatorIndex + 1));
  }
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  loadLocalEnvFile();
  const baseUrl =
    process.env.POCKETBASE_ADMIN_URL?.trim() ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim() ||
    process.env.POCKETBASE_URL?.trim() ||
    "";
  if (!baseUrl) {
    throw new Error(
      "Missing PocketBase URL. Set POCKETBASE_ADMIN_URL, NEXT_PUBLIC_POCKETBASE_URL, or POCKETBASE_URL.",
    );
  }

  const client = new PocketBase(baseUrl);
  client.autoCancellation(false);
  await client
    .collection("_superusers")
    .authWithPassword(
      getRequiredEnv("POCKETBASE_ADMIN_EMAIL"),
      getRequiredEnv("POCKETBASE_ADMIN_PASSWORD"),
    );

  await cleanupLegacyContentPlanner({
    client,
    confirm: process.argv.includes("--confirm-delete-content-planner"),
    logger: console,
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Content planner cleanup failed: ${message}`);
  process.exitCode = 1;
});
