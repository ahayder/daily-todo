# Daily Planner
Last verified: 2026-10-14

`/planner` is a calm, full-width, ADHD-first page with two modes: **Now** (daily, read-only) and
**Set up** (rare editing). No sidebar.

## How it works
- One planner: the selected preset from `ensurePlannerState`. Top toggle switches Now ↔ Set up.
- **Now:** picks today's template with `dayKeyForDate(new Date())` (Sun→`sunday`, Sat→`saturday`, Mon–Fri→`monday`). `src/lib/planner-now.ts` gives the current block (card: title, start–end, shrinking progress bar, "N min/h left"), a vertical strip of the day (`start–end · name`, next block labelled, gaps ≥15 m shown as "Free — your call"), and an optional read-only 24h pie behind a clock icon (one accent, "now" dot). Off-plan is silent. Re-reads the clock every 30 s.
- **Set up:** tabs Weekday / Saturday / Sunday (`PLANNER_TEMPLATE_TABS`). Each is a list of blocks (two `<input type="time">`, a name, confirm-gated delete) using `create-/update-/delete-planner-event` (`purposeId: null`), auto-saved. `+ Add block` uses `getDefaultPlannerSliceRange`. Small clock preview + summary on top.
- 24h clock geometry: `src/components/planner/planner-radial-utils.ts` (preview only, never an editor).

## Gotchas
- Only `monday`/`saturday`/`sunday` are read; `tuesday`–`friday` are ignored (no write-mirroring).
- Purposes, budgets, roles and extra presets stay in data/storage but are unused by the UI (no migration). Storage unchanged: subtitle/creation metadata share `days_json`; purposes live inside their day.
- The planner-preset branch in `sidebar.tsx` and `planner-tour.tsx` are dead but harmless.
- The user doesn't use this page today (empty blocks, forgets it exists); see [user-needs.md](user-needs.md).

## Related
[user-needs.md](user-needs.md), [decisions.md](decisions.md)
