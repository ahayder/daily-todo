# Repo research — DailyTodo (checked 2026-10-01, branch `dev`, after revert aa86b68)

Current look = **Warm Minimalism** (CLAUDE.md:128). The Ember Journal files (`.design/DESIGN.md`, `rollout.md`, `directions/`) are deleted (confident — `git show --stat aa86b68`).

## 1. Stack

| Area | Fact | Evidence |
|---|---|---|
| Framework | Next.js 16.1.6 App Router, React 19.2.3, TS 5, **static export** (`output: "export"`) | package.json; next.config.ts:8 |
| Desktop | Tauri 2 (`@tauri-apps/api` 2.10, updater, process) | package.json |
| Package mgr | pnpm 8.7.1 | package.json `packageManager` |
| Styling | Tailwind v4.2 (`@tailwindcss/postcss`), `tw-animate-css`, `shadcn/tailwind.css`; one 4,845-line `globals.css` | src/app/globals.css:1-3 |
| Components | shadcn v4 CLI, style `base-nova` (Base UI primitives, not Radix), baseColor neutral, no extra registries | components.json |
| Icons | lucide-react 0.577 (19 files). `@tabler/icons-react` installed but **0 imports** | grep |
| Editor | Tiptap 3.20 + tiptap-markdown; Excalidraw 0.18; tippy.js | package.json |
| DnD | @dnd-kit core/sortable (content planner) | package.json |
| Markdown view | react-markdown 10 + remark-gfm | package.json |
| State/data | useReducer + Context, PocketBase 0.26, idb, zod 4, date-fns 4 | CLAUDE.md; package.json |
| Forms | none (hand-rolled inputs) | grep |
| Motion | tw-animate-css + 3 custom keyframes (`fadeIn`, `slideUp`, `scaleIn`) + `bubble-in`, `dtb-in`; canvas-confetti | globals.css:94-126, 2615, 2782 |
| Tests | Vitest 4 + Testing Library + jsdom; 12 component tests in `src/components/*.test.tsx` | ls |
| Storybook | none | ls |

## 2. Design-system inventory

### Primitives (`src/components/ui`, all Base UI-backed)
| Primitive | Files using it (non-test) |
|---|---|
| tooltip | 12 (TooltipTrigger ~100 uses, no IconButton wrapper) |
| alert-dialog | 6 (planner, updater, sidebar, content-planner, notes, todos) |
| button | 6 — but `<Button>` only 22 uses vs **~108 raw `<button>`** (content-planner 36, todos 20, sidebar 18) |
| input | 3 (`<Input>` 8 uses) vs raw `<input>/<textarea>` in 7 files |
| popover, scroll-area | 2 each |
| badge, dialog, select | 1 each |
| checkbox | 0 (unused) |

Missing that screens hand-build: dropdown/menu (3 `role="menu"` impls), tabs/segmented toggle, textarea, separator, skeleton, sheet.

### Higher-level/reused components
None shared. Every view is a monolith: `content-planner-view-root.tsx` 2,601 lines, `todos-view.tsx` 2,047, `sidebar.tsx` 922, `planner-view.tsx` 681. No `src/hooks/` (components.json alias points to it but dir missing).

### Layout / shell
`workspace/workspace.tsx` (sidebar + main, `isPlanner`/content-planner full-width branches), `top-navbar.tsx` (nav pills), `sidebar.tsx` (dates/notes tree + profile menu), `.app-shell` in CSS.

### Tokens (`globals.css`)
| Group | Names | Notes |
|---|---|---|
| Legacy custom (hex) | `--ink-900/700`, `--paper`, `--paper-strong`, `--line`, `--brand`, `--brand-soft`, `--warn`, `--surface-shadow` | used ~600x via `bg-[var(--…)]` arbitrary classes |
| Priority | `--priority-1/2/3` + `-soft` | |
| Planner | `--planner-teal/gold/rose/sage/lavender/track` | |
| shadcn (oklch) | `--background … --sidebar-ring`, `--chart-1..5` (default blue, unused), `--radius: .625rem` | bridged in `@theme inline` (globals.css:4793) |
| Scale vars | `--content-planner-font-xs/sm/micro`, `--content-planner-leading-6`, `--content-planner-card-max-height` | A-/A+ font-scale |

