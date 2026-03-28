import fs from "node:fs";
import path from "node:path";
import PocketBase from "pocketbase";
import {
  applyPocketBaseSchema,
  formatSchemaSummary,
  hasSchemaFailures,
} from "./lib/pocketbase-schema.mjs";

function parseEnvValue(rawValue) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return "";
  }

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

  if (!fs.existsSync(envPath)) {
    return;
  }

  const contents = fs.readFileSync(envPath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] != null) {
      continue;
    }

    const value = parseEnvValue(trimmed.slice(separatorIndex + 1));
    process.env[key] = value;
  }
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPocketBaseUrl() {
  return (
    process.env.POCKETBASE_ADMIN_URL?.trim() ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim() ||
    process.env.POCKETBASE_URL?.trim() ||
    ""
  );
}

async function main() {
  loadLocalEnvFile();

  const baseUrl = getPocketBaseUrl();
  const email = getRequiredEnv("POCKETBASE_ADMIN_EMAIL");
  const password = getRequiredEnv("POCKETBASE_ADMIN_PASSWORD");

  if (!baseUrl) {
    throw new Error(
      "Missing PocketBase URL. Set POCKETBASE_ADMIN_URL, NEXT_PUBLIC_POCKETBASE_URL, or POCKETBASE_URL.",
    );
  }

  const client = new PocketBase(baseUrl);
  client.autoCancellation(false);

  await client.collection("_superusers").authWithPassword(email, password);

  const summary = await applyPocketBaseSchema({ client, logger: console });
  console.log("");
  console.log(formatSchemaSummary(summary));

  if (hasSchemaFailures(summary)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`PocketBase schema apply failed: ${message}`);
  process.exitCode = 1;
});
