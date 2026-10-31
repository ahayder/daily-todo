# Auth & account tools
Last verified: 2026-10-31

PocketBase email/password auth with verification and password reset. The workspace is auth-gated.

## How it works
- `src/components/auth/`: anonymous → `AuthGate`; unverified → `VerificationPendingScreen`; signed in → synced workspace. Reset landing page: `src/app/auth/reset/page.tsx`. Repository: `src/lib/pocketbase/auth-repository.ts`.
- `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` toggles verification (false for local/dev).
- **Dev workspace:** a device-local `AuthGate` button opens a fake local-only workspace (`src/lib/dev-mode.ts`, no sync). `?devWorkspace=1` opens it directly. Loopback hosts (`localhost`, `127.0.0.1`, `[::1]`) always force it; `dailytodo.localhost` doesn't, which is why real-sync testing uses that host. This force also applies in production builds — see the Tauri open issue in [desktop.md](desktop.md).
- **Dev auto-login:** `getDevAutoLoginCredentials` (`src/lib/auth-config.ts`, used by the `AuthProvider` hydrate flow) signs in to a **real** account when `NEXT_PUBLIC_DEV_AUTO_LOGIN_EMAIL` + `..._PASSWORD` are set, in a non-production build, on a local hostname (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`). Keep the vars in `.env.development.local` (read only by `next dev`).
- **Build guards:** `next.config.ts` throws on a production build if any `NEXT_PUBLIC_DEV_AUTO_LOGIN_*` is set. `scripts/check-bundle-secrets.mjs` runs after `next build` in `build:web` and `e2e:build`: scans `out/` for secret values (from env + local env files) and server-only var names, fails the build, never prints values.
- **Account menu** (`SidebarProfileMenu`, sidebar footer): every real user gets **Reset password** (`requestPasswordReset({ email })` → email → `/auth/reset`); hidden for the dev workspace.
- **Super-admin:** `isSuperAdmin(email)` in `src/lib/super-admin.ts` (owner allowlist, extend via `NEXT_PUBLIC_SUPER_ADMIN_EMAILS`). Owners see **Developer tools → Simulate next day**, dispatching `dev-advance-day`: takes the active workspace's latest page, synthesizes the next day via the real `ensureDailyPageForDate` → `createCarryoverDailyPage` path, and selects it.

## Gotchas
- Dev auto-login creds are bundled into the client — local development only. If they sit in `.env.local`, production builds now fail: move them to `.env.development.local` (Ali's one-time action after the 2026-10-31 security pass).
- Super-admin is a UI-visibility gate for personal testing, not a security boundary.

## Related
[todos.md](todos.md), [pocketbase.md](pocketbase.md)
