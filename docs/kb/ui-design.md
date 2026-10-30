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
  On desktop only, the header has a bell that toggles pings.
- **Day plan editing on Today:** "Your day" `SectionTitle` has an `action` slot holding an "Edit day plan" button (empty state: "Set up your day plan"); it opens `PlannerSetupDialog` (see [daily-planner.md](daily-planner.md)). `/planner` redirects to `/today?editPlan=1`.
- **History screen** (`src/components/today/history-view.tsx`): one row per batch, grouped by day, "Undo all N"; reached via the Today tabs.
- **Nav (built 2026-10-30, decision in [decisions.md](decisions.md)):** Today is the single home.
  - Item list: `MAIN_NAV` in `src/components/workspace/main-nav.ts` (key, label, href, view, `isActive`), shared by the top bar and the phone bar. No Plan menu.
  - Top bar (`top-navbar.tsx`), md (≥768px) and up: 4 pills Today · Notes · Memory · Content Planner. Pills are links with `aria-current="page"` (not `role=tab`). The top bar no longer hides on scroll.
  - Highlight: Today is lit on today/todos/standup/history **and** planner (the Daily Planner lives inside Today); Memory on memory/project.
  - Phone bar (`src/components/workspace/mobile-tab-bar.tsx`), below 768px (`md:hidden`): the same 4 items; icons Sun · FileText · Brain · Clapperboard. It is part of the `.app-shell` flex column, not `position: fixed`, so it never covers content. Active tab = primary colour + filled pill behind the icon. Hidden in focus mode. The desktop Tauri window's min width is 1100, so it never shows there.
  - Today tabs: `src/components/today/today-tabs.tsx` on the `AreaTabs` block (`src/components/blocks/area-tabs.tsx`, route links styled like `SegmentedControl`): Now `/today` · Journal `/todos` · Standup `/standup` · History `/history`. Standup shows Mon–Fri only, decided after mount (pages are prerendered). Rendered in `workspace.tsx` **above** `.app-body`, not inside main, so the row doesn't jump when Journal's sidebar stacks on top at ≤1024px. Standup uses `PageHeader`; no back links.
  - "Journal" is a label only: `ViewMode` stays `"todos"`, because `lastView` syncs to PocketBase and the installed desktop app's Zod enum may reject unknown values. Don't rename the value until every desktop install is updated. The Journal sidebar button reads "Today's page".
  - `src/lib/views.ts`: `isFullWidthView` (the one list used by `workspace.tsx` and the navbar) and `isTodayAreaView`. Todos/Notes have the sidebar; everything else is full width.
  - Fresh state defaults `lastView` to `"today"` (`src/lib/store.ts`); `/` redirects to `/today` (`src/app/page.tsx`).
  - Toasts sit above the phone bar below md (`src/components/ui/toast.tsx`).
- **Open nav points:** needs the user (Today tab row alignment, "Now" vs "Today" naming, cramped phone Journal) — see [decisions.md](decisions.md). Low: focus resets to the top on navigation. Page headers still vary: Project hand-rolls its own; Todos/Notes have no title. `src/components/planner/planner-tour.tsx` is not rendered anywhere (dead).
- **Memory screen** (`src/components/memory/memory-view.tsx`): search (results grouped by kind with project + date meta; tasks link to their project page, else `/today`; markdown bullets stripped from snippets) → project cards (Paused and done folded) → Decisions log (tag chips with `aria-pressed`, "Mark agreed" on proposed) beside Waiting on others ("Mark resolved", project name, WashiTag `variant="waiting"`: "Waiting 1 day" / "N days waiting").
- **Project screen** (`project-view.tsx`): Where it stands (state, next small step, primary "Do today" = schedule the matching open task or create one in the project; "Edit where it stands" form: ⌘/Ctrl+Enter saves, Esc closes only when untouched; Pause / Make active again; standup link for job projects) → Tasks + Done fold → Decisions → Waiting → Meetings (details → summary, never transcript) → Timeline.
- **Standup screen** (`standup-view.tsx`): `buildStandupAgenda` sections with device-local ticks.
- Shared bits: `src/components/today/section-title.tsx` (`SectionTitle` with `headingRef` and an optional `action` slot), `do-today-menu.tsx`, `use-focus-soon.ts`, `memory-parts.tsx`.
- Today/History/Memory feedback pattern: every edit shows an Undo toast; undo results/refusals show as toasts with "Bring back". When the clicked control disappears, move focus with `useFocusSoon` to a nearby `SectionTitle` heading (Now card / Shelf / AI panel on Today).
- User-facing copy never says "PocketBase" (sync notices in `top-navbar.tsx`, `src/lib/split-persistence-repository.ts`, `src/lib/pocketbase/persistence-repository.ts`). Legacy leftover: `src/components/auth/auth-gate.tsx` still does.

## Gotchas
- **Tailwind v4 layers:** never write unlayered CSS in `globals.css` — it beats every utility and breaks spacing app-wide. Use `@layer base` / `@layer components`.
- **Legacy unlayered `button, input, select { font: inherit }`** in `globals.css` (near the top, ~line 126) beats Tailwind text-size/weight utilities on every `<button>`. Workaround: put the text size/weight on the parent (e.g. the `<li>`). Fixing it globally would restyle many buttons — open debt, ask before doing it.
- `.app-shell` uses `overflow: clip`, not `hidden`: with `hidden`, an sr-only label scrolled into view and shifted the whole app 71px on phones.
- When removing a visual treatment, delete the original rule; don't layer an override.
- Amber (`text-warning`) text fails contrast in light mode — use amber only for dots/fills, keep text `text-foreground`.
- **Base UI modal Dialog traps** (found in the change-request dialog, details in [change-requests.md](change-requests.md)): the Undo toast can't be clicked while a modal is open (show undo inline in the dialog); Esc inside an inline editor closes the dialog and `stopPropagation` doesn't help (intercept in `onOpenChange`); `DialogContent` needs `grid-cols-[minmax(0,1fr)]` + `[overflow-wrap:anywhere]` for long unbroken text.
- **Links styled as buttons:** use `<Link className={buttonVariants(...)}>`. Base UI `Button` with `render={<Link/>}` logs a `nativeButton` error and gives the link `role=button`.
- Dev only: fonts fail CORS on `dailytodo.localhost` vs `localhost` — harmless, ignore.
- ui-brain's `.brain/`, `brain` agent and Stop hook are deliberately not installed (see [decisions.md](decisions.md)); `check-brain.mjs` reporting them missing is expected.

## Related
- [testing.md](testing.md) — browser checks. [decisions.md](decisions.md).
