# Desktop (Tauri)
Last verified: 2026-10-27

Tauri 2 wraps the web app (`src-tauri/`) with a native in-app updater. The desktop app **bundles**
the static web build, so it only gets new UI through a new tagged release.

## How it works
- `next.config.ts` uses `output: "export"`; `pnpm build` = `version:sync` + web build into `out/`. `src-tauri/tauri.conf.json` `frontendDist: "../out"` (dev: `devUrl` `http://localhost:5005`).
- Updater UI/state: `src/components/workspace/desktop-update-provider.tsx`. Feed: `https://github.com/ahayder/daily-todo/releases/latest/download/latest.json` (pubkey in `tauri.conf.json`).
- Plugins: only `tauri-plugin-updater` (+ `process`) in `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`. No notification plugin yet.
- Release: bump `package.json` version → `pnpm version:sync` → commit → push tag `v*`. `.github/workflows/release-macos.yml` (macOS arm64 only) runs `pnpm test`, needs repo variable `NEXT_PUBLIC_POCKETBASE_URL` and secret `TAURI_SIGNING_PRIVATE_KEY`, then publishes the GitHub Release with `latest.json`. Full steps: `docs/macos-personal-release.md`. More: `.agents/skills/tauri-desktop/`.
- Scripts: `pnpm tauri:dev`, `pnpm tauri:build`, `pnpm tauri:build:mac`.

## Gotchas
- Updater logic and the release workflow are product architecture, not a one-off script.
- Don't build with `--no-sign`: it also skips updater signing, so no `latest.json`/`.sig` and in-app updates break.
- Losing `.tauri/keys/updater.key` means existing installs can't be updated. Never commit or paste it.
- Builds are not notarized; macOS Gatekeeper asks for approval after install/update.

## Related
[mcp-server.md](mcp-server.md) (Coolify deploys), [dev-environment.md](dev-environment.md)
