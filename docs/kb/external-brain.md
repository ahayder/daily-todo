# External brain (tasks, decisions, memory, change log)
Last verified: 2026-10-27

Backend for the "chat captures, the app shows" redesign ([user-needs.md](user-needs.md)): chat
saves tasks, decisions, projects, meetings, follow-ups and repeats through MCP, and every MCP
write is logged so it can be undone. **Milestone 1 only: schema + pure logic + MCP tools, no UI.**
Live on prod since 2026-10-27 (schema applied, MCP server redeployed).

## How it works
- **Collections** (`scripts/lib/pocketbase-schema.mjs`, helper `softDeleteCollection()`): `tasks`,
  `decisions`, `projects`, `meetings`, `follow_ups`, `repeats`. Same shape as `app_notes`: `deleteRule`
  null (soft delete only), only `owner`, `<kind>_id`, `updated_at_client` required, optional
  `deleted_at`/`created_at_client` dates, unique (owner, id) index, `tags_json` json (2 MB).
  `repeats.active` is a non-required bool (PocketBase treats `false` as blank).
- **`change_log`** is append-only: `updateRule` and `deleteRule` both null. Required `owner`,
  `change_id`, `at`; also `batch_id`, `entity_kind`, `entity_id`, `action`, `source`, `summary`,
  `ref_change_id`, `before_json`, `after_json`. `change_id` is time-sortable; lists sort by it.
- **Types** in `src/lib/types.ts`: `Task`, `Decision`, `Project`, `Meeting`, `FollowUp`, `Repeat`,
  `ChangeLogEntry`, `LifeArea`, `Weekday`, `MemoryKind`/`MemoryKindMap`, `MEMORY_KINDS`.
- **Pure helpers** in `src/lib/memory/`:
  - `dates.ts`: `dayInZone`/`todayIn` (Intl `en-CA`), `DEFAULT_TIME_ZONE` = Asia/Dhaka.
  - `records.ts`: `cleanTags` (lower-case, strips `#`), `patchRecord` (returns the same map when nothing changed), `setRecordDeleted`.
  - `tasks.ts` `getTodayView`: blocks from the planner preset for that weekday; today's tasks; repeats as virtual tasks with id `repeat:<id>`; shelf = open with no day; leftovers = open with a day before today, with `daysWaiting`. **Nothing is copied forward** (unlike daily-page carryover).
  - `decisions.ts`: `logDecision` with a replaces-chain (old one gets `replacedById`), `decisionChain`.
  - `meetings.ts`: the raw transcript is kept only when `storeTranscript` is set (privacy).
  - `repeats.ts` `repeatsForDate`; `search.ts` (all words must match, tag filter, `collectTags`).
  - `standup.ts`: `since` defaults to the previous Mon–Fri workday; area defaults to `job`; records with no area are kept.
- **Undo/redo logic** in `src/lib/change-log.ts`: `buildChange`, `summarizeChange`, `canUndo`
  (the record must equal the entry's `after`, ignoring `updatedAt`), `undoTarget` (the `before`
  state, or a soft delete if the change was a create), `canRedo`/`redoTarget` (re-applies the undo
  entry's own `before`).
- MCP side (stores, `withHistory`, tools): see [mcp-server.md](mcp-server.md).

## Gotchas
- Undo is allowed whenever the record is back to exactly the change's `after` state, even if
  other edits happened in between (e.g. complete → reopen → complete). By design.
- A create of a kind with no `deletedAt` (content cards, the content board) can't be undone —
  there's no soft delete to fall back on.
- "Today" is the day in `USER_TIMEZONE` (Asia/Dhaka), not the machine's date. They can differ
  near midnight; that is correct.
- Every new field that can be empty/zero/false must stay non-required ([pocketbase.md](pocketbase.md)).

## Related
[mcp-server.md](mcp-server.md), [pocketbase.md](pocketbase.md), [user-needs.md](user-needs.md), [decisions.md](decisions.md), [app-notes.md](app-notes.md)
