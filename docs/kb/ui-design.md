# UI & design system (pointers)
Last verified: 2026-10-30

The UI rules are not duplicated here. Source of truth: `.design/DESIGN.md` (B2 "Pocket Stickers — Deep";
opens with a Quick card), applied via the short UI brain block in `AGENTS.md` (markers `ui-brain:start v2` /
`ui-brain:end`) and the skills in `.claude/skills/`:
- `ui-system` — tokens, type, dark mode, motion, Base UI + semantic-utility rules.
- `ui-components` / `ui-custom-elements` — the **UI inventory** (what exists). Check there; the KB doesn't copy it.
- `ux-patterns` — states, a11y, Clarity, plus legacy-vs-target, ask-before-major-changes, needs-product-judgment, "done means".

## How it works
- Tokens: `src/app/globals.css` (`:root`, `.dark`, `@theme inline`); fonts: `src/app/layout.tsx`; no-flash theme script: `src/lib/theme-hint.ts`.
- shadcn (Base UI) primitives in `src/components/ui/` — add with `npx shadcn@latest add <component>`. Small text in primitives is `text-[0.8125rem]` (13px), not `text-xs`.
- UI brain setup state: `.design/setup.md`. After a screen changes, run the `.claude/agents/ui-qa.md` agent (uses `?devWorkspace=1`, never plain `pnpm dev`).
- Confirms use `ConfirmDialog` (`src/components/blocks/confirm-dialog.tsx`): `variant` `"destructive"` (default) or `"default"`; `onConfirm(event)` gets the click event (todo status confirm uses it as the confetti origin). All raw AlertDialog confirms were migrated except `src/components/workspace/desktop-update-provider.tsx` (rich update dialog, kept on purpose).
- Sync pill (`src/components/workspace/top-navbar.tsx`): offline/issue = amber `bg-warning` dot + `text-foreground` label.
- **Today screen** (`src/components/today/today-view.tsx`, full width, sidebar toggle hidden): PageHeader → NowCard for the current planner block (first open task, or "Free — your call" + "Pick from the Shelf" when the Shelf has items; Done / Not now) → "N new changes from your AI chats" panel (today's live AI batches; Undo, See all changes, "Looks good" hides them on this device via localStorage `dailytodo.today.aiSeenChangeId`) → "Your day" blocks with tasks + "Also today" (loose tasks, repeats due), with a Shelf aside (quick add, leftovers with WashiTag "N days waiting", then Shelf; "Do today" dropdown lists only blocks not yet ended + "Any time today").
  Header also has a "Standup agenda" link (weekdays) and, on desktop only, a bell that toggles pings.
- **History screen** (`src/components/today/history-view.tsx`): one row per batch, grouped by day, "Undo all N"; no nav pill, reached from Today and has a back link.
- **Nav:** pills Today · Memory · Content Planner (Todos, Notes and Daily Planner pills removed 2026-10-30; `/todos` and `/notes` still work by URL, `/planner` redirects to Today). Memory is highlighted on memory/project, Today on today/history/standup.
- **Day plan editing on Today:** "Your day" `SectionTitle` has an `action` slot holding an "Edit day plan" button (empty state: "Set up your day plan"); it opens `PlannerSetupDialog` (see [daily-planner.md](daily-planner.md)).
- **Memory screen** (`src/components/memory/memory-view.tsx`): search (results grouped by kind with project + date meta; tasks link to their project page, else `/today`; markdown bullets stripped from snippets) → project cards (Paused and done folded) → Decisions log (tag chips with `aria-pressed`, "Mark agreed" on proposed) beside Waiting on others ("Mark resolved", project name, WashiTag `variant="waiting"`: "Waiting 1 day" / "N days waiting").
- **Project screen** (`project-view.tsx`): Where it stands (state, next small step, primary "Do today" = schedule the matching open task or create one in the project; "Edit where it stands" form: ⌘/Ctrl+Enter saves, Esc closes only when untouched; Pause / Make active again; standup link for job projects) → Tasks + Done fold → Decisions → Waiting → Meetings (details → summary, never transcript) → Timeline.
- **Standup screen** (`standup-view.tsx`): `buildStandupAgenda` sections with device-local ticks.
- Shared bits: `src/components/today/section-title.tsx` (`SectionTitle` with `headingRef` and an optional `action` slot), `do-today-menu.tsx`, `use-focus-soon.ts`, `memory-parts.tsx`.
- Today/History/Memory feedback pattern: every edit shows an Undo toast; undo results/refusals show as toasts with "Bring back". When the clicked control disappears, move focus with `useFocusSoon` to a nearby `SectionTitle` heading (Now card / Shelf / AI panel on Today).
- User-facing copy never says "PocketBase" (sync notices in `top-navbar.tsx`, `src/lib/split-persistence-repository.ts`, `src/lib/pocketbase/persistence-repository.ts`). Legacy leftover: `src/components/auth/auth-gate.tsx` still does.

## Gotchas
- **Tailwind v4 layers:** never write unlayered CSS in `globals.css` — it beats every utility and breaks spacing app-wide. Use `@layer base` / `@layer components`.
- When removing a visual treatment, delete the original rule; don't layer an override.
- Amber (`text-warning`) text fails contrast in light mode — use amber only for dots/fills, keep text `text-foreground`.
- **Base UI modal Dialog traps** (found in the change-request dialog, details in [change-requests.md](change-requests.md)): the Undo toast can't be clicked while a modal is open (show undo inline in the dialog); Esc inside an inline editor closes the dialog and `stopPropagation` doesn't help (intercept in `onOpenChange`); `DialogContent` needs `grid-cols-[minmax(0,1fr)]` + `[overflow-wrap:anywhere]` for long unbroken text.
- **Links styled as buttons:** use `<Link className={buttonVariants(...)}>`. Base UI `Button` with `render={<Link/>}` logs a `nativeButton` error and gives the link `role=button`.
- Dev only: fonts fail CORS on `dailytodo.localhost` vs `localhost` — harmless, ignore.
- ui-brain's `.brain/`, `brain` agent and Stop hook are deliberately not installed (see [decisions.md](decisions.md)); `check-brain.mjs` reporting them missing is expected.

## Related
- [testing.md](testing.md) — browser checks. [decisions.md](decisions.md).
