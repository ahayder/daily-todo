# Repo research — DailyTodo (update run)

Checked 2026-10-14 · mode `repo`, variant **update** (compared against v1 brain: AGENTS.md block `ui-ux-pro:brain:start v1`, `.design/scaffold.md` updated 2026-10-01, no `.brain/`).

## 1. Stack

| Area | Fact |
|---|---|
| Framework | Next.js 16.1.6 App Router, React 19.2.3, TS 5 (confident — package.json) |
| Platforms | Web + Tauri 2 desktop shell, `@tauri-apps/plugin-updater` (confident — package.json) |
| Package manager | pnpm 8.7.1 (confident — package.json `packageManager`) |
| Styling | Tailwind v4 (`@tailwindcss/postcss` ^4.2.1), `tw-animate-css`, one 5,012-line `src/app/globals.css` (confident) |
| Components | shadcn ^4 on `@base-ui/react` ^1.2 (not Radix) (confident — package.json) |
| Icons | lucide-react only (36 import sites; no tabler/heroicons) (confident — grep) |
| Fonts | Baloo Da 2, Nunito, DM Mono via next/font (confident — src/app/layout.tsx:2) |
| Editor | Tiptap 3 + Excalidraw 0.18; dnd-kit; canvas-confetti (confident) |
| State/data | useReducer + Context, PocketBase 0.26, idb, zod 4 (confident) |
| Tests | Vitest + Testing Library + jsdom; no Storybook (confident) |

## 2. Design system inventory (usage = non-test files importing it)

| Kind | Item | Uses | Where |
|---|---|---|---|
| block | `ConfirmDialog` | 1 | content-planner/series-detail |
| block | `InlineComposer` | 1 | series-detail |
| block | `PageHeader` | 1 | content-planner-view-root |
| block | `EmptyState` | **0** | — |
| block | `InlineAlert` | **0** | — |
| block | `SegmentedControl` | **0** | — |
| signature | `StageTrack` / `SoftCapBadge` | 3 / 1 | content planner |
| signature | `NowCard` · `PriorityTab` · `WashiTag` | **0 · 0 · 0** | — |
| ui | `IconButton` | 7 | all content-planner |
| ui | `DropdownMenu` · `Dialog` | 4 · 4 | content-planner |
| ui | `AlertDialog` (direct) | 5 screens | planner, notes, todos, sidebar, desktop-update |
| ui | `Tooltip` | 13 | everywhere |
| ui | `Skeleton` · `Checkbox` · `Select` · `Separator` | **0** each | — |
| ui | toast `showUndoToast` | 2 | todos-view:1483, content-planner-view-root:150 |
| hook | `useMediaQuery` | 1 | content-planner-view-root |

Tokens: `src/app/globals.css` (`:root`, `.dark`, `@theme inline`); names match DESIGN.md (core shadcn + `--p1..3*`, `--now-*`, `--washi`, `--rule`, `--rim`, `--card-shadow`, `--duration-ui`). Dark default (`dark` class on `<html>` in layout.tsx:39). Motion utilities: `animate-enter/settle/stamp`, `press`.

## 3. Screens

| Route | Rating | Why |
|---|---|---|
| `/content-planner` | **ok → near target** | Rebuilt after 10-01 with PageHeader, IconButton, StageTrack, DropdownMenu, showUndoToast; still 6 raw `<button>` |
| `/planner` | legacy | 76 `[var(--…)]`; no NowCard/SegmentedControl; "Remove this block?" copy (planner-view.tsx:525) |
| `/todos` | legacy | 2,071 lines, 104 `[var(--…)]`, hand-built dialogs, `window.confirm` (todos-view.tsx:1495) |
| `/notes` | legacy | hand-built `.empty-view` empty states (notes-view.tsx:112–198), legacy vars |
| shell (top-navbar, sidebar) | legacy | `text-[var(--ink-900)]`, `bg-[var(--brand)]`, `text-xs` tooltips |
| auth / `/auth/reset` | legacy | 58 legacy vars in auth-gate |
| `/`, `/daily` | redirect | both redirect to `/todos` |

Validation candidates: **`/notes`** (small, clarity problem: hand-built empty states, delete confirm), **`/planner`** (should get NowCard + SegmentedControl), `/todos` (largest, riskiest).

## 4. Repeated patterns done by hand (block candidates)

