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
│   ├── content-planner-view.tsx # Public compatibility export for the content planner board
│   ├── content-planner/         # Content Conveyor board (Inbox→Develop→Shoot next→Published): capture box, growing cards, inbox review, drag-and-drop
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
- **Content Planner**: `/content-planner` is a full-width, single-board workspace whose default view is the Kanban Board on every viewport. Desktop users can switch to the Pinterest-like masonry Gallery; smaller viewports always retain the Board. On phone-sized viewports, the page heading condenses to one row without the descriptive sentence, cards start collapsed, and each column moves its closed Add Card trigger into the header while keeping the composer in the column when opened. Gallery shows the same cards across workflow columns with stage labels, uses wider two-, three-, and four-column layouts across desktop breakpoints, preserves preview, edit, copy, collapse, and guarded deletion, and uses the explicit move dialog instead of drag-and-drop. New boards seed the four fixed **Content Conveyor** states — `Inbox` → `Develop` → `Shoot next` → `Published` — with editable titles and subtitles (identified by stable column ids `content-column-{inbox,develop,shoot-next,published}`, so conveyor behaviour never depends on the editable titles). Legacy 5-column boards are migrated non-destructively: `ensureContentPlannerState` only *ensures the canonical columns exist* (prepends the three new ones, keeps `published`) and never moves cards or deletes the old Ideas/Planned/In Progress/Ready columns — the user relocates cards and removes the old columns themselves. An always-visible, mobile-first **capture box** at the top adds a zero-field card straight to Inbox (first line = title, rest = notes); its placeholder and the Inbox subtitle nudge the user to capture the *specific thought* (problem + method), not just a broad topic — the sharper Inbox subtitle is migrated onto existing boards in `ensureContentPlannerState` (only when it still carries the old default). Each card carries the conveyor model: a single prominent **next-step button** (`Develop this` / `Ready to shoot` / `Mark published`) that in one press appends the next markdown section (`## IDEA NOTE`, `## SHOOT CARD`) and auto-moves the card to the next column; a **Copy for ChatGPT** action that copies the stage's hidden prompt **plus a clean `title + idea` body** (`buildChatGptClipboard` strips conveyor `##` heading scaffolding via `stripSectionHeadings` so pasted text reads as plain intent), never showing the prompt on the card; and, on Inbox/Develop cards, a labelled/collapsible section renderer that groups notes under `ORIGINAL THOUGHT`/`IDEA NOTE`/`SHOOT CARD`/`SATELLITES` headings (the first section was renamed from the legacy `RAW IDEA`, which is still recognized as an alias so old cards render unchanged; empty sections are hidden until they hold content; older sections collapse behind a tap-to-expand summary; cards without recognized headings render as plain Markdown, unchanged). Editing a card (inline or in the preview) shows three **optional, non-inserted hint prompts** (Trigger / Point / Anchor) beside the box, and Inbox cards show a small "Ready when you know your point + one concrete example/method" hint above `Develop this` — all guidance only, no data-model or workflow change and no AI. The `Shoot next` header shows an `N/5` soft-cap badge that tints (never blocks) past five. A **Review inbox** button opens a mobile-first triage overlay that shows one Inbox card at a time with Develop / Promote to shoot / Keep / Delete (tap-again confirm) actions. When a **pristine** board (exactly the four canonical columns) has zero cards, a self-teaching **empty state** replaces the board: capture invites around the box, a `Inbox › Develop › Shoot next › Published` flow breadcrumb, one illustrative (non-interactive, never persisted) example card demonstrating the `Develop this →` step, and dimmed later-stage rows. Boards with custom/legacy columns keep the normal view even when empty so their columns stay manageable; the empty state disappears the instant a real card exists. All conveyor logic lives in the pure, unit-tested `src/lib/content-conveyor.ts`; the card sections are just markdown inside the existing `notes` field, so persistence, copy, and gallery are unaffected. Column titles act as both the rename control and the drag surface, without a separate drag icon; confirmation-gated column deletion lives in each column’s top-right three-dot menu, including an explanation when deletion is unavailable. Cards present one multiline Markdown surface. Fine-pointer users can open the preview from the card surface or eye action; on coarse-pointer devices the card surface is inert and the eye action is the explicit preview control. The preview’s existing content surface switches into direct Markdown editing from its top-right pencil action without opening or presenting a separate modal. The card’s pencil action remains the entry point for inline editing, which automatically expands a collapsed card. The first line is emphasized as the card title, expanded desktop board card bodies scroll at an approximately seven-line maximum height, and each card has its own ephemeral expand/collapse control. A compact bottom toolbar keeps preview, copy, edit, and expand/collapse actions separate without narrowing the title, while a far-left three-dot menu contains the confirmation-gated delete action. Copy always writes the complete title-first Markdown source, including notes hidden by card collapse, and briefly confirms success in place. On fine-pointer devices, the board card surface provides pointer and keyboard dragging with a grab cursor; drag collision candidates are scoped by item type, and cards show an edge-aware insertion marker so the final position is predictable. On coarse-pointer devices, drag is disabled so vertical card scrolling and horizontal snap-scrolling do not compete with taps; card moves use a destination-and-placement dialog, while column menus provide explicit left/right moves. The shared A-/A+ reading controls scale Content Planner chrome, cards, Markdown, forms, and dialogs within the existing device-local font-size preference. Saved cards render safe GitHub-flavored Markdown, while the first line and remaining text continue syncing through the existing `title` and `notes` fields for compatibility.
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
- **Content planner is intentionally narrow** — one fixed board per user, editable columns, and locally collapsible Markdown cards with a preview dialog whose existing content surface switches into editing from a top-right pencil action, plus pencil-triggered inline card editing. Both preview and inline editing continuously auto-save in real time via debouncing and flush changes immediately upon blur, escape, dialog close, or outside interaction to ensure zero data loss. Desktop defaults to the structural Kanban board and can switch to the presentation-only masonry Gallery; smaller viewports always use Board. The layout choice is ephemeral and does not change persistence. Fine-pointer card surfaces open preview, while pointer dragging can start from that surface in Board view. Coarse-pointer card surfaces do not open preview; the eye action is the explicit mobile preview control. Coarse-pointer devices and Gallery use explicit card move controls so taps, scrolling, and masonry layout remain reliable. The bottom toolbar exposes preview, full-Markdown copy, edit, and expand/collapse directly; deletion lives in its far-left three-dot menu and still requires confirmation. Copy uses the persisted title and notes even when the card body is collapsed. Editing automatically expands an inline-edited card. Card collapse and the active preview are ephemeral component state, not synced preferences. Card display uses `react-markdown` plus `remark-gfm` with raw HTML disabled, emphasizes the first persisted line as its title, and caps expanded desktop board card bodies at approximately seven text lines while card text still maps to `title` plus `notes` internally for persistence compatibility. Scheduling, taxonomy, scoring, filters, AI generation, and additional alternate views are outside this version.
- **Content planner persistence** — board columns sync as one `content_boards` record and cards sync individually through `content_cards`; card positions are reindexed to integers after every move. Legacy planner branches are discarded during normalization and workspace import.
- **Daily planner persistence** — unchanged by the NOW+Setup redesign (no migration): planner subtitle and creation metadata share the existing `days_json` payload with planner days, purposes live inside their owning planner day beside event slices, and the new UI only reads/writes each day's `events[]` (via the existing event reducer actions). Purposes/targets/roles and extra presets stay persisted but unused by the UI. Legacy day-only JSON is still normalized on read.
- **Hybrid storage strategy** — use scalar/relation fields for ownership, ids, titles, timestamps, and other queryable atoms; use JSON fields for nested parent-owned structures such as daily todos, planner day order, planner days/events, and small UI arrays.
- **Todo workspace persistence** — the stable `todo-workspace-main` id preserves legacy Main daily-page keys and records without a destructive cache rewrite. Additional pages use workspace/date keys locally and `workspace_id` in PocketBase. `todo_workspaces_json` and `selected_todo_workspace_id` live in the existing single-owner `workspace_state` record. The schema reconcile intentionally replaces the former unique owner/date index with owner/workspace/date while leaving unrelated extra indexes intact.
- **Desktop updater** lives in the Tauri shell — updater logic and release workflow are part of the product architecture, not a one-off script.
- **shadcn/ui** components live in `src/components/ui/`. Generate new ones with `npx shadcn@latest add <component>`.
- **Tailwind v4 & CSS Cascade Layers (CRITICAL)**: Because Tailwind v4 relies entirely on native `@layer` (theme, base, components, utilities), **NEVER write unlayered CSS resets or component styles in globals.css**. Unlayered CSS rules (like `* { padding:0; }`) automatically overpower all layered utilities across the entire app, destroying component padding and spacing system.
  - **Do**: Always wrap custom global resets in `@layer base { ... }`.
  - **Do**: Put custom component CSS in `@layer components { ... }` or use exact Tailwind utilities.
  - **Don't**: Write naked CSS selectors outside of Tailwind layers in `globals.css` unless deliberately intending to override the entire Tailwind layer system.
