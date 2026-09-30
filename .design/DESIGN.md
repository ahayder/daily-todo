# DailyTodo design language

<!-- The single source of truth for how DailyTodo looks, moves, and sounds.
     Read before any UI work; it overrides ui-ux-pro defaults and replaces CLAUDE.md "Warm Minimalism".
     Token VALUES live only here and in src/app/globals.css — never restate them in CLAUDE.md, AGENTS.md or skills.
     Rationale: .design/strategy.md ("B2 revision"). Plan: .design/plan.md. Preview: .design/directions/B2-pocket-stickers-deep.html. -->

**Direction:** B2 "Pocket Stickers — Deep" — a near-black plum night notebook with pastel sticker tabs, washi-tape carryover and a ring-timer Now card.
**Language:** soft modern (playful, toned down) + stickers, washi tape and the Now ring as the only decoration.
**Personality:** Caregiver (+ Sage) · feel: calm, friendly, focused, encouraging · never: busy, judgy, childish
**Sliders:** Serious 4/5 Playful · Classic 3/5 Modern · Calm 2/5 Energetic · Premium 3/5 Accessible · Dense 4/5 Airy
**Theme:** dark is designed first and is the default; light must work equally well.

## Principles

1. **One obvious next action** — lilac (`primary`) is used only for primary actions, focus, the current selection and the Now card, because an ADHD brain needs "what do I do now" answered without searching.
2. **Color sorts, words confirm** — peach / butter / mint stickers group the day before reading, but every priority also shows its symbol and word (`!! Must do`), because color alone fails for some eyes and some moods.
3. **Kind, never judgy** — carryover age and running over time are never red or alarming; limits tint, they never block, because guilt makes the user close the app.
4. **Quiet at night** — near-black plum with small surface steps and hairline rims; only state changes move, because the app is read for hours in the dark and motion pulls attention.
5. **Bengali is first-class** — every text style must look right in Bengali and mixed Banglish, because notes are written in both.
6. **Stickers stay on the edges** — pastel lives on tabs, tape, the date sticker and the Now card; task and note text stays plain ink, so it never feels childish on heavy days.

## Color

Tokens live in `src/app/globals.css` (`:root` = light, `.dark` = dark, mapped in `@theme inline`). Accent/status values come from:
`node ~/.claude/skills/ui-ux-pro/skills/brand-design/scripts/palette.mjs "oklch(0.78 0.1 295)" --keep-seed --tint 0.022 --json` (dark) and `… palette.mjs "oklch(0.52 0.15 295)" --tint 0.022 --json` (light). Neutrals and product tokens (`--p*`, `--now-*`, `--rule`) are hand-tuned in `.design/directions/_source/build-tokens.mjs` (entry `B2`, output `tokens.json`); all text pairs pass WCAG AA in both themes. Rerun `contrast-audit.mjs` after any change.

### Core (shadcn names — use these in new code)

