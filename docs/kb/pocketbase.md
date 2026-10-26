# PocketBase
Last verified: 2026-10-27

Backend for auth and all synced data. Full setup guide: `docs/pocketbase.md`.

## How it works
- Collections: `daily_pages`, `notes`, `note_folders`, `planner_presets`, `content_boards`, `content_cards`, `app_notes` (see [app-notes.md](app-notes.md)), `workspace_state` (legacy `app_state_snapshots` kept, unused). External brain (see [external-brain.md](external-brain.md); in the schema script, **not yet applied to prod**): `tasks`, `decisions`, `projects`, `meetings`, `follow_ups`, `repeats` (built by `softDeleteCollection()`, no delete rule) and append-only `change_log` (no update or delete rule). The user token gets 403 on DELETE for all of these and on PATCH of `change_log` (verified locally). `src/lib/pocketbase-schema-admin.test.ts` covers 16 collections.
- Schema lives in `scripts/lib/pocketbase-schema.mjs`; apply with `pnpm pocketbase:schema:apply` (admin creds via env). It reconciles fields/indexes/rules, never deletes collections or fields.
- `daily_pages.workspace_id` scopes owner/date uniqueness (unique index owner/workspace/date). `workspace_state` holds `todo_workspaces_json` and `selected_todo_workspace_id`. `content_boards.series_json` holds the content series list; `content_cards.series_id` links a card (both non-required).
- Daily backups: `pnpm pocketbase:backups:enable` (03:00, keep 7, in server `pb_data/backups`).
- **Local vs prod:** `pnpm dev` uses the **production** PocketBase — localhost edits real data. For safe tests: `pnpm pocketbase:local` (git-ignored `pocketbase-local/`), `pnpm pocketbase:schema:apply:local`, optional `pnpm pocketbase:seed:local`, then `pnpm dev:test` and open `http://dailytodo.localhost:5005`. On `localhost`/`127.0.0.1` the app forces the offline dev workspace, so real login + sync only runs on a non-loopback name. Local creds: git-ignored `.env.test.local`; prod admin creds: `.env.local`.

## Gotchas
- **Required-empty trap (recurring bug family):** a `required: true` field rejects `[]`, `{}`, `0` and `""` with HTTP 400. Past hits: `daily_pages.todos_json` rejected `[]` and froze daily sync for weeks (fixed 2026-09-03; "note repeats every day"); `content_cards.position` rejected `0` and `title` rejected `""` (fixed, prod 2026-10-01). **Rule: any field that can legitimately be empty or zero must be non-required.** Add a regression test in `src/lib/pocketbase-schema-admin.test.ts`. Covered today: `daily_pages.todos_json`, `content_cards.position`/`title`/`published_at`. A bool rejects `false` the same way (`repeats.active` is non-required for this reason). **Not yet covered:** `content_cards.links`, `content_cards.transcript`, `content_cards.series_id` and `content_boards.series_json` (all non-required) — add checks next time content card fields change.
- Text fields default to ~5000 chars; set an explicit `max` for long text (e.g. `content_cards.transcript` max 200000).
- New fields: apply the schema to prod **before** deploying code that writes them — PocketBase silently drops unknown fields. Applying schema to prod needs the user's OK. A brand-new collection can ship first if the load treats a 404 as empty (as `app_notes` does).
- `pnpm pocketbase:schema:apply` has no dry-run. To preview a prod change, call `mergeCollectionDefinition` (`scripts/lib/pocketbase-schema.mjs`) read-only against the live collection first.

## Related
[sync-persistence.md](sync-persistence.md), `docs/pocketbase.md`
