# DailyTodo — Claude Brain File

@AGENTS.md

> This file is the single source of truth for AI-assisted development on DailyTodoApp (architecture, conventions, workflow).
> UI look, feel and UX rules live in `.design/DESIGN.md`, applied through the UI/UX block in `AGENTS.md` (imported above).
>
> **IMPORTANT REVISION RULE:** When a structural change or big change is made to the codebase, this "brain" of the application (`CLAUDE.md`) MUST be updated immediately to reflect the new architecture, dependencies, or patterns.

---

## Project Overview

**DailyTodo** is a personal productivity app with a Next.js web UI and Tauri desktop shell, combining a daily journal (note-taking with markdown + drawing) and a structured todo list, organized by day. It lives at `localhost:5005` during development.

The core metaphor is a **physical desk notebook** — warm, calm, analog in feel, but with the efficiency of a digital tool. Think Bear Notes meets a bullet journal.

---

## Tech Stack

| Layer           | Choice                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Framework       | Next.js 16 (App Router)                                                                          |
| Language        | TypeScript 5                                                                                     |
| Styling         | Tailwind CSS v4 + shadcn/ui                                                                      |
| Component Lib   | shadcn/ui (Radix primitives), @base-ui/react                                                     |
| Markdown Editor | Tiptap (ProseMirror-based, Notion-like)                                                          |
| Drawing         | Excalidraw embedded inside Tiptap node views                                                     |
| State           | React useReducer + Context (AppProvider)                                                         |
| Auth            | PocketBase email/password auth + verification/reset flows                                        |
| Persistence     | PocketBase sync + local cache (`src/lib/persistence.ts`, PocketBase collections + browser cache) |
| Desktop Shell   | Tauri 2 + native updater                                                                         |
| Icons           | lucide-react                                                                                     |
| Animation       | tw-animate-css                                                                                   |
| Testing         | Vitest + @testing-library/react                                                                  |
| Package Manager | pnpm                                                                                             |

---

## Architecture

```
src/
├── app/
│   ├── layout.tsx          # Root layout with providers + font setup
│   ├── page.tsx            # Root redirect → /todos
│   ├── todos/page.tsx      # Todos view page
│   ├── notes/page.tsx      # Notes view page
│   ├── planner/page.tsx    # Daily planner page
│   ├── content-planner/page.tsx # Content planner page
│   └── auth/reset/page.tsx # PocketBase password reset landing page
├── components/
│   ├── app/                # App state provider and reducer
│   ├── auth/               # Auth context, gate, and auth flow screens
│   ├── workspace/          # Shell: providers, top-nav, sidebar, updater, main workspace
│   ├── todos/              # Main task view (todos) + focus timer
│   ├── notes/              # Full-width note with title + editor
│   ├── planner/            # Daily planner: NOW screen + Setup editor, read-only 24h clock geometry
│   ├── content-planner-view.tsx # Public compatibility export for the content planner
│   ├── content-planner/         # Content Conveyor "Focus + Shelf": week strip, capture box, stage-grouped shelf, card detail (pane/phone sheet), ideas review, empty state
│   ├── editor/             # Markdown editor wrapper, Tiptap extensions, toolbar, bubble menu, Excalidraw node views
│   ├── ui/                 # shadcn (Base UI) primitives + IconButton, Toast
│   ├── blocks/             # Shared UI blocks: ConfirmDialog, EmptyState, InlineComposer, SegmentedControl, PageHeader, InlineAlert
│   └── signature/          # Product design elements: NowCard, PriorityTab, WashiTag, StageTrack/SoftCapBadge
├── hooks/                  # useMediaQuery + named MEDIA_QUERIES
└── lib/
    ├── types.ts            # All TypeScript types (Todo, DailyPage, NoteDoc, etc.)
    ├── store.ts            # Pure state factories + selectors (groupTodosByPriority, content board defaults + migration, etc.)
    ├── content-conveyor.ts # Pure Content Conveyor helpers (stages, next-step map, section parse/append, ChatGPT prompt builder)
    ├── planner-now.ts      # Pure planner helpers (date→weekday-template map, current/next block, minutes-left, progress)
    ├── persistence.ts      # persistence types, normalization, metadata helpers
    ├── local-cache-storage.ts # browser cache envelope for assembled AppState
    ├── auth.ts             # auth repository contract
    ├── pocketbase/         # PocketBase auth + persistence repositories
    ├── split-persistence-repository.ts # cache-first repository wrapper for split sync
    ├── date.ts             # Date formatting helpers
    ├── theme-hint.ts       # Pre-hydration theme script + storage key (no dark/light flash)
    ├── super-admin.ts      # Owner email allowlist gating super-admin UI
    └── schema.ts           # Zod validation for persisted state
```

