#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash): blocks prod commands and secret reads.
// Exit 2 + stderr = the tool call is blocked and the agent sees the reason.
import { readFileSync } from "node:fs";
import { blockMessage, checkCommand } from "./lib/guard-prod-rules.mjs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}

const reason = checkCommand(input?.tool_input?.command);
if (reason) {
  process.stderr.write(blockMessage(reason));
  process.exit(2);
}
