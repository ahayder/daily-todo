# Desktop (Tauri)
Last verified: 2026-10-31

Tauri 2 wraps the web app (`src-tauri/`) with a native in-app updater. The desktop app **bundles**
the static web build, so it only gets new UI through a new tagged release.

## How it works
- `next.config.ts` uses `output: "export"`; `pnpm build` = `version:sync` + web build into `out/`. `src-tauri/tauri.conf.json` `frontendDist: "../out"` (dev: `devUrl` `http://localhost:5005`).
- Updater UI/state: `src/components/workspace/desktop-update-provider.tsx`. Feed: `https://github.com/ahayder/daily-todo/releases/latest/download/latest.json` (pubkey in `tauri.conf.json`).
- Plugins: `tauri-plugin-updater`, `process`, `notification` — registered in `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json` (`notification:default`). JS side: `@tauri-apps/plugin-notification` 2.7.0.
- **Pings:** `src/components/today/ping-scheduler.tsx` (mounted in `Workspace`) checks every 30 s, only when `isTauri`; rules in `src/lib/memory/pings.ts` `duePings` ([external-brain.md](external-brain.md)). Notification permission is asked when the first ping is due, not at launch. On/off switch + sent ids: `src/lib/ping-settings.ts` (localStorage); toggled by the bell on Today.
- Release: bump `package.json` version → `pnpm version:sync` → commit → push tag `v*`. `.github/workflows/release-macos.yml` (macOS arm64 only; third-party actions pinned to SHAs, Dependabot updates them) runs `pnpm test`, needs repo variable `NEXT_PUBLIC_POCKETBASE_URL` and secret `TAURI_SIGNING_PRIVATE_KEY`, then publishes the GitHub Release with `latest.json`. Full steps: `docs/macos-personal-release.md`. More: `.agents/skills/tauri-desktop/`.
- Scripts: `pnpm tauri:dev`, `pnpm tauri:build`, `pnpm tauri:build:mac`.

## Gotchas
- Static export: dynamic route segments (`[id]`) don't work in the desktop build — use query strings + `useSearchParams` inside `<Suspense>` (e.g. `/memory/project?id=…`).
- **Open issue (not fixed; Ali 2026-10-31: desktop out of scope for now):** `isLocalDevelopmentWorkspaceForced` in `src/lib/dev-mode.ts` forces the offline dev workspace on hostname `localhost` even in production builds (commit 8fe6338, shipped in v2026.10.2). macOS Tauri serves from `tauri://localhost`, so the desktop app likely opens in the dev workspace (no login, no sync). Unverified on a real build. Fix idea: force only on `http(s):` protocols or when `!isTauri()`.
- Versions: `package.json` is at `2026.10.2` (desktop release v2026.10.2); tag `v2026.4.1` exists **without** a release — check tags/releases before tagging.
- `pnpm tauri:dev` runs `pnpm dev`, so it uses the local test PocketBase.
- Updater logic and the release workflow are product architecture, not a one-off script.
- Don't build with `--no-sign`: it also skips updater signing, so no `latest.json`/`.sig` and in-app updates break.
- Losing `.tauri/keys/updater.key` means existing installs can't be updated. Never commit or paste it.
- Builds are not notarized; macOS Gatekeeper asks for approval after install/update.

## Related
[mcp-server.md](mcp-server.md) (Coolify deploys), [dev-environment.md](dev-environment.md)
