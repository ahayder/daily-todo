# Dev environment
Last verified: 2026-10-31

## How it works
- pnpm. Dev server: `pnpm dev` on port 5005 uses the **local test PocketBase** (`127.0.0.1:8090`); `pnpm dev:test` is an alias. `pnpm tauri:dev` runs `pnpm dev`, so it uses the test DB too. Lint: `pnpm lint`.
- **Prod is opt-in:** `pnpm dev:prod` runs `scripts/confirm-prod.mjs` first (a human must type `prod`; refuses without a TTY). Admin scripts follow the same rule ([pocketbase.md](pocketbase.md)): unsuffixed refuse prod, `:prod` variants pass `--prod` and ask for the typed confirmation, `:local` use `.env.test.local`.
- Env files: `.env.local` (prod URL + admin creds), `.env.test.local` (local DB), `.env.development.local` (dev auto-login, loaded only by `next dev`; see [auth.md](auth.md)). All git-ignored.
- **Prod guard hook** (PreToolUse, matcher `Bash|Read|Edit|Write|Grep`): `scripts/guard-prod.mjs`, rules in `scripts/lib/guard-prod-rules.mjs` (`checkCommand`, `checkFilePath`; tests `scripts/lib/guard-prod-rules.test.ts`). Blocks `:prod` scripts, `--prod`, `confirm-prod`, `mcp:dev` (prod via `mcp-server/.env`), unsuffixed admin scripts, prod hosts, env files (read/grep/edit too), printing secret vars, `printenv`/`env`. Allows read-only git/grep/ls parts and quoted commit messages. Prod work = Ali runs it in his own terminal.
- **Git identity:** this repo commits as the personal GitHub account `ahayder` (repo-local `user.email = 2572383+ahayder@users.noreply.github.com`), remote `git@github.com-personal:ahayder/daily-todo.git`. The machine's global identity is a work account — check `git config user.email` before committing. The user usually uses GitHub Desktop.
- Branches: always work and commit on `dev`; `main` is the PR base. Don't create worktrees without asking the user; use a separate branch only when `dev` is busy or for an isolated test feature (user rule, 2026-10-30).
- **gh CLI:** the default `gh` account is the work account (`ahayder-astra`). For PRs on `ahayder/daily-todo`, prefix each command with `GH_TOKEN="$(gh auth token --user ahayder)" gh ...` instead of switching accounts (the work account can't create PRs there).
- **KB lint:** `pnpm kb:lint` (`scripts/kb-lint.mjs`) checks KB paths, INDEX, size budgets, staleness; exit 1 on errors, `--warn` always exits 0.
- **KB Stop hook** (`.claude/settings.json` → `scripts/kb-reminder.mjs`): blocks the stop **once** with a reminder when `src/`, `mcp-server/`, `scripts/` or `src-tauri/src/` changed (working tree, untracked, unpushed commits) but `docs/kb/` didn't. Fingerprint in `.git/kb-reminder-seen` so it won't repeat for the same changes; skips when `stop_hook_active`; never writes to the KB.

## Gotchas
- **Worktrees** (`.claude/worktrees/*`) have no `.env` files or `pocketbase-local/`. Run admin scripts with `node --env-file=<main checkout>/.env.test.local …`.
- `tsx` scripts that use `@/` imports must live inside the repo (scratchpad paths don't resolve the alias); use a `.mts` file.
- A fresh clone inherits the work identity unless the local user values are re-set.
- The prod guard matches on text, so it also blocks harmless commands that only *mention* a blocked name (an `echo`, a heredoc writing text that contains an env filename). Use the Edit/Write tools for file edits. It's a seatbelt, not a wall — don't try to work around it.
- `:local` scripts use `node --env-file`; the shared loader no longer fills missing keys from `.env.local` when an env file was passed (`usesEnvFile`), so a local run can't silently pick up prod creds.
- `.claude/settings.json` hooks load at session start: edits to the hook config or a new hook only take effect in a new Claude Code session.
