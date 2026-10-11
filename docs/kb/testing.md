# Testing & verifying
Last verified: 2026-10-11

## How it works
- Vitest + @testing-library/react: `pnpm test` (`pnpm test:watch`). Tests sit next to code (`*.test.ts(x)`). Pure — never touch any PocketBase.
- UI check: `http://localhost:5005/<route>?devWorkspace=1` (local workspace, no login; reuse a running dev server on 5005). Test 375px and ≥1280px, dark and light (remove `dark` class on `<html>` or use the profile menu).
- Real sync testing: local PocketBase + `pnpm dev:test` on `http://dailytodo.localhost:5005` (see [pocketbase.md](pocketbase.md)).
- More: `.agents/skills/vitest-testing/`.

## Gotchas
- `pnpm dev` hits the **production** DB.
- Schema changes: add a regression test in `src/lib/pocketbase-schema-admin.test.ts`.