The two systems are **not linked**: `--paper` (#faf8f4) and `--background` (oklch .95) are separate values; light `--primary` is near-black, while the product accent is `--brand` teal (confident — globals.css:8-61).

### Fonts
Source Sans 3 via `next/font` → `--font-body` (layout.tsx:2-9). JetBrains Mono referenced only as a CSS stack string, not loaded (globals.css:1278). `font-family` restated 9x in CSS.

### Dark mode
`.dark` class, `@custom-variant dark`. `themeMode` light/dark/system (default **"dark"**, store.ts:997), applied client-side (use-app-persistence-state.ts:680-705). `layout.tsx:24` hardcodes `className="dark"` → light users get a dark flash before hydration. Dark palette is cool blue-gray (oklch hue 247-252), 40 `.dark .x` override selectors.

### Motion utilities
Durations in CSS: 150ms ×80, 180 ×12, 120 ×10, 200 ×7; TSX `duration-150` ×54. `prefers-reduced-motion` handled in only 2 CSS blocks + planner-tour.

## 3. Screens

| Route | Component | Rating | Why |
|---|---|---|---|
| `/todos` (core) | todos-view.tsx | **legacy** | 2k lines; mixes 69 globals.css classes + 142 arbitrary Tailwind values; raw buttons |
| `/notes` | notes-view.tsx | ok | small (230), CSS classes; `.empty-view` repeated 5x |
| `/planner` | planner-view.tsx | ok → near target | recent Tailwind rewrite, uses AlertDialog/Tooltip; ~1,580 lines of now-dead planner CSS remain |
| `/content-planner` | content-planner-view-root.tsx | ok | newest, feature-rich, but 431 arbitrary values, 36 raw buttons, 12 matchMedia calls |
| Auth gate (any route) | auth-gate.tsx | ok | Tailwind + `rgb()`; sibling screens use `.auth-card` CSS |
| `/auth/reset`, verification | password-reset-screen / verification-pending-screen | legacy | BEM CSS classes |
| `/`, `/daily` | redirects → `/todos` | — | |

Shell (top-navbar, sidebar): legacy (CSS classes, raw buttons).

**Validation-screen candidates:** 1) `/todos` — the product's heart, most legacy, has priority groups/inline add/empty state. 2) `/notes` — small, renderable, exercises editor + empty state. 3) `/planner` NOW — cleanest code; good for checking the signature card.

## 4. Repeated hand-built patterns (block candidates)

| Pattern | Where |
|---|---|
| Confirm-delete dialog (AlertDialog composed inline) | planner-view, sidebar, notes-view, todos-view, content-planner-view-root, desktop-update-provider |
| Icon button + Tooltip + aria-label | todos (19 triggers), content-planner (25), top-navbar (11), sidebar (9), planner (5), notes (5), drawing/editor toolbars |
| Empty state | notes-view:112-206 (`.empty-view` ×5), todos-view:1498 + `.task-empty`:2034, content-planner pristine empty state, planner "Free — your call" |
| Loading spinner (`LoaderCircle` + `animate-spin`) | auth-gate, verification-pending, password-reset, top-navbar, sidebar, desktop-update-provider, todos-view |
| Overflow/“three-dot” menu (hand-rolled `role="menu"`) | sidebar (profile menu), content-planner (card + column menus) |
| Inline editable title/text input | planner-view, sidebar (rename), notes-view (title), todos-view, content-planner (column titles, cards) |
| Segmented toggle (Now/Set up, Board/Gallery, Todos/Daily note, weekday tabs) | planner-view, content-planner-view-root, todos-view (guess — by feature description in CLAUDE.md) |
| Viewport/pointer media queries (no hook) | content-planner (12), top-navbar (2), use-app-persistence-state |

## 5. Consistency problems

| Issue | Count | Top files |
|---|---|---|
| Arbitrary `-[…]` classes in TSX | 1,008 | content-planner-root 431, planner 144, todos 142, auth-gate 88 |
| …of which token-via-arbitrary (`text-[var(--ink-900)]` etc.) | ~600 | same |
| Hex in CSS / `rgba()` in CSS | 45 / 50 | globals.css |
| Hex/rgb in TSX | 13 / 10 | drawing-toolbar, confetti, auth-gate, todos, planner |
| Raw palette classes | `text-white` 10, `bg-white` 2, `bg-black` 2 | components |
| Text <13px (violates no-text-below-13px goal) | 60 `text-xs`, 6 `text-[11px]`, 1 `text-[10px]`; ~60 CSS font-sizes 10–12.5px | todos, content-planner, sidebar CSS |
| Border-radius values in CSS | 15 distinct (4,6,7,8,9,10,11,12,14,18,20,24,999px…) | globals.css |
| Tailwind radius | `rounded-lg` 70, `-2xl` 36, `-full` 34, `-xl` 6, plus `[9px] [24px] [28px] [4px]` | components |
| Unlayered CSS in globals.css | ~4,000 of ~4,300 non-blank lines outside `@layer` (awk count) — contradicts CLAUDE.md's own "NEVER unlayered" rule | globals.css:76-4257, 4700-4790 |
| Dead CSS | ~148 of 358 class selectors unreferenced in components; 137/145 `.planner-*` | globals.css:2871-4700 |
| Dead code | `planner-tour.tsx` never imported; `@tabler/icons-react` unused; `ui/checkbox.tsx` unused | grep |
| Mixed icon sets | none in code (lucide only) | — |

