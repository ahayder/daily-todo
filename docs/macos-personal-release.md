# Personal macOS Packaging and Updates

This setup is meant for your own Macs or a small trusted group. It does not use a paid Apple Developer account, so macOS Gatekeeper may block the app until you approve it manually in `System Settings > Privacy & Security`.

## What is in the repo now

- Tauri updater integration for GitHub Releases
- local updater signing key stored at `.tauri/keys/updater.key`
- public updater key already embedded in `src-tauri/tauri.conf.json`
- GitHub Actions workflow at `.github/workflows/release-macos.yml`
- version sync script at `scripts/sync-app-version.mjs`

## One-time GitHub setup

1. Open `.tauri/keys/updater.key`.
2. Copy its full contents into the GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`.
3. Leave `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` empty unless you regenerate the key with a password.
4. Make sure the repository uses GitHub Releases and Actions with `contents: write`.

## Local build commands

Build the unsigned local macOS app on your current machine architecture:

```bash
pnpm tauri:build:mac
```

This generates the `.app`, `.dmg`, and updater artifacts in `src-tauri/target/release/bundle/`.

Do not add `--no-sign` to the build command. In this setup it also skips updater signing, which prevents GitHub Releases from getting the `latest.json` feed and `.sig` files required for in-app updates.

## Publishing an update

1. Bump `package.json` to the next version.
2. Run `pnpm version:sync`.
3. Commit the version change.
4. Push the commit.
5. Create and push a Git tag like `v0.1.1`.

Example:

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "Release v0.1.1"
git tag v0.1.1
git push origin main --tags
```

The GitHub Actions workflow will build macOS release assets, sign updater artifacts with the Tauri updater key, upload `latest.json`, and publish everything to the GitHub Release for that tag.

## Installing and updating on macOS

### First install

1. Download the `.dmg` from GitHub Releases.
2. Drag `DailyTodoApp.app` into `Applications`.
3. Open the app.
4. If macOS blocks it, go to `System Settings > Privacy & Security`.
5. Choose `Open Anyway`, then confirm.

### Future updates

1. Launch the installed app.
2. When a newer GitHub release exists, the app shows an update prompt.
3. Click `Update Now`.
4. If macOS blocks the newly replaced app bundle, approve it again in `Privacy & Security`.

## Important caveats

- This is suitable for personal use, not public distribution.
- Without Developer ID signing and notarization, Gatekeeper approval is expected.
- If you lose `.tauri/keys/updater.key`, you will not be able to sign future updates for existing installs.
