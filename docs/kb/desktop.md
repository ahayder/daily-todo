# Desktop (Tauri)
Last verified: 2026-10-11

Tauri 2 wraps the web app (`src-tauri/`) with a native in-app updater.

## How it works
- Updater UI/state: `src/components/workspace/desktop-update-provider.tsx`; config in `src-tauri/tauri.conf.json`.
- Scripts: `pnpm tauri:dev`, `pnpm tauri:build`, `pnpm tauri:build:mac`; `pnpm version:sync` (runs in `pnpm build`) syncs the app version.
- Mac release steps: `docs/macos-personal-release.md`. More detail: `.agents/skills/tauri-desktop/`.

## Gotchas
- Updater logic and the release workflow are product architecture, not a one-off script.