| Token | Light | Dark | Use for |
|---|---|---|---|
| `background` | `oklch(0.978 0.012 300)` | `oklch(0.145 0.024 300)` | page, sidebar, inputs |
| `foreground` | `oklch(0.2 0.029 300)` | `oklch(0.96 0.01 300)` | all body text |
| `card` / `-foreground` | `oklch(0.996 0.002 300)` / fg | `oklch(0.175 0.024 300)` / fg | panes, cards, active day, nav pill track |
| `popover` / `-foreground` | `oklch(0.996 0.002 300)` / fg | `oklch(0.2 0.024 300)` / fg | menus, popovers, dialogs |
| `muted` = `secondary` = `accent` | `oklch(0.943 0.017 300)` | `oklch(0.215 0.024 300)` | chips, segmented tracks, row hover |
| `…-foreground` of the three above | `oklch(0.2 0.029 300)` | `oklch(0.96 0.01 300)` | text on them |
| `muted-foreground` | `oklch(0.5 0.031 300)` | `oklch(0.74 0.022 300)` | meta, placeholders, counts |
| `border` | `oklch(0.903 0.019 300)` | `oklch(0.24 0.022 300)` | dividers, card borders |
| `input` | `oklch(0.654 0.019 300)` | `oklch(0.479 0.022 300)` | input and checkbox outlines |
| `ring` | `oklch(0.62 0.158 295)` | `oklch(0.72 0.095 297.8)` | focus ring, link underline |
| `primary` | `oklch(0.52 0.15 295)` violet | `oklch(0.78 0.1 295)` lilac | primary button, active nav pill, current stage, checked state |
| `primary-foreground` | `oklch(0.99 0 0)` | `oklch(0.19 0.026 300)` | text on primary |
| `brand-subtle` | `oklch(0.975 0.015 307.8)` | `oklch(0.22 0.045 295)` | "Next" label, ongoing chip, info callouts |
| `brand-subtle-foreground` | `oklch(0.39 0.126 293.8)` | `oklch(0.88 0.05 300)` | text on brand-subtle |
| `destructive` / `-foreground` | `oklch(0.56 0.22 27)` / `oklch(0.99 0 0)` | `oklch(0.56 0.19 27)` / `oklch(0.99 0 0)` | delete buttons and errors only |
| `success` / `-foreground` | `oklch(0.545 0.15 150)` / `oklch(0.99 0 0)` | `oklch(0.52 0.13 150)` / `oklch(0.99 0 0)` | "Saved", update installed |
| `warning` / `-foreground` | `oklch(0.78 0.16 75)` / `oklch(0.16 0.031 295)` | `oklch(0.8 0.14 75)` / `oklch(0.18 0.031 295)` | sync issue, offline |
| `info` / `-foreground` | `oklch(0.55 0.15 250)` / `oklch(0.99 0 0)` | `oklch(0.52 0.13 250)` / `oklch(0.99 0 0)` | neutral notices |
| `sidebar` | = `background` | `oklch(0.16 0.024 300)` | sidebar surface; other `sidebar-*` alias `foreground`/`primary`/`accent`/`border`/`ring` |
| `--radius` | `0.875rem` | same | base radius (see Shape) |

