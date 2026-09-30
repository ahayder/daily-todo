# UI/UX scaffold plan — DailyTodo

<!-- Written in phase 4 (2026-10-01) from .design/research/*, .design/brief.md and .design/strategy.md.
     Nothing in the project changes until this is approved. -->

## Summary

- **Direction:** new — **B2 "Pocket Stickers — Deep"**: near-black plum night notebook, one lilac accent, pastel sticker priorities (peach/butter/mint), Baloo Da 2 + Nunito + DM Mono, airy and rounded. Dark-first; light theme = B's light. Source: `.design/directions/B2-pocket-stickers-deep.html`, tokens in `.design/directions/_source/tokens.json`.
- **Biggest wins:**
  - One token set: the old `--paper/--ink/--brand` values become aliases of shadcn tokens. That fixes about 600 `bg-[var(--…)]` classes across the app in one place, with no rewrites. `--primary` becomes the accent.
  - Shared blocks for things built by hand 4–14 times: confirm dialog, empty state, inline composer, segmented control, icon button, overflow menu.
  - A brain (AGENTS.md block + 4 project skills + DESIGN.md) replacing the drifting "Warm Minimalism" copy in CLAUDE.md and two duplicate skills.
- **Not doing:** no screen rewrites (except the one validation screen), no Tailwind/Base UI upgrades, and no bulk migration of the 4,845-line `globals.css`. Legacy CSS stays and gets migrated per screen as each one is touched.
- **Visible effect right away:** colors and fonts change app-wide (tokens + fonts), but layouts stay as they are.

## 1. Agent instructions (always loaded)

- `AGENTS.md`: **update**. Its current "defer to CLAUDE.md" text stays for non-UI topics, and the brain block is appended. Rule: `.design/DESIGN.md` is the UI source of truth.
- `CLAUDE.md`: add `@AGENTS.md` near the top. **Remove** the "Design System: Warm Minimalism" section, including its tokens, palette, font and radius tables (CLAUDE.md:128–~200). The still-valid rules move into DESIGN.md or the block: hover states, icon-button tooltip + label, motion 160–220ms, Styling Removal Rule, Tailwind `@layer` rule. The product/architecture parts stay untouched.
- Extra project rules in the block:
  - Base UI, not Radix: `asChild` only on Popover/Tooltip (local shim); everywhere else use `render`.
  - Use semantic utilities (`bg-background`, `text-muted-foreground`), never `bg-[var(--…)]`.
  - Bengali-safe type (line-height ≥ 1.7 for note text, no `text-xs` body).
  - Todos/Notes keep the sidebar; Planner and Content Planner are full-width.

## 2. Operational skills (`.claude/skills/`)

| Skill | Covers | Status |
|---|---|---|
| `ui-system` | token names → utilities, dark/light, fonts (Latin + Bengali), radius, motion tokens | add |
| `ui-components` | `components/ui/*` + blocks inventory, Base UI `render` vs `asChild`, `shadcn diff` before re-adding | add |
| `ux-patterns` | deletes (undo vs confirm), empty/loading (cache-first, no spinner over a page), errors + sync pill, inline add, responsive (coarse pointer = no drag/hover), keyboard shortcuts, a11y | add |
| `ui-custom-elements` | Now card, sticker priority tab, washi carryover tag, stage track, soft-cap badge | add |
| `design-system` (`.claude/` + `.agents/` copies) | Warm Minimalism checklist, token values that don't match the code | **remove** (replaced by the four above) |
| `.agents/skills/tiptap-editor` | editor rules; says "match Warm Minimalism" | change that one line to point at DESIGN.md |

## 3. Components (`src/components/ui/`)

| Item | Action | Why (evidence) | Rejected |
|---|---|---|---|
| `button` variants | change (styling only): pill, sticker-soft, ghost; sizes with 44px touch min | 108 raw `<button>` vs 22 `<Button>`; 300-char class strings repeated | per-screen button styles |
| `icon-button` | add: Button + Tooltip + required `aria-label` | ~100 tooltip triggers built by hand; CLAUDE.md rule | lint-only enforcement |
| `dropdown-menu` | add (shadcn base-nova) | 3 hand-built `role="menu"` implementations | Popover + custom menu |
| `toast` | add: Base UI Toast via shadcn (no new npm dep) | needed for the chosen "instant delete + Undo" pattern | sonner (extra dep) |
| `textarea`, `separator`, `skeleton` | add | raw textarea in 7 files; loading uses 3 styles | — |
| `badge` | change: `chip` + `sticker` variants | 6 hand-built `rounded-full border` chips | — |
| `checkbox` | keep (unused today, restyle only) | todos use custom checks; adopt when touched | — |

## 4. Blocks (`src/components/blocks/`)

| Block | Built from | Used by | Why |
|---|---|---|---|
| `ConfirmDialog` | AlertDialog | notes, sidebar, planner, todos workspace, content column | 7 hand-built dialogs with varying copy |
| `EmptyState` | icon + title + body + optional action | todos, notes ×5, todo groups, focus mode | 7 bare empty states; content planner's is the model |
| `InlineComposer` (`line` / `block`) | Input / Textarea | todo groups, subtasks, content cards, capture box | 4 variants with different submit keys |
| `SegmentedControl` | radio-group semantics | Now/Set up, Board/Gallery, Todos/Daily note, weekday tabs | 5 hand-built, mixed `aria-pressed` vs `role=tab` |
| `PageHeader` | title + subtitle + actions slot + meta chip | todos panes, planner, content planner | 4 header scales, 3 structures |
| `InlineAlert` | tone warn/info + action | auth errors, updater error, note load errors | one-off rgba error boxes |
| `useMediaQuery` + named queries | `src/hooks/` | content planner (12 calls), navbar, todos | duplicated matchMedia logic |

## 5. Themes & tokens

- **Token file:** `src/app/globals.css`, in the `:root` / `.dark` / `@theme inline` blocks only.
  - Replace the values with B2's (`tokens.json`).
  - Legacy `--paper/--ink-*/--line/--brand/--brand-soft/--priority-*` become `var(--shadcn-name)` aliases.
  - Add product tokens `--p1..3(-soft/-ink)`, `--now-*`, `--washi`, `--rule`, `--duration-ui` (200ms) and `--ease-out`, and map them in `@theme inline`.
  - Delete the unused `--chart-*` blue defaults.
- **Dark mode:** stays the default (you live in dark). Add a small pre-hydration script that applies the saved theme, which removes the hard-coded `className="dark"` flash for light users. Neutrals are plum-tinted, never cool slate.
- **Fonts** (`next/font/google` in `layout.tsx`, self-hosted, works offline in Tauri):
  - Baloo Da 2 (latin + bengali) for headings and as the Bengali fallback
  - Nunito for the body
  - DM Mono for times and estimates
  - Source Sans 3 is removed.
- **Contrast:** B2 passes WCAG AA in both themes (strategy.md). Re-run `contrast-audit.mjs` after building the app, since the old `out/` build is stale.

## 6. Motion

- **Library:** CSS + tw-animate-css only (already used). No `motion`, no ViewTransition for now.
- **Primitives** (utilities in `globals.css`, `@layer utilities`): `animate-settle` (checked task), `animate-stamp` (done / stage advance), `animate-enter` (composer, toast, card add), and the ring/progress drain as a linear transition.
- **Level:** subtle, 160–220ms ease-out, press scale 0.97, no springs. All of it is off under `prefers-reduced-motion`, handled in the primitives rather than per call.
- **Confetti:** colors come from tokens.

## 7. UX patterns

| Pattern | Standard (decided) | Needs product judgment (ask) |
|---|---|---|
| Destructive | Small, recoverable (todo, card) → instant + Undo toast. Big deletes (workspace, folder, column, note) → `ConfirmDialog` "Delete '{name}'?", "Cancel" / "Delete {noun}". No `window.confirm`. | whether the todo status-change confirm stays |
| Loading | cache-first: no spinner over a page; skeleton lines for first load; spinner only inside buttons | — |
| Errors | sync pill is the only global status; `InlineAlert` shows what's safe first ("Saved on this device") | — |
| Empty | `EmptyState` with one action; teach by doing (Content Conveyor model) | — |
| Inline add | `line`: Enter adds and keeps focus. `block`: ⌘/Ctrl+Enter adds, Esc cancels. | — |
| Navigation | top pills + sync + theme stay; sidebar only on Todos/Notes | any nav restructure |
| Responsive | coarse pointer: no drag/hover dependence, explicit move dialogs; 44px targets | — |
| Priorities | sticker hue + symbol + word (`!! Must do`), never color alone; carryover is never red | extending soft caps (e.g. Must do ≤ 3) to todos |

## 8. Custom design elements (`src/components/signature/`)

| Element | What it is | Where | Rules |
|---|---|---|---|
| `NowCard` (`block` / `task` / `mini`) | deep-lilac block with a ring timer, title, time left, next up | Planner NOW, Focus-mode timer | the ring is the only glow; DM Mono tabular numbers; no warning color when over time |
| `PriorityTab` | pastel sticker tab (peach / butter / mint) with symbol + word | todo group headers, filters | exactly three hues with fixed roles; task text stays plain |
| `WashiTag` | washi-tape "From yesterday" / "3 days waiting" tag | todo rows, focus card, "Worth a look" | one per row, grows in weight not color, hidden when done |
| `StageTrack` + `SoftCapBadge` | `Inbox › Develop › Shoot next › Published` stamp; `N/5` tint | content planner board, gallery, review inbox | stage ids, never titles; tints, never blocks |

## 9. Dependencies

| Package | Change | Why |
|---|---|---|
| `@tabler/icons-react` | remove | 0 imports; lucide is the icon set |
| none added | — | toast, dropdown and fonts come from Base UI / shadcn / next/font |
| `tippy.js` | keep for now | slash-menu migration to Floating UI is a separate task |

## 10. Validation

- **Screen:** `/todos` (`src/components/todos/todos-view.tsx`). It is the product's heart and the most legacy screen, and it has priority groups, inline add, empty states and carryover.
- **Task for the test agent** (pick one):
  - (a) *"Redesign the Todos page."* This shows the biggest quality difference.
  - (b) *"Let me delete a todo safely: deleting should be instant but undoable."* This is a smaller task that tests blocks, the toast and the rules.

## Open decisions for the user

1. Validation task: (a) redesign or (b) undo-delete feature.
2. Remove the Warm Minimalism section from CLAUDE.md (recommended) or keep it with a pointer to DESIGN.md.
3. Branch: create `ui-scaffold`, or keep working on `dev` like the makeover did.
