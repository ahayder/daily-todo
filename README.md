# DailyTodoApp

DailyTodoApp is a warm, notebook-inspired productivity app built with Next.js and wrapped with Tauri for a personal macOS desktop build.

## Local development

Run the web app:

```bash
pnpm install
pnpm dev
```

Run the desktop shell during development:

```bash
pnpm tauri:dev
```

The production desktop build uses the static Next.js export in `out/`, so `pnpm build` automatically synchronizes the desktop version before Tauri bundles the app.

## Personal macOS release flow

For your own Macs, this repo now supports:

- installable macOS `.app` and `.dmg` bundles
- GitHub Releases based updater metadata
- in-app update prompts with download, install, and relaunch

Release and updater instructions live in [docs/macos-personal-release.md](/Users/ahayder/Library/CloudStorage/GoogleDrive-alihayder19@gmail.com/My%20Drive/Area%20-%20PARA/DailyTodoProject/DailyTodoApp/docs/macos-personal-release.md).