### Product tokens

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--p1` / `--p1-on` | `oklch(0.89 0.062 45)` / `oklch(0.3 0.06 40)` | `oklch(0.78 0.075 45)` / `oklch(0.2 0.035 40)` | **peach** sticker tab + text on it — priority 1 |
| `--p1-soft` / `--p1-ink` | `oklch(0.965 0.019 45)` / `oklch(0.44 0.1 40)` | `oklch(0.215 0.03 355)` / `oklch(0.85 0.06 45)` | P1 group wash / P1-colored text on page or wash |
| `--p2` / `--p2-on` | `oklch(0.92 0.085 95)` / `oklch(0.32 0.06 85)` | `oklch(0.84 0.085 95)` / `oklch(0.22 0.035 90)` | **butter** — priority 2, date sticker |
| `--p2-soft` / `--p2-ink` | `oklch(0.97 0.03 95)` / `oklch(0.43 0.08 80)` | `oklch(0.22 0.018 75)` / `oklch(0.87 0.07 95)` | P2 wash / text |
| `--p3` / `--p3-on` | `oklch(0.9 0.065 165)` / `oklch(0.3 0.06 165)` | `oklch(0.79 0.075 165)` / `oklch(0.2 0.035 165)` | **mint** — priority 3 |
| `--p3-soft` / `--p3-ink` | `oklch(0.965 0.02 165)` / `oklch(0.41 0.08 165)` | `oklch(0.215 0.024 205)` / `oklch(0.85 0.06 165)` | P3 wash / text |
| `--washi` / `--washi-foreground` | `var(--p2)` / `var(--p2-on)` | same | carryover washi tag |
| `--now-bg` (= `--now-fill`) | `oklch(0.895 0.057 295)` | `oklch(0.285 0.075 295)` | Now card surface |
| `--now-fg` / `--now-muted` | `oklch(0.22 0.05 295)` / `oklch(0.36 0.07 295)` | `oklch(0.97 0.012 295)` / `oklch(0.84 0.05 295)` | Now card title / meta |
| `--now-bar` | `oklch(0.3 0.08 295)` | `oklch(0.8 0.1 295)` | ring, progress bar, now dot (the only glow) |
| `--rule` | `oklch(0.55 0.05 300 / 12%)` | `oklch(0.9 0.03 300 / 6%)` | ruled lines, dashed dividers |
| `--rim` | `inset 0 0 0 1px transparent` | `inset 0 0 0 1px oklch(0.96 0.01 300 / 6%)` | hairline rim on dark panes, pill tracks (`shadow-[var(--rim)]`) |
| `--card-shadow` (utility `shadow-card`) | `0 8px 24px -12px oklch(0.25 0.08 300 / 0.35)` | `0 10px 28px -14px oklch(0 0 0 / 0.6)` | Now card, popovers, toast, selected segments |
| `--duration-ui` / `--duration-fast` / `--ease-ui` | `200ms` / `160ms` / `cubic-bezier(0.22, 1, 0.36, 1)` | same | all UI transitions; Tailwind's default `transition` duration/easing and `ease-out` utility map to these |
| `chart-1..5` | `oklch(0.62 0.15 295)` · `0.62 0.127 85` · `0.62 0.15 355` · `0.62 0.15 145` · `0.62 0.118 225` | `oklch(0.72 0.12 295)` · `0.72 0.148 85` · `0.72 0.15 355` · `0.72 0.15 145` · `0.72 0.136 225` | planner pie / block colors only |

### Legacy aliases (keep until every use is migrated; never use in new code)

`--paper`→`background` · `--paper-strong`→`card` · `--ink-900`→`foreground` · `--ink-700`→`muted-foreground` · `--line`→`border` · `--brand`→`primary` · `--brand-soft`→`brand-subtle` · `--warn`→`destructive` · `--priority-N`→`--pN-ink` · `--priority-N-soft`→`--pN-soft` · `--planner-lavender/gold/rose/sage/teal`→`chart-1/2/3/4/5` · `--planner-track`→`muted` · `--surface-shadow`→`--card-shadow`. The old shadcn blue `chart-*` defaults are replaced by the B2 set above.

Rules:
- Use semantic utilities (`bg-background`, `text-muted-foreground`, `bg-p1-soft`, `bg-now`, `text-now-foreground`, `bg-washi`), never `bg-[var(--…)]`, hex, `rgb()`, `text-white` or `bg-black`.
- `primary` appears at most once per view as a filled button; the Now card is the only other large lilac area.
- Priority hues are fixed: priority 1 = peach, 2 = butter, 3 = mint, whatever label set (Normal / ADHD 1 / ADHD 2) is active. No fourth pastel.
- Pastels are surfaces (tabs, washes, tape, stickers); text on them uses the matching `-on` token. Pastel-colored text uses `-ink`.
- Carryover age, time left and over-time never use `destructive` or `warning`.
- Dark depth = surface steps + `--rule` rims (`box-shadow: inset 0 0 0 1px var(--rule)`) on panes, the nav pill track and group blocks; not big shadows. Neutrals are plum-tinted (hue 300), never cool slate or pure black.

## Typography

| Role | Font | Weights | Notes |
|---|---|---|---|
| Heading / display | Baloo Da 2 (latin + bengali) | 600, 700 (500 for soft labels) | tracking −0.005em, sentence case, line-height 1.15–1.3 |
| Body / UI | Nunito, falling back to Baloo Da 2 for Bengali glyphs | 400, 500, 600, 700 | line-height 1.6; task text 1.45 (Latin) |
| Mono | DM Mono | 400, 500 | times, estimates, timers, counts — always `tabular-nums` |

- Scale (base 16, ratio 1.25): 13 · 14 · 15 (task text) · 16 · 20 · 25 · 30 (page date) px. Nothing below 13px; no `text-xs` (12px) or `text-[11px]`.
- Font setup: `next/font/google` in `src/app/layout.tsx` (self-hosted, works offline in Tauri). Variables `--font-display` (Baloo Da 2), `--font-latin-body` (Nunito), `--font-numeric` (DM Mono); `--font-body` in `globals.css` = Nunito → Baloo Da 2 → system. Utilities: `font-sans` (body), `font-heading`, `font-mono`. `h1–h3` get the heading font in `@layer base`. Source Sans 3 is removed.
- Bengali: note and editor text line-height ≥ 1.7; Bengali task text ≥ 1.6 (`[lang="bn"]`). Check mixed Bengali/Latin lines visually when changing sizes; adjust with `size-adjust` only if they look uneven.
- Group headers ("Must do") use the heading font at 15px/700 — the only small heading-font use.

## Shape, depth & layout

- Radius (`--radius: 0.875rem`): checkboxes `rounded-sm` (~8px, 2px border) · inputs, task rows, menus `rounded-lg` (14px) · cards `rounded-xl` (~20px) · priority group blocks, page panes, toast `rounded-2xl` (~25px) · Now card `rounded-3xl` · buttons, nav pills, chips, segmented controls, stage stamps `rounded-full`.
- Borders: 1px `border` for cards and dividers; `--rule` rim instead of a border on dark panes; dashed `--rule`/`input` for "future" things (unstarted stage, free time).
- Depth: dark — surface steps (bg 0.145 → card 0.175 → popover 0.20 → muted 0.215) + rims; `shadow-card` only on the Now card, popovers and toast. Light — `shadow-card` on the Now card and popovers.
- Density: airy. 4px rhythm; pane padding 24–28px desktop, 16px phone; 14px gap between panes; task rows 9px × 8px padding. Touch targets ≥ 44px on coarse pointers.
- Layout: Todos and Notes keep the 228px sidebar; Planner and Content Planner are full-width. Todos panes (note / tasks) become a `Todos` / `Daily note` switcher below 900px.

## Motion

- 160–220ms, `var(--duration-ui)` 200ms with `var(--ease-ui)` (plain `transition` utilities already use them); opacity/transform only; never above 300ms; no springs or bounce. CSS + `tw-animate-css` only.
- Primitives (`globals.css`, `@layer utilities`): `animate-settle` (checked task settles), `animate-stamp` (done / stage advance fade), `animate-enter` (composer, toast, new card). Press = `scale(0.97)`: built into `Button`; `press` utility for other clickable surfaces. Now ring / progress drains with a linear transition.
- `prefers-reduced-motion`: all of it off, handled inside the primitives, not per call. No looping or pulsing (timers, badges, banners). Confetti colors come from tokens.

## Iconography & imagery

- Icons: lucide-react only (`@tabler/icons-react` is removed), 2px stroke, round caps; 16px in rows and buttons, 20px in nav.
- Illustration: none; no mascot. Tiny sticker shapes allowed only inside empty states.
- Mark: stacked sticker circle with a check (preview file, `markSvg`).

## Components (brand-specific treatments)

Primitives in `src/components/ui/` use **Base UI**: `render` prop, not `asChild` (except the local Popover/Tooltip shim). Run `shadcn diff` before re-adding one.

- **Button:** pill (`rounded-full`). Variants `default` (primary fill; hover = `color-mix(in oklch, var(--primary) 88%, var(--foreground))`), `soft` (`brand-subtle` surface, same color-mix hover), `secondary`, `ghost`, `outline`, `destructive` (solid fill + `destructive-foreground`), `link`. Sizes `xs`/`sm`/`default`/`lg` + `icon-*`; text ≥ 13px. Label sentence case, verb first ("Start this one").
- **IconButton:** Button + Tooltip + required `aria-label` — the only way to make an icon button.
- **Card / pane:** `bg-card`, `rounded-xl`/`rounded-2xl`, rim in dark, no shadow.
- **Input / Textarea:** `bg-background`, 1px `input` border, `rounded-lg`; placeholder in voice ("Add a must-do task…").
- **Navigation:** top pill track on `card` (rim in dark); active pill = `primary` fill; sync pill (dot + "Saved · 2 min ago") is the only global status. Sidebar active day = `card` with a `primary` count.
- **Badge:** `chip` (card + border, muted text) and `sticker-1/2/3` (pastel + `-on` text); 13px, rounded-full.
- **Checkbox (task check):** 20px, `rounded-sm`, 2px `input` border, hover border `ring`; done fills with the group's sticker hue + `-on` check.
- **Toast:** `src/components/ui/toast.tsx` (Base UI Toast, mounted once in `Providers`): inverted pill (`bg-foreground text-background`), message + tinted "Undo" action + dismiss, 44px targets on touch, safe-area bottom offset. Used for undoable deletes, not autosave.
- **Page date (Todos):** heading font 30px; the day number sits on a butter (`--p2`) sticker tilted −2°. Only here.
- **Focus ring (everything):** `outline: 2px solid var(--ring); outline-offset: 2px` on `:focus-visible` (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`), built into Button, SegmentedControl and the blocks. Some untouched shadcn primitives (Input, Select) still use `ring-3 ring-ring/50`; align them when touched.
- **Hover:** every interactive element has a visible hover (row → `accent`/card mix, button → darken/tint, link → underline in `ring`).

