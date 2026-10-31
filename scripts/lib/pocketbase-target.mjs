// Decides which PocketBase a script may talk to, so nothing reaches prod by accident.
// - Scripts run with --prod must target a non-local URL and need a typed confirmation.
// - Every other run must target a local URL (127.0.0.1, localhost, *.localhost, [::1]).
// - Runs that pass `node --env-file=…` (the :local scripts) never fall back to .env.local.
import { createInterface } from "node:readline/promises";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1", "0.0.0.0"]);

export function isLocalUrl(url) {
  try {
    const { hostname } = new URL(url);
    return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return String(url);
  }
}

/** True when node was started with --env-file (the :local scripts). */
export function usesEnvFile(execArgv = process.execArgv) {
  return execArgv.some((arg) => arg === "--env-file" || arg.startsWith("--env-file="));
}

export function wantsProd(argv = process.argv) {
  return argv.includes("--prod");
}

/** Throws when the URL doesn't match the intent. Pure: no prompts, no network. */
export function assertTarget({ url, wantProd }) {
  if (!url) {
    throw new Error("Missing PocketBase URL. Set POCKETBASE_ADMIN_URL, NEXT_PUBLIC_POCKETBASE_URL, or POCKETBASE_URL.");
  }
  const local = isLocalUrl(url);
  if (wantProd && local) {
    throw new Error(`--prod was given, but the target is local (${hostOf(url)}). Use the :local script instead.`);
  }
  if (!wantProd && !local) {
    throw new Error(
      `This would touch PROD (${hostOf(url)}). Refusing. ` +
        "Use the :local script for the test DB, or the :prod script if you really mean prod.",
    );
  }
  return { url, isLocal: local };
}

/**
 * Asks a human to type "prod". Refuses when there is no terminal (agents, CI, pipes).
 * @param {string} url
 * @param {{ input?: NodeJS.ReadableStream & { isTTY?: boolean }, output?: NodeJS.WritableStream }} [streams]
 */
export async function confirmProd(url, { input = process.stdin, output = process.stderr } = {}) {
  if (!input.isTTY) {
    throw new Error(`Refusing to touch PROD (${hostOf(url)}) without a terminal. Ali runs prod commands himself.`);
  }
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`\n⚠️  This will use PRODUCTION PocketBase: ${hostOf(url)}\nType "prod" to continue: `);
    if (answer.trim() !== "prod") throw new Error("Cancelled — nothing was changed.");
  } finally {
    rl.close();
  }
}