### State Shape

```ts
AppState {
  dailyPages: Record<workspaceDateKey, DailyPage> // Main retains legacy date-only keys
  todoWorkspaces: Record<id, TodoWorkspace>
  notesDocs:  Record<id, NoteDoc>
  noteFolders: Record<id, NoteFolder>
  plannerPresets: Record<id, PlannerPreset>
  contentBoard: ContentBoard
  contentCards: Record<id, ContentCard>
  uiState:    UIState                       // synced selection, focus timer + device prefs
}

DailyPage { date, markdown, todos[] }
TodoWorkspace { id, name, createdAt, updatedAt }
NoteDoc   { id, folderId, title, markdown, updatedAt }
NoteFolder { id, parentId, name }
PlannerPreset { id, name, subtitle, dayOrder[], days, createdAt, updatedAt }
PlannerDay { key, title, purposes[], events[] }
PlannerPurpose { id, title, color, targetMinutes, role, notes }
PlannerEvent { id, purposeId, dayKey, startMinutes, endMinutes, title, color, notes }
ContentBoard { columns: ContentColumn[], updatedAt }
ContentColumn { id, title, subtitle }
ContentCard { id, columnId, title, notes, order, updatedAt }
Todo      { id, text, status, priority, estimatedMinutes, parentId }
```

### Key Behaviors

