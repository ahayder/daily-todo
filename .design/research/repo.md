# Repo research — DailyTodo (update run)

Checked 2026-10-30 · mode `repo`, variant **update** — compared against the v2 brain (AGENTS.md `ui-brain:start v2` block, `.design/DESIGN.md`, `.claude/skills/{ui-system,ui-components,ux-patterns,ui-custom-elements}` marked `ui-brain:skill v1`; last check 2026-10-14). 38 commits since then, mainly "external brain": Today, History, Memory, Project, Standup, app notes, desktop pings, MCP server. `docs/kb/` not read (kb-keeper owns it). No dev server started (`pnpm dev` = prod data).

## 1. Stack (unchanged since 2026-10-14)

| Area | Fact |
|---|---|
| Framework | Next.js 16.1.6 App Router, React 19.2.3, TS 5 (confident — package.json) |
| Platforms | Web + Tauri 2 desktop (updater, notification plugin) (confident — package.json, f497e10) |
| Styling | Tailwind v4.2 + `tw-animate-css`; `src/app/globals.css` 4,992 lines, mostly unlayered (layers only at :104, :4309, :4921–4949) (confident) |
| Components | shadcn ^4 on `@base-ui/react` ^1.2 (confident) |
| Icons / fonts | lucide-react only · Baloo Da 2, Nunito, DM Mono via next/font (confident — src/app/layout.tsx:2) |
| State | useReducer + Context (`AppProvider`), PocketBase 0.26, per-record outbox (confident) |
| Tests | Vitest 4 + Testing Library; no Storybook (confident) |

## 2. Design system inventory (non-test importers, outside ui/ and blocks/)

| Item | Uses | Where |
|---|---|---|
| `ConfirmDialog` | 5 | series-detail, planner-view, sidebar, notes-view, todos-view |
| `EmptyState` | 6 | memory-view, project-view, today-view, history-view, content-planner root, notes-view |
| `PageHeader` | 4 | today-view, history-view, memory-view, content-planner root |
| `InlineComposer` | 2 | today-view, series-detail |
| `SegmentedControl` | 1 | app-notes-dialog (planner uses its own local `Segmented`, planner-view.tsx:648) |
| `InlineAlert` | 0 | — |
| `NowCard` / `WashiTag` | 1 / 3 | today-view / memory-parts, project-view, today-view |
| `StageTrack` | 3 | content planner |
| `PriorityTab` | **0** | nowhere (listed as a live custom element) |
| `Skeleton` / `Checkbox` / `Select` | 0 / 0 / 0 | — |

Layout: one shell `src/components/workspace/workspace.tsx` → `TopNavbar` + optional `Sidebar` + `main`. Every route page is a one-liner `<Workspace forcedView="…"/>`.

## 3. Screens

| Route | View file | Rating | Why |
|---|---|---|---|
| `/` | app/page.tsx | — | client redirect to `/today` |
| `/today` | today/today-view.tsx | target-ready | PageHeader, NowCard, EmptyState, InlineComposer, WashiTag |
| `/history` | today/history-view.tsx | target-ready | PageHeader + back link, EmptyState |
| `/memory` | memory/memory-view.tsx | target-ready | PageHeader, EmptyState, tokens only |
| `/memory/project?id=` | memory/project-view.tsx | ok | target tokens; hand-built header (:159–172), not PageHeader |
| `/standup` | memory/standup-view.tsx | ok | target tokens; hand-built header (:117–129) |
| `/content-planner` | content-planner/content-planner-view-root.tsx | target-ready | PageHeader — but titled "Content" (:259) vs nav "Content Planner" |
| `/todos` | todos/todos-view.tsx (2,029 lines) | legacy | 62 `*-[var(--…)]` classes, no h1/PageHeader |
| `/notes` | notes/notes-view.tsx | legacy | no page title; folder h2 only |
| `/planner` | planner/planner-view.tsx | legacy | 46 `var(--ink/paper)` classes, local Segmented, hand h1 |
| `/daily` | app/daily/page.tsx | — | server redirect to `/todos` (old alias) |
| `/auth/reset` | auth | ok | outside shell |

Validation candidates: **/todos** (legacy + the "two Todays" clarity problem), **/planner** (three names, dead sidebar toggle), **/standup** (new, small, hand header).

## 4. Repeated patterns done by hand (block candidates)

