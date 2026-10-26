# App notes ("Note for the app")
Last verified: 2026-10-26

App-wide quick capture for notes about the app itself (Idea / Improvement / Bug), with a simple
list and MCP tools. Notes are **never hard-deleted** — delete is always soft (`deletedAt`).

## How it works
- Open: lightbulb icon in the `TopNavbar` actions (`src/components/workspace/top-navbar.tsx`, tooltip "Note for the app (⌘⇧I)") or Cmd/Ctrl+Shift+I, handled in the keydown listener in `src/components/workspace/workspace.tsx` (works in focus mode, where the navbar is hidden). Workspace saves the focused element in `appNotesReturnFocusRef` before opening so focus returns there on close.
- Dialog: `src/components/app-notes/app-notes-dialog.tsx`, mounted in `workspace.tsx`. Textarea + `SegmentedControl` for type + "Save note" (⌘↵ anywhere in the capture area); after saving the box clears, the dialog stays open and shows "Saved". Below: open notes newest first (type tag, date, screen label), row actions mark done / edit / delete, "Show done (n)". Read-only "Connecting…" while `sync.isReadOnly`.
- Data: `AppNote` {id, text, kind, status `open|done`, screen, createdAt, updatedAt, deletedAt} in `AppState.appNotes` (`src/lib/types.ts`). Store helpers in `src/lib/store.ts`: `createAppNote`, `updateAppNote`, `setAppNoteDeleted`, `getVisibleAppNotes`.
- Sync: record kind `app_note`, key `app_note:<id>` (`src/lib/sync-outbox.ts`). Collection `app_notes`: `owner`, `note_id` (required), `updated_at_client` (required), `text`/`kind`/`status`/`screen`/`created_at_client`/`deleted_at` optional; unique index (owner, note_id); `deleteRule` null. Schema in `scripts/lib/pocketbase-schema.mjs` (applied to prod 2026-10-26).
- Row mapping: `appNoteFromRow` / `appNoteToRow` exported from `src/lib/pocketbase/persistence-repository.ts`; mirrored in `mcp-server/src/content-store.ts` (`rowToAppNote` / `appNoteToPayload`) — **keep both in sync**.
- Load tolerates a missing `app_notes` collection (404 → `[]`, `isNotFoundError`), so web code can ship before the schema.
- MCP tools: see [mcp-server.md](mcp-server.md).

## Never hard-deleted (3 layers)
- `diffSyncRecords` never turns a missing `app_note` into a removal (same as `daily_page`).
- Repository `applyOps` skips `app_note` delete ops.
- Server `deleteRule` is null. The MCP `ContentStore` has no delete method (test in `mcp-server/src/tools.test.ts`).

## Gotchas
- **Undo toast can't be clicked while a Base UI modal Dialog is open** (toast sits under the backdrop and the modal blocks outside pointer events). Undo for delete is shown inline inside the dialog instead. Applies to any modal that wants an undo.
- **Esc in an inline editor inside a Base UI Dialog closes the whole dialog**; React `stopPropagation` doesn't help. Intercept in the dialog's `onOpenChange` while editing.
- `DialogContent` grid needs `grid-cols-[minmax(0,1fr)]` + `[overflow-wrap:anywhere]` or long unbroken text overflows.
- Prod schema apply has no dry-run; preview first by calling `mergeCollectionDefinition` (in `scripts/lib/pocketbase-schema.mjs`) read-only.
- Known Low leftovers: dialog recenters/jumps as notes are added; tooltip always says ⌘⇧I (Ctrl+Shift+I is DevTools on Win/Linux); in focus mode on phone there's no way to open it. QA report: `.design/qa/2026-10-26-app-notes.md`.

## Related
[mcp-server.md](mcp-server.md), [sync-persistence.md](sync-persistence.md), [pocketbase.md](pocketbase.md), [decisions.md](decisions.md), [ui-design.md](ui-design.md)
