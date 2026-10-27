# Dev environment
Last verified: 2026-10-27

## How it works
- pnpm. Dev server: `pnpm dev` on port 5005 (production DB!) or `pnpm dev:test` (local PocketBase). Lint: `pnpm lint`.
- Env files: `.env.local` (prod URL + admin creds), `.env.test.local` (local DB). Both git-ignored.
- **Git identity:** this repo commits as the personal GitHub account `ahayder` (repo-local `user.email = 2572383+ahayder@users.noreply.github.com`), remote `git@github.com-personal:ahayder/daily-todo.git`. The machine's global identity is a work account — check `git config user.email` before committing. The user usually uses GitHub Desktop.
- Branches: work on `dev`; `main` is the PR base.
- **gh CLI:** the default `gh` account is the work account (`ahayder-astra`). For PRs on `ahayder/daily-todo`, prefix each command with `GH_TOKEN="$(gh auth token --user ahayder)" gh ...` instead of switching accounts (the work account can't create PRs there).

## Gotchas
- `pnpm lint` on the whole repo scans `src-tauri/target/**` build output and fails with ~860 parse errors. Run eslint on just the changed files instead.
- **Worktrees** (`.claude/worktrees/*`) have no `.env` files or `pocketbase-local/`. Run admin scripts with `node --env-file=<main checkout>/.env.test.local …`.
- `tsx` scripts that use `@/` imports must live inside the repo (scratchpad paths don't resolve the alias); use a `.mts` file.
- A fresh clone inherits the work identity unless the local user values are re-set.
