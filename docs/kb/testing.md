# Testing & verifying
Last verified: 2026-10-31

## How it works
- Vitest + @testing-library/react: `pnpm test` (`pnpm test:watch`). Tests sit next to code (`*.test.ts(x)`). Pure — never touch any PocketBase.
- Types: `pnpm typecheck` (`tsc --noEmit`).
- Hook-level sync tests: `src/components/app/use-app-persistence-state.test.tsx` (needs a `matchMedia` stub). MCP server tests: `mcp-server/src/history.test.ts`, `mcp-server/src/content-store.test.ts` (and others in `mcp-server/src/`).
- E2E smoke: `pnpm test:e2e` = `pnpm e2e:build` (static export with PocketBase pointed at `127.0.0.1:8090`, so it never reaches prod) + `playwright test` via `playwright.config.ts`. Server `e2e/static-server.mjs` on port 5010; specs in `e2e/`; runs in the dev workspace.
- CI: `.github/workflows/ci.yml` on PRs to `main` and pushes to `dev`. Jobs: `checks` (lint, typecheck, Vitest, MCP build, `pnpm kb:lint --warn`) and `e2e` (Playwright). First run on `dev` passed (2026-10-31).
- UI check: `http://localhost:5005/<route>?devWorkspace=1` (local workspace, no login; reuse a running dev server on 5005). Test 375px and ≥1280px, dark and light (remove `dark` class on `<html>` or use the profile menu).
- Real sync testing: local PocketBase + `pnpm dev:test` on `http://dailytodo.localhost:5005` (see [pocketbase.md](pocketbase.md)).
- Port 5005 may be held by another worktree's dev server; `.claude/launch.json` has a `dev-test-5006` entry (test DB on port 5006).
- Known, pre-existing: with `?devWorkspace=1` against the local test DB, note creates fail with 400 (fake owner `dev-browser-workspace`). Not a bug in your change.
- If `tsc` can't find `@tauri-apps/plugin-notification`, run `pnpm install` (it's in `package.json` but may be missing locally).
- More: `.agents/skills/vitest-testing/`.

## Gotchas
- `pnpm dev` hits the **production** DB.
- Schema changes: add a regression test in `src/lib/pocketbase-schema-admin.test.ts`.
- `next dev` crashed mid-run ("Unexpected end of JSON input") under Playwright — use the static export, not the dev server.
- Piping a check into `tail` hides its exit code: don't chain `pnpm typecheck | tail && git commit` — the commit runs even if typecheck failed.

## Related
[pocketbase.md](pocketbase.md), [dev-environment.md](dev-environment.md), [decisions.md](decisions.md)