- **Confirm dialogs via raw AlertDialog** instead of `ConfirmDialog`: notes-view.tsx:91,167 · planner-view.tsx:525 · todos-view.tsx:829,1189 · sidebar.tsx:865 · desktop-update-provider.tsx:470.
- **Empty states not using `EmptyState`**: notes-view.tsx:112,123,189,198 · content-planner/content-empty-state.tsx (custom, OK as signature teaching state but not documented).
- **Horizontal pill/chip strips**: week-strip.tsx, series-strip.tsx (both new, raw `<button>` + `shadow-[var(--rim)]`) — possible shared "ChipStrip".

## 5. Consistency problems (whole app, tsx non-test)

| Issue | Count | Top files |
|---|---|---|
| `[var(--…)]` arbitrary classes | 299 | todos-view 104, planner-view 76, auth-gate 58, notes-view 16 |
| legacy vars (`--paper/ink/brand/line/warn/priority/planner`) | 322 | same |
| `text-xs` / `text-[11px]` | 46 | incl. primitives: ui/tooltip.tsx:70, ui/dropdown-menu.tsx:67,243, ui/select.tsx:105, ui/dialog.tsx:56 |
| raw `<button>` | 78 | todos, sidebar, top-navbar (5), content-planner (6) |
| `duration-N` | 19 | legacy screens |
| hex in tsx | 12 · `text-white/bg-black/bg-white` 6 | (guess — legacy screens; not traced) |
| `.planner-*` lines in globals.css | 368 matches | globals.css |

## 6. Instruction files

| File | UI content | Conflicts with brain |
|---|---|---|
| `CLAUDE.md` | Styling Removal, Tailwind layers, device-local UI state, defers UI to DESIGN.md | "New shadcn components: `npx shadcn@latest add`" vs ui-components "`pnpm exec shadcn add` … run `shadcn diff` first" (minor) |
| `AGENTS.md` | v1 ui-ux-pro block, lines 35–88 | none; precedence clause gives UI to block + DESIGN.md |
| `.claude/skills/{ui-system,ui-components,ux-patterns,ui-custom-elements}` | brain skills (`ui-ux-pro:skill v1`) | — |
| `.agents/skills/tiptap-editor` | points to DESIGN.md tokens | none |
| `.agents/skills/tauri-desktop` §3 | traffic-light / navbar alignment | none |
| `.agents/skills/{state-persistence,vitest-testing}` | local-only UI state; test helpers | none |
| `.claude/agents/kb-keeper.md` + `docs/kb/` (incl. `ui-design.md`) | KB; `ui-design.md` is pointers only (Last verified 2026-10-11) | none — defers to DESIGN.md |
| `.cursor/`, `.github/copilot-instructions.md`, `.claude/commands/`, `.brain/` | absent | — |

## 7. Can it render?

- `pnpm dev` → :5005 (**production PocketBase — real data**); `pnpm dev:test` → :5005 with local PB at 127.0.0.1:8090 (confident — package.json, .claude/launch.json).
- No-login local workspace: `http://localhost:5005/<route>?devWorkspace=1` (confident — AGENTS.md; src/lib/dev-mode.ts). Env: `.env.local`, `.env.test.local` exist.
- Screenshot: preview_start `dev-test` (or reuse a running :5005), open `/notes?devWorkspace=1`, 375px + 1280px, toggle `dark` class.

## 8. Similar helpers

| Path | What it does | Overlaps | Overlap | Worth keeping |
|---|---|---|---|---|
| `.claude/agents/kb-keeper.md` + `docs/kb/` (14 pages, INDEX/README/decisions) | Project knowledge base; ask mode before planning, record mode after; main agents must not read `docs/kb/` | `brain` | **full** (same job: project memory, self-maintained by an agent) | Strong: CLAUDE.md + AGENTS.md + KB README all wire agents to it; decisions.md log; "trust code over page"; safety gotchas (prod PB, server-first sync) |
| `docs/kb/ui-design.md` | UI pointer page | `brain` (UI slice) | partial | already defers to DESIGN.md |
| `.agents/skills/vitest-testing` §3 "UI Interaction Standards" | test conventions | `ui-qa` | partial (unit tests, not visual/usability QA) | test helpers in `src/test/repositories.ts` |
| any UI QA / a11y review agent | — | `ui-qa` | none found | — |

## Drift

**In code, not in skills**
- Content-planner components added since 10-01 (series-strip, card-series-picker, series-detail, series-name-dialog, publish-info, week-strip, shoot-card-view, capture-box, ideas-review, content-shelf) — none in `ui-components`; Series chip is in DESIGN.md → Components but not in `ui-custom-elements`.
- `content-planner/content-empty-state.tsx` (the "model" empty state per ux-patterns) is not listed as a block/signature.
- `/daily` route (redirect) undocumented (trivial).

