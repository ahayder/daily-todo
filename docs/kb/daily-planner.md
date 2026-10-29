# Daily Planner (day plan)
Last verified: 2026-10-30

The day plan = time blocks per template (Weekday / Saturday / Sunday). Since 2026-10-30 it has no
page or nav pill of its own: it's **edited from Today** ("Edit day plan" dialog) and **shown on Today**
("Your day" blocks + Now card, see [external-brain.md](external-brain.md) / [ui-design.md](ui-design.md)).

## How it works
- One planner: the selected preset from `ensurePlannerState`.
- **Editing:** on Today (`src/components/today/today-view.tsx`) the "Your day" `SectionTitle` `action` slot has an "Edit day plan" button (empty state button: "Set up your day plan"; hint: "your plan for this weekday"). It opens `PlannerSetupDialog`, exported from `src/components/planner/planner-view.tsx`, which wraps `SetupView` with `showHeader={false}`.
- **Set up (`SetupView`):** tabs Weekday / Saturday / Sunday (`PLANNER_TEMPLATE_TABS`). Each is a list of blocks (two `<input type="time">`, a name, confirm-gated delete) using `create-/update-/delete-planner-event` (`purposeId: null`), auto-saved. `+ Add block` uses `getDefaultPlannerSliceRange`. Small clock preview + summary on top (hidden header in the dialog).
- **`/planner` redirect:** `src/app/planner/page.tsx` client-redirects to `/today?editPlan=1`, keeping other query params. Today opens the dialog once the preset has loaded (`hasPreset`), then strips `editPlan` from the URL with `history.replaceState`.
- **Unrouted (still in code):** `PlannerView` with the Now mode (`src/lib/planner-now.ts`: current block card, day strip, "Free — your call" gaps, optional 24h pie) and the planner tour. No route forces the `"planner"` view any more. 24h clock geometry: `src/components/planner/planner-radial-utils.ts` (preview only).

## Gotchas
- **`?editPlan=1` cleanup must run inside the `setTimeout`, not in the effect body.** In dev, StrictMode runs the effect twice; stripping the param in the body made the second run see no param, so the dialog never opened.
- Only `monday`/`saturday`/`sunday` are read; `tuesday`–`friday` are ignored (no write-mirroring). Readers go through `plannerEventsForDay`.
- Purposes, budgets, roles and extra presets stay in data/storage but are unused by the UI (no migration). Storage unchanged: subtitle/creation metadata share `days_json`; purposes live inside their day.
- The planner-preset branch in `sidebar.tsx` and `planner-tour.tsx` are dead but harmless.

## Related
[user-needs.md](user-needs.md), [decisions.md](decisions.md), [ui-design.md](ui-design.md), [external-brain.md](external-brain.md)