## Custom design elements

Live in `src/components/signature/`. Inventory and usage: `.claude/skills/ui-custom-elements`.

| Element | What it expresses | Where it belongs | Never in |
|---|---|---|---|
| `NowCard` (`block` / `task` / `mini`) | "This is the one thing right now" — `now-bg` block, 60px ring timer (`--now-bar`), label, title (heading font), time left in DM Mono, next up; lilac rim + `--surface-shadow` | Planner NOW, Focus-mode timer, optional mini chip | lists, cards, settings; never a second one per screen; no warning color when over time |
| `PriorityTab` | "How much this matters" — pastel sticker pill (`--pN` + `-on`) with symbol + word (`!! Must do`, `! Should do`, `~ Could do`, or the active label set) over a `--pN-soft` group wash | todo group headers, priority filters | task text, buttons, anything not a priority |
| `WashiTag` | "This came with you" — butter washi tape (`--washi`), torn edges (clip-path), tilted 2°, text "From yesterday" / "3 days waiting" | todo rows, focus card, "Worth a look" review | finished tasks (hidden); more than one per row; never red, grows in weight (700 at 3+ days), not color |
| `StageTrack` | "Where this idea is" — `Inbox › Develop › Shoot next › Published`; current = primary-filled stamp with a 2px offset shadow, past = solid outline, future = dashed | content board, gallery, review inbox, empty state | todos/planner; never keyed on editable column titles (use stage ids from `content-conveyor.ts`) |
| `SoftCapBadge` | "Nudge, don't nag" — `N/5` chip in DM Mono that tints past the cap | Shoot next header | anything that blocks, modals, red; `aria-label="3 of 5"` |

