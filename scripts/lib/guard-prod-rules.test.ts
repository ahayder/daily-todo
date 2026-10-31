import { describe, expect, it } from "vitest";
import { checkCommand } from "./guard-prod-rules.mjs";

describe("prod guard", () => {
  it.each([
    "pnpm dev:prod",
    "pnpm pocketbase:schema:apply:prod",
    "pnpm -s mcp:token:prod me@example.com | pbcopy",
    "node scripts/apply-pocketbase-schema.mjs --prod",
    "node scripts/confirm-prod.mjs",
    "pnpm mcp:dev",
    "pnpm pocketbase:schema:apply",
    "pnpm mcp:token",
    "cat .env.local",
    "source .env.local && node x.mjs",
    "grep URL .env.local",
    "cat mcp-server/.env",
    "echo $POCKETBASE_ADMIN_PASSWORD",
    'echo "${MCP_SECRET}"',
    "printenv",
    "env | sort",
    "curl https://dailytodo-pocketbase.ahayder.me/api/health",
    'git commit -m "ok" && cat .env.local',
  ])("blocks %s", (command) => {
    expect(checkCommand(command)).not.toBeNull();
  });

  it.each([
    "pnpm dev",
    "pnpm dev:test",
    "pnpm test",
    "pnpm pocketbase:seed:local",
    "pnpm pocketbase:schema:apply:local",
    "pnpm -s mcp:token:local",
    "node --env-file=.env.test.local scripts/apply-pocketbase-schema.mjs",
    'git commit -m "add pnpm dev:prod and :prod scripts"',
    "grep -n ':prod' package.json",
    "git log --oneline && git status",
    "open http://dailytodo.localhost:5005",
    "cat mcp-server/env.example",
    "pnpm env:check",
    'git add -A && git commit -m "move auto-login vars out of .env.local"',
  ])("allows %s", (command) => {
    expect(checkCommand(command)).toBeNull();
  });
});