## 6. Instruction files

| File | What it says about UI |
|---|---|
| `CLAUDE.md` (227 lines) | Warm Minimalism: 5 pillars, token table, Source Sans only, radius/spacing scale, hover/AlertDialog/Tooltip rules, motion 150–200ms, focus `2px var(--brand)`, Styling Removal Rule, Tailwind layer rule. "Brain file" with mandatory update rule. |
| `AGENTS.md` | Delegates wholly to CLAUDE.md; says skills live in `./.agents/skills/`. |
| `.claude/skills/design-system/SKILL.md` | Identical copy of `.agents/skills/design-system/SKILL.md` (diff = same). Checklist restating tokens. |
| `.agents/skills/{state-persistence,tauri-desktop,tiptap-editor,vitest-testing}` | Non-visual, except tiptap-editor: floating menus use `var(--paper-strong)`/`var(--line)`, "match Warm Minimalism". Not mirrored into `.claude/skills/`. |
| `.cursor/`, `.github/copilot-instructions.md` | absent |
| `.design/scaffold.md` | scaffold state only (phase: research) |

**Rules that conflict with a design-system approach / with the code:**
- Skill: “Typical Tailwind usage: `bg-[var(--paper)]` … `text-[var(--ink-900)]`” — institutionalises arbitrary-value tokens instead of semantic utilities (`bg-background`); root cause of the ~600 arbitrary token classes.
- Skill: “Tiptap stays content-first with no visible toolbar” — but `markdown-editor.tsx:121` renders `<EditorToolbar>`.
- CLAUDE.md: “No serifs anywhere” / “One font family … across ALL roles” — hard-locks typography; any new direction must rewrite it.
- Token values in CLAUDE.md/skill ≠ code: `--paper-strong` doc `#ffffff` vs code `#eee7dc`; `--line` `#d9d1c5` vs `#d6ccbd`; dark `--brand` `#3d8c7f` (doc) vs `#5ea89d` (code). Skill claims "Dark mode … never true black" and warm, but dark tokens are cool blue-gray.
- CLAUDE.md focus ring `var(--brand)` vs shadcn primitives using `ring-ring/50` — two focus styles.
- Token values are restated in 3 places (globals.css, CLAUDE.md, two skill copies) → guaranteed drift.

## 7. Can it render?

- Dev: `pnpm dev` → `next dev --webpack -p 5005`; `.claude/launch.json` has config `dev` on 5005.
- Env: `NEXT_PUBLIC_POCKETBASE_URL`, `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` (`.env.local`); `pnpm dev` targets **production** PocketBase (CLAUDE.md).
- Auth wall: yes (`AuthGate`). **Bypass for screenshots:** on localhost, "Open local dev workspace" button or `?devWorkspace=1` enables a browser-only workspace (src/lib/dev-mode.ts:3,46-55; auth-gate.tsx:358) — no credentials, no prod data. Safer alternative: `pnpm dev:test` against local PocketBase.
- Screenshot path: preview_start `dev` → navigate `http://localhost:5005/todos?devWorkspace=1` (also `/notes`, `/planner`, `/content-planner`). Theme defaults to dark; toggle via sidebar profile menu.

## Open questions

1. Token source of truth: (a) collapse legacy `--paper/--ink/--brand` into shadcn names and delete aliases, (b) keep both with legacy aliasing shadcn, (c) keep as-is.
2. globals.css: (a) migrate BEM CSS to Tailwind per screen as it's touched, (b) wrap existing CSS in `@layer components` now and delete dead planner CSS, (c) both.
3. Dark mode default: (a) keep "dark" default, (b) switch to "system" + pre-hydration script, (c) light default.
4. Editor toolbar: (a) keep visible toolbar and fix the rule, (b) remove toolbar per rule.
5. Minimum text size: (a) enforce 13px (touches 60+ `text-xs`), (b) allow 12px for meta labels only.