## UX patterns

How-to with components: `.claude/skills/ux-patterns`.

- **Destructive:** small, recoverable items (a todo, a content card) → act instantly + Undo toast. Big deletes (workspace, folder, column, note) → `ConfirmDialog`: title "Delete '{name}'?", one consequence sentence, "Cancel" + destructive "Delete {noun}". Say "Delete", not "Remove". Never `window.confirm`. Review-inbox "tap again to delete" is an allowed triage exception.
- **Loading:** cache-first — no spinner over a page; skeleton lines only on first load; spinners only inside buttons.
- **Errors:** sync pill is the only global status; `InlineAlert` (warn/info) says what is safe first ("Saved on this device") then the fix. No toasts for autosave.
- **Empty:** `EmptyState` = icon, title, one-line body, one action; teach by doing (Content Conveyor empty state is the model). Copy: "A fresh page. What's one thing for today?"
- **Inline add (`InlineComposer`):** `line` — Enter adds and keeps focus; `block` — ⌘/Ctrl+Enter adds, Esc cancels, explicit buttons.
- **Toggles:** `SegmentedControl` (radio-group semantics) for Now/Set up, Board/Gallery, Todos/Daily note, weekday tabs. Nav pills are navigation, not a segmented control.
- **Menus:** `DropdownMenu`; destructive item last, separated, destructive tone.
- **Navigation:** top pills + sync + theme stay; sidebar only on Todos/Notes.
- **Responsive:** coarse pointer never depends on drag or hover — explicit move dialogs, visible row actions, 44px targets; shared `useMediaQuery` named queries.
- **Priorities:** hue + symbol + word, never color alone; carryover is never red.
- **Needs product judgment (ask the user):** keeping the todo status-change confirm; extending soft caps to todos (e.g. Must do ≤ 3); confetti frequency; any navigation restructure.

## App vs marketing

