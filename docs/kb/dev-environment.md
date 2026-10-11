# Dev environment
Last verified: 2026-10-11

## How it works
- pnpm. Dev server: `pnpm dev` on port 5005 (production DB!) or `pnpm dev:test` (local PocketBase). Lint: `pnpm lint`.
- Env files: `.env.local` (prod URL + admin creds), `.env.test.local` (local DB). Both git-ignored.
- **Git identity:** this repo commits as the personal GitHub account `ahayder` (repo-local `user.email = 2572383+ahayder@users.noreply.github.com`), remote `git@github.com-personal:ahayder/daily-todo.git`. The machine's global identity is a work account — check `git config user.email` before committing. The user usually uses GitHub Desktop.
- Branches: work on `dev`; `main` is the PR base.

## Gotchas
- A fresh clone inherits the work identity unless the local user values are re-set.
