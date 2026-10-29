# Change requests (formerly "App notes")
Last verified: 2026-10-30

App-wide quick capture for requests about the app itself (Idea / Improvement / Bug), with a simple
list and MCP tools. Requests are **never hard-deleted**; delete is always soft (`deletedAt`).
Renamed from "App notes" on 2026-10-30 (UI, code, MCP tools), but the **stored names stay `app_note…`** (see below).

## How it works
- Open: lightbulb icon in the `TopNavbar` actions (`src/components/workspace/top-navbar.tsx`, tooltip "Change request (⌘⇧I)") or Cmd/Ctrl+Shift+I, handled in the keydown listener in `src/components/workspace/workspace.tsx` (works in focus mode, where the navbar is hidden). Workspace saves the focused element in `changeRequestsReturnFocusRef` before opening so focus returns there on close.
- Dialog: `ChangeRequestDialog` in `src/components/change-requests/change-request-dialog.tsx` (test: `src/components/change-request-dialog.test.tsx`), mounted in `workspace.tsx`. Title "Change request". Textarea + `SegmentedControl` for type + "Save request" (⌘↵ anywhere in the capture area); after saving the box clears, the dialog stays open and shows "Saved". Below: "Your change requests", open ones newest first (type tag, date, screen label), row actions mark done / edit / delete ("Request deleted" + inline undo), "Show done (n)". Read-only "Connecting…" while `sync.isReadOnly`.
- Data: `ChangeRequest` {id, text, kind, status `open|done`, screen, createdAt, updatedAt, deletedAt} in `AppState.changeRequests` (`src/lib/types.ts`). Reducer actions `create-|update-|delete-|restore-change-request`. Store helpers in `src/lib/store.ts`: `createChangeRequest`, `updateChangeRequest`, `setChangeRequestDeleted`, `getVisibleChangeRequests`.
- Sync: record kind `app_note`, key `app_note:<id>` (`src/lib/sync-outbox.ts`). Collection `app_notes`: `owner`, `note_id` (required), `updated_at_client` (required), `text`/`kind`/`status`/`screen`/`created_at_client`/`deleted_at` optional; unique index (owner, note_id); `deleteRule` null. Schema in `scripts/lib/pocketbase-schema.mjs` (on prod since 2026-10-26).
- Row mapping: `changeRequestFromRow` / `changeRequestToRow` exported from `src/lib/pocketbase/persistence-repository.ts`; mirrored in `mcp-server/src/content-store.ts` (`rowToChangeRequest` / `changeRequestToPayload`, store method `saveChangeRequest`) — **keep both in sync**.
- Load tolerates a missing `app_notes` collection (404 → `[]`, `isNotFoundError`).
- MCP tools (`*_change_request`): see [mcp-server.md](mcp-server.md).

## Stored names kept on purpose
- Still `app_note`-named so there's no prod migration and **older desktop builds keep syncing**: the PocketBase collection `app_notes` (field `note_id`), the sync + change-log kind `"app_note"` (keys `app_note:<id>`), and the id prefix `app-note-`. Each has a "Stored name kept" comment in code. Don't rename them.
- `src/lib/persistence.ts` reads the old local-cache key `appNotes` as a fallback for `changeRequests`.

## Never hard-deleted (3 layers)
- `diffSyncRecords` never turns a missing `app_note` into a removal (same as `daily_page`).
- Repository `applyOps` skips `app_note` delete ops.
- Server `deleteRule` is null. The MCP `ContentStore` has no delete method (test in `mcp-server/src/tools.test.ts`).

## Gotchas
- **Known gap:** requests saved in the app UI write **no** `change_log` entries; only MCP writes show up in History.
- **Undo toast can't be clicked while a Base UI modal Dialog is open** (toast sits under the backdrop and the modal blocks outside pointer events). Undo for delete is shown inline inside the dialog instead. Applies to any modal that wants an undo.
- **Esc in an inline editor inside a Base UI Dialog closes the whole dialog**; React `stopPropagation` doesn't help. Intercept in the dialog's `onOpenChange` while editing.
- `DialogContent` grid needs `grid-cols-[minmax(0,1fr)]` + `[overflow-wrap:anywhere]` or long unbroken text overflows.
- Prod schema apply has no dry-run; preview first by calling `mergeCollectionDefinition` (in `scripts/lib/pocketbase-schema.mjs`) read-only.
- Known Low leftovers: dialog recenters/jumps as items are added; tooltip always says ⌘⇧I (Ctrl+Shift+I is DevTools on Win/Linux); in focus mode on phone there's no way to open it. QA report: `.design/qa/2026-10-26-app-notes.md`.

## Related
[mcp-server.md](mcp-server.md), [sync-persistence.md](sync-persistence.md), [pocketbase.md](pocketbase.md), [decisions.md](decisions.md), [ui-design.md](ui-design.md)
