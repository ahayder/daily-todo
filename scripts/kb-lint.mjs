#!/usr/bin/env node
// Checks the knowledge base (docs/kb/) for drift. No dependencies.
// - backticked repo paths that no longer exist
// - pages missing from INDEX.md, and INDEX links to missing pages
// - pages over the size budget
// - missing or old "Last verified" dates
// Usage: pnpm kb:lint            (report; exit 1 on errors)
//        pnpm kb:lint --warn     (report only; always exit 0 — used in CI)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kbDir = path.join(root, "docs", "kb");
const warnOnly = process.argv.includes("--warn");

const PAGE_MAX_LINES = 90;
const PROJECT_MAX_LINES = 60;
const INDEX_MAX_ROWS = 40;
const STALE_DAYS = 30;
// Only check strings that look like repo paths.
const PATH_PREFIXES = ["src/", "scripts/", "docs/", "mcp-server/", "src-tauri/", "e2e/", ".claude/", ".agents/", ".design/", ".github/"];

const errors = [];
const warnings = [];

const pages = readdirSync(kbDir).filter((file) => file.endsWith(".md")).sort();
const indexText = readFileSync(path.join(kbDir, "INDEX.md"), "utf8");
const indexLinks = new Set([...indexText.matchAll(/\]\(([^)]+\.md)\)/g)].map((match) => match[1]));
const indexRows = indexText.split("\n").filter((line) => /^\|\s*\[/.test(line)).length;

if (indexRows > INDEX_MAX_ROWS) errors.push(`INDEX.md has ${indexRows} rows (budget ${INDEX_MAX_ROWS}).`);
for (const link of indexLinks) {
  if (!existsSync(path.join(kbDir, link))) errors.push(`INDEX.md links to missing page ${link}.`);
}

function looksLikePath(value) {
  // Local-only, git-ignored files (.env*) never exist in a fresh checkout.
  if (/(^|\/)\.env/.test(value)) return false;
  return PATH_PREFIXES.some((prefix) => value.startsWith(prefix)) && !/[\s*<>{}]/.test(value);
}

function pathExists(value) {
  const clean = value.replace(/[:#].*$/, "").replace(/\/$/, "");
  return existsSync(path.join(root, clean));
}

const today = new Date();
for (const page of pages) {
  if (page === "INDEX.md" || page === "README.md") continue;
  const text = readFileSync(path.join(kbDir, page), "utf8");
  const lines = text.split("\n").length;
  const budget = page === "project.md" ? PROJECT_MAX_LINES : PAGE_MAX_LINES;

  if (!indexLinks.has(page)) errors.push(`${page} is not listed in INDEX.md.`);
  if (lines > budget) errors.push(`${page} has ${lines} lines (budget ${budget}) — split or trim it.`);

  const verified = /Last verified:\s*(\d{4}-\d{2}-\d{2})/.exec(text)?.[1];
  if (!verified) {
    errors.push(`${page} has no "Last verified: YYYY-MM-DD" line.`);
  } else {
    const ageDays = Math.floor((today - new Date(`${verified}T00:00:00Z`)) / 86_400_000);
    if (ageDays > STALE_DAYS) warnings.push(`${page} last verified ${ageDays} days ago — re-check against code.`);
  }

  const missing = new Set();
  for (const [, value] of text.matchAll(/`([^`\n]+)`/g)) {
    if (looksLikePath(value) && !pathExists(value)) missing.add(value);
  }
  for (const value of missing) errors.push(`${page} mentions \`${value}\`, which doesn't exist.`);
}

for (const line of warnings) console.log(`warn  ${line}`);
for (const line of errors) console.log(`error ${line}`);
console.log(
  errors.length === 0 && warnings.length === 0
    ? `KB OK — ${pages.length} files checked.`
    : `KB: ${errors.length} error(s), ${warnings.length} warning(s). Fix with kb-keeper tidy mode.`,
);
process.exit(errors.length > 0 && !warnOnly ? 1 : 0);
