#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash + file tools): blocks prod commands and
// reading or writing env files that hold credentials.
// Exit 2 + stderr = the tool call is blocked and the agent sees the reason.
import { readFileSync } from "node:fs";
import { blockMessage, checkToolCall } from "./lib/guard-prod-rules.mjs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}

const reason = checkToolCall(input);
if (reason) {
  process.stderr.write(blockMessage(reason));
  process.exit(2);
}