- **Carryover**: When a new day is created (`ensureDailyPageForDate`), all incomplete todos and the markdown from the latest earlier daily page in the active Todo workspace are copied forward automatically. Copied task IDs are deterministic, parent/subtask links are remapped to the new page, and PocketBase backfills the synthesized workspace-scoped `daily_pages` record during hydration.
- **Task attention**: Carryover preserves the original `createdAt` going forward (existing history is not backfilled). Unfinished tasks show calendar-day age relative to the displayed page: “From yesterday” or “N days waiting”. A temporary “Worth a look” review filter retains ancestor context and orders older tasks first within priority groups. Dragging is disabled during review to preserve saved ordering; changing workspace/date clears the filter.
- **Day advance**: The client actively lands the daily view on the real "today" instead of trusting the last-synced `selectedDailyDate`. `useAppPersistenceState` dispatches `ensure-daily-today` once the authenticated workspace becomes interactive, and again on window focus / tab visibility when the calendar day has rolled over. The `ensure-daily-today` reducer action carries the previous day forward (via `ensureDailyPageForDate`) and force-selects today, so it works even offline/cache-first and overrides a stale `selectedDailyDate` that conflict resolution would otherwise keep — the previous cause of the view being "stuck" on an old day and appearing to show the same notes every day. Selecting a past day from the sidebar within a session is unaffected (the advance only fires on load and true rollover).
- **Todo workspaces**: `/todos` can create, switch, rename, and confirmation-delete independent Todo workspaces. Each workspace owns its own dated todos, Daily Notes, date history, and carryover stream while Notes, Daily Planner, and Content Planner remain shared. Existing data normalizes into the renameable but non-deletable `Main` workspace; new workspaces start with an empty selected day. Switching workspaces keeps the selected date and clears the device-local focus timer so a timer never follows the user into a different workspace.
- **Authentication**: The workspace is auth-gated. Anonymous users see `AuthGate`, unverified users see `VerificationPendingScreen`, and authenticated users load their synced workspace. A device-local `AuthGate` button opens a fake local-only dev workspace (`src/lib/dev-mode.ts`, no PocketBase sync). Separately, a **dev-only auto-login** (`getDevAutoLoginCredentials` in `src/lib/auth-config.ts`, read by the `AuthProvider` hydrate flow) signs in to a **real** PocketBase account on load when `NEXT_PUBLIC_DEV_AUTO_LOGIN_EMAIL` + `NEXT_PUBLIC_DEV_AUTO_LOGIN_PASSWORD` are set in a non-production build — used to exercise real sync locally without the login screen. These credentials are bundled into the client, so they are local-development only and must never be set in production.
- **Account menu (bottom-left)**: The sidebar footer `SidebarProfileMenu` holds account actions. Every real signed-in user gets a **Reset password** item that calls the existing `requestPasswordReset({ email })` (emails a reset link via PocketBase → `/auth/reset` confirms it; never touches the old password); it is hidden for the local dev-workspace session (fake email). **Super-admin / developer tools** are gated by `isSuperAdmin(email)` in `src/lib/super-admin.ts` — an owner email allowlist (defaults to the project owner, extendable via `NEXT_PUBLIC_SUPER_ADMIN_EMAILS`). Owners see a **Developer tools** section whose **Simulate next day** button dispatches `dev-advance-day`, a testing-only reducer action that finds the active Todo workspace's latest daily page, synthesizes the next calendar day via the real `ensureDailyPageForDate` → `createCarryoverDailyPage` path, and selects it — so incomplete-todo + note-markdown carry-forward can be exercised on demand without waiting for a real rollover. This is a UI-visibility gate for personal testing, not a security boundary.
- **Persistence**: `AppProvider` hydrates an assembled `AppState`, keeps a browser cache for fast startup/offline support, and syncs through PocketBase when authenticated. When remote hydration completes after the cached workspace is already interactive, it three-way merges the cached baseline, current local edits, and fresh remote records so an in-flight local action is not replaced by a late PocketBase response. A clean workspace refreshes from PocketBase when its tab or window becomes active, allowing localhost and deployed clients to pick up each other’s saved changes without a manual reload.
- **Daily Planner**: `/planner` was redesigned (ADHD-first) into a calm, full-width **NOW + Setup** page — the old radial editor, focus/target budgets, primary/secondary roles, multi-planner presets, and guided tour are gone from the UI. It runs full-width with no sidebar (like Content Planner, via the `isPlanner` branch in `workspace.tsx`). A single planner is used — the existing selected preset from `ensurePlannerState`; the preset sidebar is no longer rendered on planner (the `sidebar.tsx` planner-preset branch is now dead but retained/harmless). A top toggle switches **Now** ↔ **Set up**.
  - **NOW** (the daily, read-only face): picks today's template with `dayKeyForDate(new Date())` (Sun→`sunday`, Sat→`saturday`, Mon–Fri→`monday`), then uses `planner-now.ts` to show the current block as a card (title, start–end, a shrinking progress bar, "N min/h left"), a quiet vertical strip of the whole day with `start–end · name` ranges (the `next` block labelled, gaps ≥15m surfaced as "Free — your call"), and an optional read-only 24h **pie/bird's-eye** tucked behind a clock icon (blocks in one `--brand` accent, a "now" marker dot). Off-plan is silent (no judgment); a `setInterval` re-reads the clock every 30s. Only `monday`/`saturday`/`sunday` days are read; `tuesday`–`friday` are ignored (all weekdays share the `monday` template — no write-mirroring).
  - **Set up** (rare): three tabs — **Weekday / Saturday / Sunday** (`PLANNER_TEMPLATE_TABS` → `monday`/`saturday`/`sunday`). Each is a plain editable list of blocks (two `<input type="time">` + a name field + confirmation-gated delete) wired to the existing `create-/update-/delete-planner-event` reducer actions (`purposeId: null`), auto-saving. `+ Add block` appends via `getDefaultPlannerSliceRange`. A small read-only clock preview and a block/hours summary sit atop the list.
  - The 24h clock survives only as this read-only bird's-eye/preview (geometry reused from `planner-radial-utils.ts`); it is never an editor now. Purposes/budgets/roles remain in the data model and storage but are unused by the UI (no migration).
