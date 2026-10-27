# Sync & persistence
Last verified: 2026-10-27

PocketBase is the single source of truth. Each device only sends its **own changes**, one record
at a time, through a persisted outbox. A device never compares its whole copy with the server.

## How it works
- Phases in `src/components/app/use-app-persistence-state.ts`:
  - **cached** — this device's copy, shown instantly but read-only (`dispatch` drops content-changing actions; `MarkdownEditor` is non-editable via `useIsWorkspaceReadOnly`).
  - **ready** — server data loaded (`loadServerState`), with queued local edits laid on top (`applySyncOpsToState`).
  - **load-failed** — server unreachable: cached copy read-only + Retry; no cache → error screen. Never a blank seeded workspace.
- In `ready`, each state change is diffed against this device's *previous* state (`diffSyncRecords` in `src/lib/sync-outbox.ts`) into per-record ops in the outbox (`dailytodo.outbox.v1.<userId>`, coalesced by key). Flushed after 600 ms; immediately on pagehide/hidden/retry; retried on online/focus/every 30 s.
- Records missing on the server (today's carryover, first-run defaults) are created by `getMissingRecordOps`, which only creates.
- Version check: each op carries the server `updated_at_client` the device last saw. A daily page changed elsewhere is merged (`mergeDailyPageConflict`: todos by id; both note texts kept if both changed). Other kinds: last write wins.
- Focus/visibility refreshes from the server.
- Repository (`src/lib/split-persistence-repository.ts` + `src/lib/pocketbase/persistence-repository.ts`): reads all collections (pure read; memory collections with `getFullList`, only the newest `CHANGE_LOG_LOAD_LIMIT` = 300 `change_log` rows; a 404 = collection missing reads as empty), writes one record per op (`applyOps`, looked up by unique key; legacy Main pages with empty `workspace_id` are updated, not duplicated). `app_state_snapshots` is no longer written.
- Server data that fails validation throws (`parseAppStateOrThrow`) instead of becoming an empty workspace.
- Status label: Loading latest… / Offline · read-only / N changes waiting (visible on phones too).

## Safety rules
- **Never-deleted kinds:** `NEVER_DELETED_KINDS` / `isNeverDeletedKind` in `src/lib/sync-outbox.ts` = `daily_page`, `app_note`, the 6 memory kinds (`task`, `decision`, `project`, `meeting`, `follow_up`, `repeat`) and `change_log`. `diffSyncRecords` never builds removals for them and the repository `applyOps` skips their deletes; server `deleteRule` is null. App notes and memory records only soft-delete (`deletedAt`). Use this set for any new never-deleted kind.
- Memory kinds sync upsert-only with keys `<kind>:<id>`. `change_log` syncs **create-only** (`change_log:<id>`): an entry already on the server counts as written and is never PATCHed (`updateRule` null → 403 would freeze the outbox).
- More than `MAX_UNEXPLAINED_DELETES` (5) deletes in one change, not explained by a parent-folder delete, are dropped as a bug.
- Records identical to the server (`fingerprintSyncValue`, key-order-independent) are never re-sent.

## Gotchas
- **2026-10-07 data loss:** the old whole-copy sync deleted every server record a stale tab didn't have and wiped all past daily pages twice (53 restored from an old browser cache; 25 Sep–6 Oct lost). Recovery files: git-ignored `pocketbase-local/recovery-2026-10-07/`.
  - Never add logic that deletes or overwrites server records based on what a device *lacks*.
  - Never seed or replace the workspace on load failure.
  - Never use a low-priority `startTransition` for the cached-state `setState` (it landed after server data and resurrected the stale copy).
- The prod deploy, prod schema apply and prod backups each need the user's OK.

## Related
[pocketbase.md](pocketbase.md), [todos.md](todos.md) (day advance), [architecture.md](architecture.md)
