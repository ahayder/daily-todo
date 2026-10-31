// Rules for the PreToolUse hook (scripts/guard-prod.mjs) that stops AI agents
// from running production commands or reading secrets. It's a seatbelt for
// accidents, not a wall against someone determined to bypass it.

const SECRET_VARS = "POCKETBASE_ADMIN_PASSWORD|POCKETBASE_USER_TOKEN|POCKETBASE_USER_PASSWORD|MCP_SECRET|TAURI_SIGNING_PRIVATE_KEY";

/** Always checked, whatever the command is (these leak secrets or reach prod directly). */
const ALWAYS = [
  { pattern: /(^|[\s"'=/])\.env\.local\b/, reason: ".env.local holds the prod URL and admin credentials" },
  { pattern: /mcp-server\/\.env\b/, reason: "mcp-server/.env holds the prod MCP secret and user token" },
  { pattern: /\.env\.(development|production)(\.local)?\b/, reason: "env files can hold credentials" },
  { pattern: new RegExp(`\\$\\{?(${SECRET_VARS})\\b`), reason: "it would print a secret" },
  { pattern: /(^|[\s/])(printenv|env)(\s*$|\s*[|;&>])/, reason: "it would print every env var, including secrets" },
  { pattern: /dailytodo-pocketbase\.ahayder\.me|mcp\.ahayder\.me/, reason: "it talks to a production server" },
];

/** Prod scripts. Skipped for read-only tools (git, grep…) so docs and commits can mention them. */
const PROD_COMMANDS = [
  { pattern: /\b(dev|[\w-]+(:[\w-]+)*):prod\b/, reason: "it runs a :prod script" },
  { pattern: /(^|\s)--prod\b/, reason: "it passes --prod to an admin script" },
  { pattern: /confirm-prod/, reason: "it starts a prod session" },
  { pattern: /\bmcp:dev\b/, reason: "mcp:dev runs against the prod PocketBase (mcp-server/.env)" },
  { pattern: /(^|\s)(pnpm|npm run|yarn)\s+(run\s+)?(pocketbase:(schema:apply|backups:enable|content-planner:cleanup)|mcp:token)\s*($|[;&|])/,
    reason: "unsuffixed admin scripts are for Ali; agents use the :local versions" },
];

const READ_ONLY_FIRST_WORD = /^\s*(git|grep|rg|ls|wc|diff)\b/;

/** Returns null when the command is allowed, otherwise the reason it is blocked. */
export function checkCommand(command) {
  if (typeof command !== "string" || !command.trim()) return null;
  // A quoted commit message can mention these names without reading or running anything.
  const withoutMessages = /\bgit\s+commit\b/.test(command)
    ? command.replace(/-m\s*("(?:[^"\\]|\\.)*"|'[^']*')/g, "-m _")
    : command;
  for (const rule of ALWAYS) {
    if (rule.pattern.test(withoutMessages)) return rule.reason;
  }
  // Check each part of a chained command; read-only parts may mention prod script names.
  for (const part of command.split(/&&|\|\||;|\|/)) {
    if (READ_ONLY_FIRST_WORD.test(part)) continue;
    for (const rule of PROD_COMMANDS) {
      if (rule.pattern.test(part)) return rule.reason;
    }
  }
  return null;
}

export function blockMessage(reason) {
  return (
    `Blocked by the DailyTodo prod guard: ${reason}. ` +
    "Prod actions and secrets need Ali — ask him to run it himself. " +
    "For testing use `pnpm dev` (test DB) or the `:local` scripts."
  );
}