- **Content Planner**: `/content-planner` is a full-width **"Focus + Shelf"** page, redesigned (Oct 2026, ADHD-first) because Kanban columns and the Gallery truncated cards so nothing read at a glance. Top to bottom: a **This week** strip (a kind weekly ship meter — `WEEKLY_SHIP_GOAL = 4` dots plus a dashed bonus dot, counted from `publishedAt` since Monday 00:00 local, no streaks — and a **Next up** line: the top of Shoot next, else the top of Develop, with its one next-step button; a default, never a choice), an always-visible **capture box** (Enter saves to the **top** of Inbox via `create-content-card { atTop }`, Shift+Enter = new line, first line = title, rest = notes, quiet "Saved to Ideas"), then the **shelf**: every card as a wide row grouped by stage in "soonest work first" order — Shoot next (`SoftCapBadge` N/5, never blocks) → Develop → Ideas (the Inbox stage, relabelled; the StageTrack also reads "Ideas") → Published (collapsed by default, "N this week"). Rows show the title (2 lines), a plain-text snippet of the section being worked on (`getRowSnippet`), three section-fill dots (`getSectionFill`), and "Shipped Tue" on Published; group collapse is device-local (localStorage via `useSyncExternalStore`, memory fallback). A row's ⋯ menu (hover-revealed on fine pointers, always visible on touch) holds Move to top / Move up / Move to stage / Delete — there is no drag-and-drop. At ≥1024px (`MEDIA_QUERIES.split`) the selected card opens in a right-hand **detail pane** (defaults to Next up, else the first card); below that, tapping a row opens it as a full-screen Base UI dialog **sheet** with Back. The detail (`card-detail.tsx`) shows the `StageTrack`, an editable title, and each conveyor section as its own labelled auto-growing textarea with guidance placeholders (`getEditorSections` = the stage's sections + any already present; `notesToDraft`/`draftToNotes` keep an Inbox-only card as plain text and write `## SECTION` blocks once it grows). It has exactly one primary button (`Develop this` / `Ready to shoot` / `Mark published`): it saves, appends the next section, moves the card to the top of the next stage, keeps it open and focuses the new empty section; Mark published hands over to the next card and adds a "Shipped! N of 4 this week" toast. Edits auto-save (400ms debounce, flush on blur/advance/unmount); a render-time `base` vs stored card check re-seeds the draft only on external changes, so the save echo never eats typing. From **Shoot next** on, the Shoot card leads the detail: an **Intent** callout (derived, never stored — `getShootIntent`/`getShootCardIntent` read part 1 of the numbered Shoot card via `parseShootCard`; a part only starts at a non-indented `N.` line that follows the previous number), then the Shoot card as a **readable view** (`shoot-card-view.tsx`, numbered headings + indented bullets; Edit or focus switches to the textarea, blur returns), then Original thought / Idea note / Satellites folded under a collapsed **Earlier notes**. Pasting into the Shoot card strips ChatGPT source chips at line ends (`cleanPastedShootCard`). The intent also replaces the row snippet (`getRowSnippet`) and shows under the Next up title. Storage is unchanged (`## SHOOT CARD` inside `notes`). Copy for ChatGPT (Ideas/Develop only, `buildChatGptClipboard`) and Copy as Markdown (detail ⋯ menu) remain. Deleting a card is instant with an 8s Undo toast (`restore-content-card` puts it back at its index). **Review** (Ideas header, when 2+ ideas) is a one-card-at-a-time dialog — Develop this / Keep for later / Delete — whose queue is fixed on open so "N left" only goes down. With zero cards a teach-by-doing empty state shows the StageTrack and one illustrative, never-saved card. Board/Gallery views, column editing (rename/subtitle/add/reorder/delete UI), per-card collapse, the move dialog and Markdown rendering of cards were removed. The A-/A+ reading size scales card text (em-based) via the root `fontSize`.
- **Drawing**: Drawings are stored as embedded Excalidraw node data inside the Tiptap document. Legacy tldraw content is preserved as a non-editable fallback with a path to create a fresh Excalidraw board.
- **Markdown editor**: Tiptap (ProseMirror-based). Uses `tiptap-markdown` extension for markdown serialization, plus a toolbar, bubble menu, slash command, and embedded drawing nodes.
- **Delete task**: Deleting a todo is instant and shows an 8-second Undo toast (`showUndoToast`); Undo dispatches `restore-todo`, which puts the snapshot back at its original index in the same workspace/date. Stopping the focus timer on delete is not undone.
- **Add task**: Inline inputs at the bottom of each priority group (Apple Reminders style). No separate form.
- **Todos on smaller screens**: The desktop note/task split becomes a single-pane `Todos` / `Daily note` switcher. Todos open by default, the resize rail is desktop-only, task text wraps, and touch-first devices keep row actions visible while vertical scrolling takes precedence over drag gestures.
- **Navigation**: Top navbar with Todos/Notes/Daily Planner/Content Planner pills, sync status, desktop updater, theme toggle.
- **Sync model**: PocketBase stores top-level entities (`daily_pages`, `notes`, `note_folders`, `planner_presets`, `content_boards`, `content_cards`, `workspace_state`). `daily_pages.workspace_id` scopes owner/date uniqueness, while `workspace_state` syncs the small Todo workspace registry and selected workspace.
- **Desktop builds**: The Tauri shell supports in-app update checks and installation on supported desktop platforms.

