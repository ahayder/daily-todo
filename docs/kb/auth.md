# Auth & account tools
Last verified: 2026-10-31

PocketBase email/password auth with verification and password reset. The workspace is auth-gated.

## How it works
- `src/components/auth/`: anonymous → `AuthGate`; unverified → `VerificationPendingScreen`; signed in → synced workspace. Reset landing page: `src/app/auth/reset/page.tsx`. Repository: `src/lib/pocketbase/auth-repository.ts`.
- `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` toggles verification (false for local/dev).
- **Dev workspace:** a device-local `AuthGate` button opens a fake local-only workspace (`src/lib/dev-mode.ts`, no sync). `?devWorkspace=1` opens it directly. Loopback hosts (`localhost`, `127.0.0.1`, `[::1]`) always force it; `dailytodo.localhost` doesn't, which is why real-sync testing uses that host.
- **Dev auto-login:** `getDevAutoLoginCredentials` (`src/lib/auth-config.ts`, used by the `AuthProvider` hydrate flow) signs in to a **real** account when `NEXT_PUBLIC_DEV_AUTO_LOGIN_EMAIL` + `..._PASSWORD` are set in a non-production build.
- **Account menu** (`SidebarProfileMenu`, sidebar footer): every real user gets **Reset password** (`requestPasswordReset({ email })` → email → `/auth/reset`); hidden for the dev workspace.
- **Super-admin:** `isSuperAdmin(email)` in `src/lib/super-admin.ts` (owner allowlist, extend via `NEXT_PUBLIC_SUPER_ADMIN_EMAILS`). Owners see **Developer tools → Simulate next day**, dispatching `dev-advance-day`: takes the active workspace's latest page, synthesizes the next day via the real `ensureDailyPageForDate` → `createCarryoverDailyPage` path, and selects it.

## Gotchas
- Dev auto-login creds are bundled into the client — local development only, never set in production.
- Super-admin is a UI-visibility gate for personal testing, not a security boundary.

## Related
[todos.md](todos.md), [pocketbase.md](pocketbase.md)