| Pattern | Files |
|---|---|
| Back link + title header (`← Today` / `← Memory` + h1) | history-view.tsx:93, standup-view.tsx:116, project-view.tsx:158 → add `back` prop to `PageHeader` |
| Card row surface `rounded-xl bg-card px-3/4 py-2.5 shadow-[var(--rim)]` | memory-parts.tsx:42,107 · standup-view.tsx:143 · project-view.tsx:356 · memory-view.tsx:73,170,175 · history-view.tsx:42 → `ListCard` block |
| Section pane `rounded-2xl bg-card p-3 shadow-[var(--rim)]` | today-view.tsx:205,330 · project-view.tsx:174 |
| Page container `mx-auto max-w-{3xl,6xl} px-4 pt-4 pb-12 sm:px-6` | today, history, memory, project, standup (two widths) → `PageBody` layout |

## 5. Consistency problems

| Check | Count | Top files |
|---|---|---|
| `bg/text/border-[var(--…)]` in tsx | 259 | todos-view 62, planner-view 46, auth-gate 33, desktop-update-provider 12, notes-view 12 |
| hex in tsx | 14 | (low) |
| `text-xs` (non-test) | 27 | sidebar tooltips (sidebar.tsx:697,713) etc. |
| raw `<button>` | 84 | sidebar, todos, planner |
| nav pills (globals.css:419–450, 2570) | — | legacy `--ink-700`/`--paper-strong`/`--planner-track`, radius 7px, 12px text on phones (:388) — DESIGN says `rounded-full`, active = `primary`, ≥13px |
| new areas (memory/, today/) | 0 violations | only sanctioned `shadow-[var(--rim)]` |

## 6. Instruction files

| File | UI content |
|---|---|
| CLAUDE.md | stack, safety, Tailwind layer rule, Styling Removal Rule; points UI to DESIGN.md — no conflict |
| AGENTS.md | ui-brain v2 block (has "Every screen must be obvious") — consistent |
| .design/DESIGN.md (223 lines) | source of truth; Quick card present |
| .claude/skills/ui-* + ux-patterns | v1 skill marker; ux-patterns has Clarity section (:11) |
| .agents/skills/{state-persistence,tauri-desktop,tiptap-editor,vitest-testing} | non-UI |
| .brain/, .cursor/, .github/copilot-instructions.md, .claude/commands | absent |

## 7. Can it render?

`pnpm dev` → next dev :5005 against **production** PocketBase — don't use. `pnpm dev:test` → local PocketBase 127.0.0.1:8090 (must be running). Auth gate wraps the shell; `?devWorkspace=1` (src/lib/dev-mode.ts) gives a local workspace for screenshots. Screenshot: `pnpm dev:test` + browser at `localhost:5005/<route>?devWorkspace=1`, 375px + desktop, dark + light.

## 8. Similar helpers

| Path | What | Overlaps | Keep |
|---|---|---|---|
| .claude/agents/ui-qa.md | ui-brain QA agent (marker `ui-brain:qa v1`) | — skipped (ui-brain file) | — |
| .claude/agents/kb-keeper.md | ask/record agent for `docs/kb/` project knowledge | `brain` — partial-to-full | the KB itself, ask-before/record-after workflow, server-first sync and PocketBase traps; keep kb-keeper as the project memory, point any `brain` agent at it rather than a second store |

## Drift

| Kind | Finding | Evidence |
|---|---|---|
| In code, not in skills | Navigation standard lists 4 pills (Todos / Notes / Daily Planner / Content Planner); code has **6**: Today, Memory, Todos, Notes, Daily Planner, Content Planner, and `/` lands on Today | ux-patterns SKILL.md:59 vs top-navbar.tsx:287–340, app/page.tsx |
| In code, not in skills | Layouts row says full-width = Today, History, Planner, Content Planner; also Memory, Project, Standup | ui-components SKILL.md:95 vs workspace.tsx:36 |
| In code, not in skills | Memory/Project/Standup pieces (project step form, standup checklist, `projectHref`) not inventoried beyond `DecisionCard`/`WaitingList` | memory/project-view.tsx, standup-view.tsx |
| Stale "Used in" | `PageHeader` "content planner" only (now 4); `EmptyState` "content planner" (now 6); `SegmentedControl` "not adopted" (app-notes uses it); `ConfirmDialog` ok | ui-components SKILL.md:66–72 |
| In skills, unused in code | `PriorityTab` sticker tab — 0 importers | ui-custom-elements SKILL.md; grep |
| Target not met in shell | DESIGN Navigation (active pill = `primary`, `rounded-full`, card track + rim) not implemented; nav still legacy CSS | DESIGN.md:115,141 vs globals.css:419–450,2574 |
| Dead code vs brain | Sidebar "Daily Plans" section + `.sidebar--planner` CSS unreachable (Planner is full-width) | sidebar.tsx:664–720, globals.css:2307, workspace.tsx:36 |
| Token restatement | none found outside DESIGN.md / globals.css | grep |
| Conflicting rules | none | — |
| Size vs budget | AGENTS block ~10 lines; DESIGN 223; skills 51–101 lines — within budget | wc |
| Clarity rules | present (AGENTS block line "Every screen must be obvious"; ux-patterns `## Clarity`) | — |
| Paths | all skill paths exist | ls |

