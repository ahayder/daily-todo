# QA: delete/confirm dialogs + top-bar sync badge — 2026-10-14
Tested: in browser (Claude built-in browser, `pnpm dev:test` on :5005, `?devWorkspace=1`; 1024px, 1440px, 375px; dark + light). Workspace delete, task status-change confirm and offline/sync-issue badge judged from code (no second workspace / no tasks / no way to go offline without changing data).
Brief: single ADHD user deleting a note / block / plan · wants a clear, kind confirm that names the thing and says what goes with it · one obvious destructive action, then the item is gone (given)
Stranger test: "This dialog is for deleting 'Quick Notes', and it wants me to confirm or cancel." ✓ matches the brief
Verdict: fix needed (0 High, 2 Medium, 3 Low)

## Findings
- [Medium] Planner "Delete block" trigger still carries legacy styling (`text-[var(--ink-700)] hover:bg-[var(--paper)] hover:text-[var(--warn)]`) and is a hand-built button with Tooltip, not `IconButton` — its markup was changed in this diff, so it is "the part you touch" — `src/components/planner/planner-view.tsx` EventRow (~line 505) — Legacy vs target / IconButton for icon-only — fix: swap to `IconButton label="Delete block"` with `text-muted-foreground hover:text-destructive`, matching the notes trigger — shot: `shots/2026-10-14-confirms-2-block-dark.jpg`
- [Medium] Sidebar "Delete plan" confirm can't be reached: on `/planner` the Sidebar is never rendered (`workspace.tsx` ~line 130), yet the top bar still shows "Open sidebar", which does nothing visible (dead button). The migrated preset-delete code is effectively dead — `src/components/workspace/workspace.tsx`, `top-navbar.tsx` ~line 255 — Clarity (no dead ends / mystery buttons) — fix: hide the sidebar toggle on Planner like on Content Planner, and decide where plans are deleted now (**needs user**: navigation) — shot: `shots/2026-10-14-confirms-4-planner-sidebar-toggle.jpg`
- [Low] Workspace delete and status-change confirms flash wrong text while closing: state is cleared on close, so the fading dialog shows `Delete ""?` / "Confirm the next status for this task." — `todos/todos-view.tsx` TodoWorkspaceControl + EditableTaskItem — polish — fix: keep the last name/status until the close animation ends (as `sidebar.tsx` does with `presetToDelete`)
- [Low] Cancel labels "Keep" (block) and "Keep workspace" differ from the pattern `Cancel` + `Delete {noun}` — `planner-view.tsx`, `todos-view.tsx` — ux-patterns "Destructive actions" — fix: use `Cancel`, or update the pattern if "Keep" is preferred.
- [Low] Block-delete copy "It will be taken off this day (7:00a–8:00a)" — in Set up you edit the Weekday/Saturday/Sunday plan, not a day — copy — fix: e.g. "It will be taken off your weekday plan (7:00a–8:00a)." Also: a planner block is small and recoverable, so the pattern says Undo toast, not a confirm (**needs user**).
- [Low] 10 identical "Delete block" accessible names in one list — screen-reader users can't tell rows apart — fix: `aria-label={`Delete ${event.title}`}` with tooltip "Delete block".

## What works
- Note/block confirms name the item (`Delete "Quick Notes"?`), one short consequence line, one red verb+noun button ("Delete note", "Delete block"), Cancel as the quiet option.
- Focus lands on Cancel/Keep (safe default); Esc closes; focus returns to the trash trigger; nothing deleted.
- 375px light: buttons stack full-width, ≥44px, readable; dark and light both look right. Description is 14px (≥13px).
- Notes trash is now `IconButton` with tooltip + accessible name, muted → destructive on hover.
- Sync badge: no "PocketBase" wording; offline/sync issue use `bg-warning` dot + text label (meaning not by color alone); `bg-warning`, `bg-brand-subtle` tokens exist; no `text-xs` left in touched tooltips.
- Status confirm now uses `variant="default"` (lilac) with "Change status" — not shown as destructive.

## Couldn't test
- Workspace delete confirm (only one workspace; making a second would change data), task status confirm (no tasks), offline / sync-issue / desktop-update badge states (can't simulate in dev workspace). Folder delete (only the default, non-deletable folder exists). Bengali names in titles.