---

## Design System

UI look, feel and UX rules live in `.design/DESIGN.md` (B2 "Pocket Stickers — Deep"); how agents apply them is in the `AGENTS.md` UI/UX block (imported below) and the `.claude/skills/ui-*` / `ux-patterns` skills. Don't restate token values here.

Still-binding engineering rules:

- **Styling Removal Rule:** when asked to remove a visual treatment (border, shadow, radius, background, divider, spacing, chrome…), delete or simplify the original rule instead of layering an override that cancels it. Only override when the original must stay for another component/state and can't be split yet.
- **Tailwind v4 layers:** custom CSS in `globals.css` goes inside `@layer base | components | utilities`. Unlayered rules beat every utility (see Known Technical Notes).

---

## Known Technical Notes

- **Tiptap editor** uses `@tiptap/react` with `immediatelyRender: false` for Next.js SSR compatibility. Uses `tiptap-markdown` for markdown round-trip and hosts custom editor UI such as the toolbar, bubble menu, slash command, and drawing node.
- **Drawing** is Excalidraw-based now, not the old canvas overlay. Embedded boards are serialized into the note document, and legacy tldraw payloads are intentionally treated as read-only migration-era content.
- **Persistence is hybrid** — PocketBase is the source of truth for synced content, while the browser keeps a per-user assembled cache for fast warm startup, offline fallback, and device-local UI preferences.
- **Local vs production database** — `pnpm dev` points at the **production** PocketBase (same as the live site), so localhost edits real data. For safe experiments and schema changes there is a disposable local PocketBase: run `pnpm pocketbase:local` (binary + data in git-ignored `pocketbase-local/`), `pnpm pocketbase:schema:apply:local`, optional `pnpm pocketbase:seed:local`, then `pnpm dev:test`. Local target + admin creds live in git-ignored `.env.test.local`. Automated Vitest tests are pure and never touch any PocketBase. See `docs/pocketbase.md` → "Local test database".
- **Authentication** is PocketBase-backed — email/password sign-in, registration, email verification, and password reset are part of the expected product flow.
- **Device-local UI state** — values like theme mode, sidebar collapsed state, content font scale, and focus mode remain local-only and should not be moved into synced PocketBase records unless there is a strong cross-device reason.
- **Content planner is intentionally narrow** — one fixed four-stage conveyor per user; no columns to configure, no tags, scoring, scheduling, filters or AI generation. The only extra helper is the weekly ship meter (the user explicitly declined auto-swap "pick for me", a hidden parked inbox, and a hard Shoot next cap). Selection, sheet state, review position and focus requests are ephemeral component state; group collapse is device-local. Column reducer actions (`add-/rename-/update-…-subtitle/reorder-/delete-content-column`) still exist in the reducer/store with tests but are not exposed in the UI.
- **Content planner persistence** — board columns sync as one `content_boards` record and cards sync individually through `content_cards`; card positions are reindexed to integers after every move. `ContentCard.publishedAt` (PocketBase `content_cards.published_at`, an optional **non-required** date — see the required-empty-value trap) is stamped by `moveContentCard` when a card enters Published and cleared when it leaves; cards published before it existed have none and don't count toward the week. `ensureContentPlannerState` now normalizes the board to exactly the four canonical stages in stage order (keeping custom titles/subtitles on them) and **folds** any legacy/custom columns away: their cards move to the end of Inbox (ordered by old column, then position) and the columns are dropped — idempotent, so a clean board is returned unchanged. Legacy planner branches are discarded during normalization and workspace import.
- **Daily planner persistence** — unchanged by the NOW+Setup redesign (no migration): planner subtitle and creation metadata share the existing `days_json` payload with planner days, purposes live inside their owning planner day beside event slices, and the new UI only reads/writes each day's `events[]` (via the existing event reducer actions). Purposes/targets/roles and extra presets stay persisted but unused by the UI. Legacy day-only JSON is still normalized on read.
- **Hybrid storage strategy** — use scalar/relation fields for ownership, ids, titles, timestamps, and other queryable atoms; use JSON fields for nested parent-owned structures such as daily todos, planner day order, planner days/events, and small UI arrays.
- **Todo workspace persistence** — the stable `todo-workspace-main` id preserves legacy Main daily-page keys and records without a destructive cache rewrite. Additional pages use workspace/date keys locally and `workspace_id` in PocketBase. `todo_workspaces_json` and `selected_todo_workspace_id` live in the existing single-owner `workspace_state` record. The schema reconcile intentionally replaces the former unique owner/date index with owner/workspace/date while leaving unrelated extra indexes intact.
- **Desktop updater** lives in the Tauri shell — updater logic and release workflow are part of the product architecture, not a one-off script.
- **shadcn/ui** components live in `src/components/ui/`. Generate new ones with `npx shadcn@latest add <component>`.
- **Tailwind v4 & CSS Cascade Layers (CRITICAL)**: Because Tailwind v4 relies entirely on native `@layer` (theme, base, components, utilities), **NEVER write unlayered CSS resets or component styles in globals.css**. Unlayered CSS rules (like `* { padding:0; }`) automatically overpower all layered utilities across the entire app, destroying component padding and spacing system.
  - **Do**: Always wrap custom global resets in `@layer base { ... }`.
  - **Do**: Put custom component CSS in `@layer components { ... }` or use exact Tailwind utilities.
  - **Don't**: Write naked CSS selectors outside of Tailwind layers in `globals.css` unless deliberately intending to override the entire Tailwind layer system.