## Structure review (big picture)

**Nav today** (top-navbar.tsx:287–340): `Today · Memory · Todos · Notes · Daily Planner · Content Planner` + app-note button, sync pill, updater, A-/A+. Sub-pages highlight a parent: History and **Standup** → Today, Project → Memory (:94–95). No grouping, no icons, all equal weight.

| # | Finding (clarity question failed) | Evidence |
|---|---|---|
| S1 | **Three "today" surfaces, two task systems.** Today (external-brain tasks + Now card + blocks + Shelf), Todos (daily-page todos with carryover; its sidebar has its *own* "Today" button), Planner "Now" (current block again). User can't tell where a task belongs or which "today" is real. *What is this for?* | today-view.tsx:18 (`lib/memory/tasks`), sidebar.tsx:650–660, planner-view.tsx:660 |
| S2 | **Nav order mixes kinds**: daily-use (Today, Todos), reference (Memory, Notes), setup (Daily Planner = the template feeding Today's blocks), and a separate project (Content Planner) — flat list of 6, with the new home "Today" and old home "Todos" side by side (store default `lastView: "todos"`, store.ts:1086). *Where am I?* | top-navbar.tsx:287–340 |
| S3 | **One area, three names**: nav "Daily Planner", Planner screen h1 "Your ideal days" / weekday name, sidebar label "Daily Plans"; Today empty state calls it "Daily Planner". Content area: nav "Content Planner", h1 "Content". | planner-view.tsx:286,546; sidebar.tsx:668; today-view.tsx:258; content-planner-view-root.tsx:259 |
| S4 | **Dead control on Planner**: navbar shows the sidebar toggle on Planner, but Planner is full-width so nothing opens; the planner tour still points at it ("planner sidebar starts collapsed"). Preset create/duplicate lives only in that unreachable sidebar. *What happens next?* — nothing. | top-navbar.tsx:263, workspace.tsx:36, planner-tour.tsx:44–46 |
| S5 | **Inconsistent page frame**: Today/History/Memory/Content use `PageHeader`; Project/Standup hand-roll it; Todos and Notes have **no page title**; Planner uses legacy h1. Two content widths (max-w-3xl vs 6xl). Primary action placement differs per area. | §3 table, §4 |
| S6 | **Hidden sub-pages**: Standup is only reachable from a ghost button on Today on workdays; History only via text links; Project only from Memory cards. Highlighting Standup as "Today" is surprising. | today-view.tsx:141,238,362; top-navbar.tsx:94 |
| S7 | **Mobile nav**: 6 pills in a horizontally scrolling row with hidden scrollbar at 12px; Daily/Content Planner likely off-screen at 375px with no cue; header auto-hides on scroll. No bottom nav. | globals.css:371–390, top-navbar.tsx:107 |
| S8 | Sidebar only for Todos (date tree) and Notes (folders); fine, but Todos sidebar duplicates the job of Today/History (pick a day). | sidebar.tsx:650–800 |

## Open questions

1. Is Todos (daily pages) being replaced by Today (external brain)? — (a) yes, merge/retire Todos · (b) both stay, different jobs · (c) Todos becomes a "journal/day log" under Notes.
2. Should Daily Planner become a Today setting ("Plan my days") instead of a top-level tab? — (a) yes, move under Today · (b) keep top-level, rename · (c) keep as is.
3. Nav grouping — (a) group: Today · Memory | Notes | Content · (b) keep flat 6 · (c) primary 3 + "More".
4. Mobile — (a) bottom tab bar with 4–5 items · (b) keep scrolling pills, add overflow cue · (c) drawer.
5. One name for the content area — (a) "Content" · (b) "Content Planner".
