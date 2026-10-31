# External brain (tasks, decisions, memory, change log)
Last verified: 2026-10-31

Backend + UI for the "chat captures, the app shows" redesign ([user-needs.md](user-needs.md)): chat
saves tasks, decisions, projects, meetings, follow-ups and repeats through MCP; the app shows them
on **Today** (`/today`), **Memory** (`/memory`, `/memory/project?id=…`), **Standup** (`/standup`)
and lists every change on **History** (`/history`), with undo; desktop pings nudge.
M1 (schema, logic, MCP tools) live on prod since 2026-10-27. M2 (Today + History, app sync) and
M3 (Memory, Project, Standup, pings; plan `docs/plans/2026-10-27-external-brain-m3.md`) are on
`dev`; release status in [project.md](project.md).

## How it works
- **Collections** (`scripts/lib/pocketbase-schema.mjs`, helper `softDeleteCollection()`): `tasks`,
  `decisions`, `projects`, `meetings`, `follow_ups`, `repeats`. Same shape as `app_notes` (change requests): `deleteRule`
  null (soft delete only), only `owner`, `<kind>_id`, `updated_at_client` required, optional
  `deleted_at`/`created_at_client` dates, unique (owner, id) index, `tags_json` json (2 MB).
  `repeats.active` is a non-required bool (PocketBase treats `false` as blank).
- **`change_log`** is append-only: `updateRule` and `deleteRule` both null. Required `owner`,
  `change_id`, `at`; also `batch_id`, `entity_kind`, `entity_id`, `action`, `source`, `summary`,
  `ref_change_id`, `before_json`, `after_json`. `change_id` is time-sortable; lists sort by it.
- **Types** in `src/lib/types.ts`: `Task`, `Decision`, `Project`, `Meeting`, `FollowUp`, `Repeat`,
  `ChangeLogEntry`, `LifeArea`, `Weekday`, `MemoryKind`/`MemoryKindMap`, `MEMORY_KINDS`, `MemoryData`.
- **In app state:** `AppState.memory: MemoryData` (one map per kind; `emptyMemoryData()` in
  `src/lib/memory/data.ts`) and `AppState.changeLog: Record<id, ChangeLogEntry>`. Zod (`schema.ts`)
  drops only broken records; persistence normalize defaults both to empty. Load/sync: see
  [sync-persistence.md](sync-persistence.md).
- **Row mappers** (shared by app and MCP): `src/lib/pocketbase/memory-rows.ts`;
  `mcp-server/src/memory-store.ts` re-exports them. Payload `updated_at_client` = the record's `updatedAt`.