- App: calm — one lilac action per view, stickers on the edges only.
- There is no marketing site. Auth screens (`AuthGate`, verification, `/auth/reset`) use the same tokens; they may use a 30–39px heading and a `brand-subtle` background, nothing louder.

## Voice

Traits: friendly, not childish · encouraging, not pushy · light, not silly
- We say: "A fresh page. What's one thing for today?", "Nice — that's off your plate.", "Sync hiccup. Everything is saved on this device and will catch up soon.", "From yesterday", "Start this one"
- We never say: overdue, late, failed, you forgot, "Oops!", stacked exclamation marks, "cannot be undone" as a scare line
- Terms: carried task → "From yesterday" / "N days waiting"; remove → "Delete"; free time in the planner → "Free — your call"
- Tone: sentence case everywhere (fix legacy "Remaining Time", "Exit Focus Mode", "Must Do (Non-negotiable)" when touched); errors calm and safe-first; success brief; empty states invite one small step.

## Brand assets

- Wordmark: Baloo Da 2 700, lowercase `dailytodo`, −0.02em (preview option 1; final pick open). Min height 16px; clear space = height of the "d".
- Mark: stacked sticker circle + check (preview `markSvg`). App icon / favicon / OG: not produced yet.

## Do / don't

| Do | Don't |
|---|---|
| One filled lilac button per view | Lilac for decoration, headings or icons |
| Sticker + symbol + word for priorities | Color-only priority or a fourth pastel |
| Washi "3 days waiting" in weight, not color | Red/orange for age or over time |
| `bg-muted`, `text-p1-ink`, `bg-now` utilities | `bg-[var(--paper)]`, hex, `rgb()`, `text-white` |
| Rims and surface steps for dark depth | Pure black, cool slate, heavy shadows, glow except the Now ring |
| Delete the old rule when removing a visual treatment | Layer a new override to cancel it (Styling Removal Rule) |
| Custom CSS in `@layer base` / `components` / `utilities` | Unlayered selectors in `globals.css` (they beat every Tailwind utility) |
| 200ms ease-out, off under reduced motion | Springs, bounce, loops, > 300ms |

## Legacy vs target

This document is the **target**. Areas that don't follow it yet are legacy — never a reference for new work.

- Target-ready: none yet. Once the foundation (tokens + fonts + aliases) lands, colors and fonts change app-wide, but layouts and component code stay legacy.
- Near target: `/planner` (NOW + Set up; Tailwind, AlertDialog/Tooltip) — needs `NowCard`, `SegmentedControl`, semantic utilities.
- Legacy: `/todos` (`todos/todos-view.tsx`, most legacy; validation screen), shell (`workspace/top-navbar.tsx`, `workspace/sidebar.tsx`), `/notes`, `/content-planner` (431 arbitrary values, 36 raw buttons, 12 `matchMedia` calls), auth reset/verification (BEM CSS), `AuthGate`.
- Legacy code patterns: ~600 `bg-[var(--paper|ink|brand|line)]` classes, ~108 raw `<button>`, hand-built dialogs/menus/segmented toggles, `text-xs`/`text-[11px]`, 150ms durations, ~4,000 unlayered lines and ~1,580 dead `.planner-*` lines in `globals.css`, `window.confirm`.
- New UI follows the target; UI touched for a change is brought up to it (only the touched part — including moving its CSS out of unlayered `globals.css`); untouched legacy stays as is; an explicit redesign applies the target fully. Major layout/navigation/hierarchy/workflow changes need the user's approval first (see AGENTS.md).

## Files

- Tokens: `src/app/globals.css` (`:root`, `.dark`, `@theme inline`) · Fonts: `src/app/layout.tsx` · Primitives: `src/components/ui/` · Blocks: `src/components/blocks/` · Signature: `src/components/signature/` · Hooks: `src/hooks/`
- Agent rules: `AGENTS.md` (ui-ux-pro block) · Operational skills: `.claude/skills/{ui-system,ui-components,ux-patterns,ui-custom-elements}`
- Decisions and progress: `.design/scaffold.md` · Research: `.design/brief.md`, `.design/strategy.md`, `.design/research/`, `.design/plan.md` · Token source: `.design/directions/_source/tokens.json` (`B2`)
