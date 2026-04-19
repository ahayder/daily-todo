---
name: tauri-desktop
description: >
  Apply the Tauri Desktop skill when building, configuring, or modifying the desktop app shell.
  Use this skill specifically when updating tauri.conf.json, handling the updater, GitHub releases,
  or resolving macOS app compilation / gatekeeper issues.
---

# Tauri Desktop Shell

> **This skill governs the Tauri application layer of DailyTodoApp.** The desktop app is built with Tauri 2, utilizing an in-app updater and GitHub Actions for continuous deployment.

---

## 1. Native API Fallbacks

DailyTodoApp shares exactly the same Next.js React code between the Web Browser version and the Tauri Desktop version.

**Crucial Rule:** Any feature using a Tauri-specific API (such as `window.__TAURI__`, or `@tauri-apps/plugin-*`) MUST fail gracefully if run in a standard web browser.

Always check for the Tauri environment before executing desktop-only logic:
```typescript
const isDesktop = "__TAURI__" in window;
if (isDesktop) {
  // run Tauri updater check
} else {
  // web safe fallback
}
```

---

## 2. The Auto-Updater & Releases

DailyTodoApp uses the Tauri Updater, configured via `src-tauri/tauri.conf.json` mapping to a `latest.json` file hosted on GitHub Releases.

### macOS Release Protocol
As defined in `docs/macos-personal-release.md`:
1. The project does NOT use paid Apple Developer signing. It relies on local self-signing for the updater.
2. The automatic updater requires a specialized private key located locally at `.tauri/keys/updater.key`.
3. When building locally for MacOS, do NOT use `--no-sign`, as this will destroy the updater signature (`.sig` files). Use `pnpm tauri:build:mac`.

### Bumping Versions
To trigger a new update:
1. Update standard version in `package.json`.
2. Run `pnpm version:sync` to ensure `tauri.conf.json` matches.
3. Commit, push, and release a new tag (e.g. `v0.2.0`). 
The GitHub Action will handle artifact compilation and release file uploads.

---

## 3. Desktop UI Specifics

When modifying the desktop shell appearance (`desktop-update-provider.tsx` or similar):
- **Window Controls:** The standard macOS/Windows traffic lights are used. Do not attempt to draw custom window controls unless explicitly requested.
- **Top Bar:** The `top-navbar.tsx` contains the standard updater indicator icon. Maintain alignment and spacing for macOS traffic light offsets if necessary.

---

## 4. Checklist

Before merging Tauri changes:
- [ ] Safe `isDesktop` fallbacks exist for web execution.
- [ ] Version numbers are strictly synchronized (`pnpm version:sync`) before a release.
- [ ] Necessary Tauri permissions are declared inside the `src-tauri/capabilities/` JSON files when adding new plugins.