- **Pure helpers** in `src/lib/memory/`:
  - `dates.ts`: `dayInZone`/`todayIn` (Intl `en-CA`), `DEFAULT_TIME_ZONE` = Asia/Dhaka.
  - `records.ts`: `cleanTags` (lower-case, strips `#`), `patchRecord` (returns the same map when nothing changed), `setRecordDeleted`.
  - `tasks.ts` `getTodayView`: blocks from the planner preset (`plannerEventsForDay`: Mon–Fri all read the `monday` day, like the planner UI); today's tasks; repeats as virtual tasks with id `repeat:<id>`; shelf = open with no day; leftovers = open with a day before today, with `daysWaiting`. **Nothing is copied forward** (unlike daily-page carryover).
  - `decisions.ts`: `logDecision` with a replaces-chain (old one gets `replacedById`), `decisionChain`.
  - `meetings.ts`: the raw transcript is kept only when `storeTranscript` is set (privacy).
  - `repeats.ts` `repeatsForDate`; `search.ts` (all words must match, tag filter, `collectTags`).
  - `standup.ts`: `since` defaults to the previous Mon–Fri workday; area defaults to `job`; records with no area are kept.
  - `today-screen.ts`: `selectedPlannerPreset` (selected, else newest), `minutesInZone`, `getNow`, `shortDuration`, `aiChangesToday`.
  - `history-view.ts`: `describeChange` (kind `app_note` → "Saved change request"), `sourceLabel` (You / Claude / ChatGPT / An AI chat), `buildHistory` (one row per batch; undo/redo entries hidden and shown as the original row's "undone" status; grouped by day in Asia/Dhaka; `count` for "Undo all N").
  - `memory-screen.ts` (Memory/Project view models): `projectGroups` (active vs paused/done), `decisionLog` (with `replacedBy` and links like "1 open task" / "Repeats Mon/Wed/Fri"), `decisionTags`, `waitingByPerson` (`daysWaiting`), `projectView` (where-labels + timeline from `changeLog` of the project and its records), `nextStepTask`, `projectHref`.
  - `pings.ts` `duePings`: weekdays only, 08:00–18:00 Asia/Dhaka; a ping when a block with an open task starts (3-min grace) and a standup heads-up 10 min before `STANDUP_TIME` (16:00); none while the app is focused; deduped by ping id.
  - `standup.ts` `buildStandupAgenda` feeds `/standup` (area `job`).
- **Undo/redo core** in `src/lib/change-log.ts`: `buildChange`, `summarizeChange`, `canUndo`
  (the record must equal the entry's `after`, ignoring `updatedAt`), `undoTarget` (the `before`
  state, or a soft delete if the change was a create), `canRedo`/`redoTarget` (re-applies the undo
  entry's own `before`).
- **App edits:** `src/lib/memory/app-actions.ts` — reducer actions `memory-add-task`,
  `memory-schedule-task`, `memory-complete-task`, `memory-reopen-task`, `memory-complete-repeat`,
  `memory-resolve-follow-up`, `memory-reopen-follow-up`, `memory-update-project` (state / nextStep /
  status), `memory-set-decision-status`, `undo-change`, `undo-batch`, `redo-change` (optional `batchId` so the UI can undo its own edit).
  `appReducer` runs `applyMemoryAction` first. They go through `src/lib/memory/app-history.ts`
  `writeWithHistory` (logs `source: "app"`); batch undo/redo is all-or-nothing, same rules as
  `mcp-server/src/history.ts`, with its own plain refusal text. `memory-add-task` accepts
  `projectId`/`area` (Project page "Do today" creates a task in the project).
- **UI:** `src/components/today/` (`today-view`, `history-view`, `task-row`, `use-history-actions`,
  `ping-scheduler`), `src/components/memory/` (`memory-view`, `project-view`, `standup-view`,
  `memory-parts`); routes `src/app/{today,history,memory,memory/project,standup}`. Layout and UX:
  [ui-design.md](ui-design.md). Pings (desktop only): [desktop.md](desktop.md).
- **Device-local (localStorage):** standup ticks `dailytodo.standup.ticks` (reset daily); pings switch
  `dailytodo.pings.enabled` (default on) and sent ids `dailytodo.pings.sent` (per day) in `src/lib/ping-settings.ts`.
- MCP side (stores, `withHistory`, tools): see [mcp-server.md](mcp-server.md).

## Gotchas
- Undo is allowed whenever the record is back to exactly the change's `after` state, even if
  other edits happened in between (e.g. complete → reopen → complete). By design.
- A create of a kind with no `deletedAt` (content cards, the content board) can't be undone —
  there's no soft delete to fall back on.
- "Today" (date and current minutes) is the day in Asia/Dhaka (`DEFAULT_TIME_ZONE` in the app,
  `USER_TIMEZONE` in MCP), not the device's zone. They can differ near midnight; that is correct.
- Every new field that can be empty/zero/false must stay non-required ([pocketbase.md](pocketbase.md)).
- Planner weekdays: the planner UI only edits `monday` (= all weekdays), `saturday`, `sunday`.
  Anything reading planner blocks must go through `plannerEventsForDay` (old bug: Tue–Fri read
  stale `tuesday`–`friday` days; fixed in `getTodayView` and MCP `resolveBlock`).
- `canUndo` reasons mention `redo_change` and `summarizeChange` lists raw field names — MCP
  wording. The app uses `app-history.ts` refusals and `history-view.ts` `describeChange` instead.
- Only external-brain edits made in the app write `change_log`. Content Planner and change-request edits
  in the app don't yet (follow-up), so History doesn't show them (MCP edits of both do show).
- Project page uses `/memory/project?id=…`, not `/memory/[id]`: the desktop app is a static export,
  so dynamic segments don't work. Read the id with `useSearchParams` inside `<Suspense>`.
- Meetings show the summary only, never the transcript.
- Testing real sync: on `localhost` the app forces the offline dev workspace; use
  `http://dailytodo.localhost:5005` with `pnpm dev:test` + local PocketBase ([testing.md](testing.md), [dev-environment.md](dev-environment.md)).

## Related
[mcp-server.md](mcp-server.md), [sync-persistence.md](sync-persistence.md), [pocketbase.md](pocketbase.md), [user-needs.md](user-needs.md), [decisions.md](decisions.md), [change-requests.md](change-requests.md), [desktop.md](desktop.md), [ui-design.md](ui-design.md)
