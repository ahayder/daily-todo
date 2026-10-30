# Testing & verifying
Last verified: 2026-10-30

## How it works
- Vitest + @testing-library/react: `pnpm test` (`pnpm test:watch`). Tests sit next to code (`*.test.ts(x)`). Pure — never touch any PocketBase.
- UI check: `http://localhost:5005/<route>?devWorkspace=1` (local workspace, no login; reuse a running dev server on 5005). Test 375px and ≥1280px, dark and light (remove `dark` class on `<html>` or use the profile menu).
- Real sync testing: local PocketBase + `pnpm dev:test` on `http://dailytodo.localhost:5005` (see [pocketbase.md](pocketbase.md)).
- Port 5005 may be held by another worktree's dev server; `.claude/launch.json` has a `dev-test-5006` entry (test DB on port 5006).
- Known, pre-existing: with `?devWorkspace=1` against the local test DB, note creates fail with 400 (fake owner `dev-browser-workspace`). Not a bug in your change.
- If `tsc` can't find `@tauri-apps/plugin-notification`, run `pnpm install` (it's in `package.json` but may be missing locally).
- More: `.agents/skills/vitest-testing/`.

## Gotchas
- `pnpm dev` hits the **production** DB.
- Schema changes: add a regression test in `src/lib/pocketbase-schema-admin.test.ts`.
