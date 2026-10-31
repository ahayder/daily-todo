#!/usr/bin/env node
// Used by `pnpm dev:prod`: shows which PocketBase .env.local points at and asks
// a human to type "prod". Exits non-zero (so the dev server never starts) if
// there's no terminal, the URL is local, or the answer isn't "prod".
import { loadLocalEnvFile } from "./lib/pocketbase-admin.mjs";
import { confirmProd, hostOf, isLocalUrl } from "./lib/pocketbase-target.mjs";

loadLocalEnvFile();
const url = process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim() ?? "";

try {
  if (!url) throw new Error("NEXT_PUBLIC_POCKETBASE_URL is not set in .env.local.");
  if (isLocalUrl(url)) throw new Error(`.env.local points at a local DB (${hostOf(url)}); use \`pnpm dev\` instead.`);
  await confirmProd(url);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
