#!/usr/bin/env node
// Claude Code Stop hook: a one-time nudge to keep the KB current.
// If code changed (working tree + unpushed commits) but docs/kb/ didn't, it
// asks the agent once to decide whether kb-keeper record mode is needed.
// It never writes to the KB, and it stays quiet for the same set of changes
// after the first nudge (state in .git/kb-reminder-seen).
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function git(command) {
  try {
    return execSync(`git ${command}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

const input = readInput();
// Already continuing because of a Stop hook: never nudge twice in a row.
if (input.stop_hook_active) process.exit(0);

const gitDir = git("rev-parse --git-dir");
if (!gitDir) process.exit(0);

const changed = new Set(
  [
    git("diff --name-only HEAD"),
    git("ls-files --others --exclude-standard"),
    git("log --name-only --format= @{upstream}..HEAD"),
  ]
    .join("\n")
    .split("\n")
    .filter(Boolean),
);

const codeChanges = [...changed].filter((file) => /^(src|mcp-server|scripts|src-tauri\/src)\//.test(file)).sort();
const kbTouched = [...changed].some((file) => file.startsWith("docs/kb/"));
if (codeChanges.length === 0 || kbTouched) process.exit(0);

const seenFile = path.join(gitDir, "kb-reminder-seen");
const fingerprint = createHash("sha1").update(codeChanges.join("\n")).digest("hex");
if (existsSync(seenFile) && readFileSync(seenFile, "utf8").trim() === fingerprint) process.exit(0);
writeFileSync(seenFile, fingerprint);

const sample = codeChanges.slice(0, 5).join(", ") + (codeChanges.length > 5 ? ", …" : "");
process.stdout.write(
  JSON.stringify({
    decision: "block",
    reason:
      `KB reminder: code changed (${sample}) but docs/kb/ wasn't touched. ` +
      "If this changed behavior, fixed a non-obvious bug, or revealed a gotcha or user decision, " +
      "run the kb-keeper agent in record mode with a short summary and `git diff --stat`. " +
      "If not (trivial change), say so in one line and stop. This reminder won't repeat for these changes.",
  }),
);
