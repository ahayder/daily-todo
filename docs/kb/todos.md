# Todos & daily pages
Last verified: 2026-10-11

`/todos` shows one day: a Daily note (markdown) beside tasks grouped by priority. Days live in
Todo workspaces; unfinished work carries forward to the next day automatically.

## How it works
- **Carryover:** when a new day is created (`ensureDailyPageForDate` → `createCarryoverDailyPage` in `src/lib/store.ts`), incomplete todos and the markdown of the latest earlier page in the active workspace are copied forward. Copied task ids are deterministic; parent/subtask links are remapped. PocketBase backfills the synthesized `daily_pages` record during hydration.
- **Day advance:** `use-app-persistence-state.ts` dispatches `ensure-daily-today` once server data is loaded (phase `ready`, never from a stale cached copy), and again on window focus/visibility when the calendar day rolled over. The reducer carries the previous day forward and force-selects today, overriding a stale synced `selectedDailyDate` (the old cause of "same notes every day"). Picking a past day in the sidebar is unaffected.
- **Task attention** (`src/lib/task-attention.ts`): carryover keeps the original `createdAt`. Unfinished tasks show "From yesterday" / "N days waiting" relative to the displayed page. A temporary "Worth a look" filter keeps ancestor context and orders older tasks first within priority groups; drag is disabled during review; changing workspace/date clears it.
- **Todo workspaces:** create, switch, rename, confirm-delete. Each owns its own dated todos, daily notes, history and carryover; Notes, Daily Planner and Content Planner are shared. Existing data is the renameable, non-deletable `Main` workspace (`todo-workspace-main`, keeps legacy date-only keys). New workspaces start with an empty day. Switching keeps the selected date and clears the device-local focus timer.
- **Add task:** inline input at the bottom of each priority group (Apple Reminders style). No separate form.
- **Delete task:** instant, 8 s Undo toast (`showUndoToast`); Undo dispatches `restore-todo` (back at its original index). A stopped focus timer is not restored.
- **Small screens:** the note/task split becomes a `Todos` / `Daily note` switcher (Todos default); resize rail is desktop-only; text wraps; touch devices keep row actions visible and vertical scroll beats drag.
- Focus timer lives in `src/components/todos/`.

## Gotchas
- Changes to carryover behavior need the user's product judgment.
- Daily pages are never deleted (see [sync-persistence.md](sync-persistence.md)).
- To test carryover without waiting a day: super-admin "Simulate next day" (see [auth.md](auth.md)).

## Related
[sync-persistence.md](sync-persistence.md), [auth.md](auth.md), [decisions.md](decisions.md)