**In skills, not (really) in code**
- `ui-components` "Example screen" claims are false: `EmptyState` (notes, todo groups), `InlineAlert` (auth, note load errors), `SegmentedControl` (planner, content planner), `PageHeader` (todos pane, planner), `ConfirmDialog` (todos workspace menu, notes) — actual uses are 0/0/0/content-planner-only/series-detail-only.
- `NowCard`, `PriorityTab`, `WashiTag` have 0 uses; `ui-custom-elements` says they appear in Planner, todo groups, todo rows.
- `Skeleton`, `Checkbox`, `Select`, `Separator` unused.

**Dead paths:** none — every path in AGENTS block, skills and DESIGN.md → Files exists (confident — ls). `.design/directions/_source/` referenced (not verified in depth).

**Token values outside DESIGN.md:** `ui-system` restates `--radius 0.875rem` (SKILL.md:47) and `300ms` cap (:66); `ux-patterns` "~200ms" (:18). Small but against DESIGN.md's own "never restate values" note.

**Internal DESIGN.md inconsistencies**
- NowCard row says "`--surface-shadow`" (a legacy alias) — Product tokens say `shadow-card`.
- Color rule says dark rims = `inset … var(--rule)`; product table defines `--rim` used as `shadow-[var(--rim)]`.
- Legacy vs target still says "Target-ready: none yet"; Content Planner now near target and not listed.
- `--warning` is "sync issue, offline", but the new offline-readonly sync pill uses `text-destructive` (top-navbar.tsx:~205).

**Hardcoded values in UI changed since 2026-10-01** (20 tsx files): 0 hex/rgb/oklch, 0 `text-white`. Remaining: legacy `[var(--ink-900|brand|brand-soft|warn)]` ×5 in top-navbar.tsx:272,369,371,385 (touched in f026d02, only partly migrated); `text-xs` tooltips top-navbar.tsx:266,389,418,440 + workspace.tsx:106; raw `<button>` ×6 in content-planner; `duration-[1000ms]` now-card.tsx:65 (documented exception); `dark:shadow-[…]` override stage-track.tsx:39 (ui-system says no `dark:` overrides). `text-[0.8125rem]` ×34 = sanctioned 13px.

**Rule conflicts elsewhere:** CLAUDE.md shadcn command vs ui-components (above). Primitives themselves (`ui/tooltip.tsx:70` etc.) use `text-xs`, contradicting "no `text-xs`".

**Size budget**
| File | Lines | Budget | Status |
|---|---|---|---|
| AGENTS.md brain block | 54 (lines 35–88) | ≤ 15 | **over ×3.6** |
| ui-system / ui-components / ux-patterns / ui-custom-elements | 66 / 70 / 58 / 50 | ≤ 150 | ok |
| DESIGN.md | 208 | ~3-min read | ok-ish |

**Missing clarity rules:** no "Every screen must be obvious" section in the AGENTS block; no Clarity section in `ux-patterns`. Live clarity issues: codebase jargon "PocketBase" in sync pill text (top-navbar.tsx:212,224,239); "Remove" vs "Delete" (planner-view.tsx:525).

**Quick card:** DESIGN.md has **no Quick card** (opens with Direction/Language/Personality lines, then Principles) and no "Read more" task→section map.

**Format drift:** v1 markers `ui-ux-pro:*` and state file `.design/scaffold.md` (current format uses ui-brain markers / `.design/setup.md`).

## Open questions

1. kb-keeper vs `brain`: (a) keep kb-keeper and connect it (recommended — wired into CLAUDE.md, AGENTS.md, KB README) · (b) merge into one · (c) replace with ui-brain's · (d) keep both.
2. AGENTS block over budget: (a) trim to ≤15 lines, move detail to skills (recommended) · (b) keep as is.
3. Offline sync pill color: (a) switch to `warning` per DESIGN.md · (b) keep destructive and update DESIGN.md.
4. Unused blocks/signatures (EmptyState, InlineAlert, SegmentedControl, NowCard, PriorityTab, WashiTag): (a) keep, fix skill examples to say "not adopted yet" (recommended) · (b) adopt on next touch of Notes/Planner/Todos · (c) remove.
5. Fix `text-xs` in shadcn primitives (tooltip, dropdown, select, dialog): (a) yes, routine compliance · (b) leave until touched.
