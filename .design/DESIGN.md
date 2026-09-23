# DailyTodo design language

<!-- The single source of truth for how DailyTodo looks, moves, and sounds.
     ui-ux-pro reads this file before any UI work; it overrides the plugin's default tokens and style rules.
     It SUPERSEDES the "Design System: Warm Minimalism" section of the project CLAUDE.md
     (teal #2f6d62, Source Sans 3 only, "no serifs"). Update CLAUDE.md to point here once batch 1 lands.
     Rationale and research live in .design/strategy.md and .design/brief.md. -->

**Direction:** Ember Journal — a warm daily notebook: soft-serif page headings, one ink-dark "Now", a terracotta ember used sparingly.
**Language:** Warm editorial (soft serif headings + clear sans body) + bullet-journal signifiers (`!!` `!` `~`, margin line, serif date as page title).
**Personality:** Caregiver (+ Everyman) · feel: calm, kind, crafted · never: childish, noisy, judgmental
**Sliders:** Serious 3/5 Playful · Classic 3/5 Modern · Calm 1/5 Energetic · Premium 2/5 Accessible · Dense 4/5 Airy
**Theme:** follows the system (`themeMode: "system"`); light (cream paper) and dark (espresso, never slate) are equally finished.

## Principles

1. **One "now"** — the current task / planner block is the only ink-dark (inverse) surface on screen; everything else steps back, because ADHD users need one obvious next thing, not a ranked wall.
2. **Fewer boxes** — space and a single surface instead of stacked bordered cards and colored header bands; max one tinted area per pane, because every extra container is another signal competing for attention.
3. **A page, not a dashboard** — the date is a serif page heading, days turn like pages, carryover reads as continuity ("From yesterday"), because the notebook metaphor makes the tool feel personal and forgiving.
4. **Ember is for action, not alarm** — terracotta marks buttons, focus, the wordmark dot and the margin line; urgency uses its own muted priority colors with text labels, because orange-as-warning everywhere would feel like judgment.
5. **Easy to read, always** — body 15–16px, meta never below 13px, sentence case, short labels; serif only for headings ≥18px, because low reading load beats style.

## Color

Tokens live in `src/app/globals.css` (`:root` = light, `.dark` = dark; `@theme inline` maps them to Tailwind utilities).
Base generated with:

```
node ~/.claude/skills/ui-ux-pro/skills/brand-design/scripts/palette.mjs "oklch(0.62 0.147 42)" --neutral warm --radius 0.75rem --json
```

then hand-tuned (direction C): cream/espresso neutrals (hue 50–85, higher chroma than the script's warm default), primary darkened to `oklch(0.545 0.14 42)` for AA as a button, plus the app tokens below. **Treat the tables below as the source of truth; the command only regenerates the ramp and status colors.** Every text pair below was verified with `color.mjs` (WCAG 2): all required pairs pass AA in light and dark.

### shadcn set (existing names — replace values)

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--background` | `oklch(0.965 0.016 82)` #f9f3e8 | `oklch(0.195 0.016 55)` #1b130e | page (paper) |
| `--foreground` | `oklch(0.22 0.025 50)` #241710 | `oklch(0.93 0.02 82)` #efe7d9 | primary text (ink) |
| `--card` / `--popover` | `oklch(0.99 0.008 85)` #fefbf6 | `oklch(0.23 0.018 55)` / `oklch(0.26 0.018 55)` | raised surfaces, dialogs, menus |
| `--card-foreground` / `--popover-foreground` | = foreground | = foreground | |
| `--primary` | `oklch(0.545 0.14 42)` #b14e24 | `oklch(0.72 0.13 45)` #e7885d | **brand ember** — primary buttons, links, selected, checked checkbox. Was near-black / teal — now brand. |
| `--primary-foreground` | `oklch(0.99 0 0)` | `oklch(0.2 0.04 45)` #250f06 | text on primary (5.1:1 / 7.0:1) |
| `--secondary` / `--muted` / `--accent` | `oklch(0.935 0.018 78)` #f0e8dc | `oklch(0.28 0.02 55)` #312620 | quiet fills: nav-pill track, hover rows, chips, selected day |
| `--secondary-foreground` / `--accent-foreground` | `oklch(0.24 0.025 50)` | `oklch(0.93 0.02 82)` | |
| `--muted-foreground` | `oklch(0.48 0.03 55)` #6b594e | `oklch(0.75 0.03 70)` #bbab9a | meta text (5.4–8.2:1 — fixes the old 3.8:1 fail) |
| `--destructive` | `oklch(0.56 0.22 15)` #d60b49 | `oklch(0.56 0.19 15)` #cb304f | destructive **button fills** only |
| `--border` | `oklch(0.87 0.02 70)` #ddd2c6 | `oklch(0.32 0.02 55)` #3b3029 | dividers, card edges, sidebar rule |
| `--input` | `oklch(0.8 0.022 70)` #c7bcaf | `oklch(0.4 0.022 55)` #51453d | text-field outline (decorative; fields also have a label) |
| `--ring` | `oklch(0.62 0.147 42)` #cd6337 | `oklch(0.72 0.13 45)` #e7885d | focus ring (3.5:1 / 7.1:1 — fixes the old gray 2.2:1 fail) |
| `--chart-1…5` | `0.62 0.14 42` · `0.62 0.106 192` · `0.62 0.13 102` · `0.62 0.15 252` · `0.62 0.15 332` (oklch) | same hues at L 0.72 | charts only |
| `--sidebar` | = background | = background | sidebar sits on paper, separated by a `--border` rule |
| `--sidebar-foreground` / `-primary` / `-primary-foreground` / `-accent` / `-accent-foreground` / `-border` / `-ring` | mirror foreground / primary / primary-foreground / accent / accent-foreground / border / ring | same | |
| `--radius` | `0.75rem` (12px) | | see Shape |

**Add** (new, also map in `@theme inline` as `--color-*`):

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--destructive-foreground` | `oklch(0.99 0 0)` | `oklch(0.99 0 0)` | text on destructive |
| `--success` / `-foreground` | `oklch(0.545 0.15 150)` / white | `oklch(0.52 0.13 150)` / white | "Saved", done states (with icon) |
| `--warning` / `-foreground` | `oklch(0.78 0.16 75)` / `oklch(0.16 0.02 70)` | `oklch(0.8 0.14 75)` / `oklch(0.18 0.02 70)` | soft caps (e.g. `Shoot next 6/5`) |
| `--info` / `-foreground` | `oklch(0.55 0.15 250)` / white | `oklch(0.52 0.13 250)` / white | update available, tips |
| `--brand-subtle` | `oklch(0.94 0.03 55)` #fce6d9 | `oklch(0.3 0.05 45)` #422518 | the one tinted area per pane (focus-timer bar, selected capture, callouts) |
| `--brand-subtle-foreground` | `oklch(0.42 0.12 40)` #81300f | `oklch(0.88 0.06 55)` #f8ceb2 | text on brand-subtle; brand-colored text on paper |
| `--now` | `oklch(0.26 0.03 50)` #302017 | `oklch(0.93 0.02 82)` #efe7d9 | **Now card** surface (inverse ink) |
| `--now-foreground` | `oklch(0.96 0.015 80)` #f7f1e7 | `oklch(0.22 0.025 50)` #241710 | text on Now (13.9:1 / 14.2:1) |
| `--now-accent` | `oklch(0.76 0.12 50)` #ee9a69 | `oklch(0.5 0.14 40)` #a24019 | ember on the Now card (progress bar, "12 min left"); plain `--primary` fails there |
| `--check` | `oklch(0.55 0.03 55)` #806d61 | `oklch(0.58 0.03 60)` #887769 | checkbox + radio borders (≥3.9:1 — use this, not `--input`) |
| `--brand-50…950` | ramp from palette.mjs (`@theme`) | | marketing, illustration, the icon |

### Custom app set (existing names — keep names, replace values)

| Token | Light | Dark | Now means |
|---|---|---|---|
| `--paper` | = `--background` #f9f3e8 | #1b130e | page |
| `--paper-strong` | = `--card` #fefbf6 | `oklch(0.23 0.018 55)` #241b15 | raised surface (note: was *darker* than paper in light; now lighter) |
| `--line` | = `--border` #ddd2c6 | #3b3029 | all borders |
| `--ink-900` | = `--foreground` #241710 | #efe7d9 | primary text |
| `--ink-700` | = `--muted-foreground` #6b594e | #bbab9a | secondary text (dark was cool #8c95a6) |
| `--brand` | = `--primary` #b14e24 | #e7885d | accent (was teal) |
| `--brand-soft` | = `--brand-subtle` #fce6d9 | #422518 | accent tint |
| `--warn` | `oklch(0.56 0.22 15)` #d60b49 | `oklch(0.7 0.15 22)` #ed7473 | destructive **text** (dark lifted: 6.4:1; `--destructive` is only 3.6:1 as dark text) |
| `--priority-1` / `-soft` (Critical `!!`, clay) | `oklch(0.53 0.15 38)` #b14420 / `oklch(0.94 0.03 45)` #fee5db | `oklch(0.72 0.13 40)` #e98664 / `oklch(0.28 0.04 40)` #3a221a | text 5.1:1 on paper, 4.7:1 on soft |
| `--priority-2` / `-soft` (Important `!`, honey) | `oklch(0.6 0.11 72)` #a8742a / `oklch(0.95 0.035 82)` #faedd5 | `oklch(0.79 0.11 78)` #e1b265 / `oklch(0.285 0.035 75)` #342816 | **light: icons/dots/large labels only (3.6:1)**; label text uses `--ink-900` beside the dot |
| `--priority-3` / `-soft` (Someday `~`, sage) | `oklch(0.51 0.07 140)` #507049 / `oklch(0.945 0.025 140)` #e4f1e1 | `oklch(0.74 0.07 140)` #94b68c / `oklch(0.27 0.025 140)` #202a1e | text 5.0:1 / 4.8:1 |
| `--planner-teal` | `oklch(0.55 0.08 185)` #2e8178 | `oklch(0.72 0.08 185)` #66b5ab | planner block colors (graphics, ≥3:1 on paper) |
| `--planner-gold` | `oklch(0.62 0.11 72)` #af7a31 | `oklch(0.79 0.11 78)` #e1b265 | |
| `--planner-rose` | `oklch(0.58 0.12 25)` #b75b55 | `oklch(0.72 0.11 28)` #e1897e | |
| `--planner-sage` | `oklch(0.56 0.07 140)` #5e7f57 | `oklch(0.74 0.07 140)` #94b68c | |
| `--planner-lavender` | `oklch(0.56 0.09 295)` #7869a4 | `oklch(0.74 0.08 295)` #aea1d9 | |
| `--planner-track` | `oklch(0.91 0.02 78)` #e9e0d3 | `oklch(0.3 0.02 55)` #362b24 | clock/progress track |
| `--surface-shadow` | `0 1px 2px oklch(0.3 0.04 50 / 0.07)` | `0 1px 2px oklch(0.08 0.02 50 / 0.45)` | the only card shadow |

Rules:
- Where a custom token equals a shadcn token, define it as `var(--…)` (e.g. `--paper: var(--background)`) so there is one value per role. Long term, new code uses the shadcn names.
- **One filled ember button per view.** Everything else is ghost/outline/quiet.
- Brand-colored *text* on paper uses `--primary` (≥4.75:1) or `--brand-subtle-foreground`; never `--ring` or ramp-400/500 for text.
- Priority is never color alone: signifier (`!!` `!` `~`) + word (Critical / Important / Someday) + color.
- Nothing is red for "late". Carried-over age is muted text ("From yesterday", "3 days waiting").
- Delete the cool body gradients (`.dark body` radial-gradient) and the ~43 hardcoded hex colors in `globals.css`; use tokens.
- Dark is espresso (hue 45–82). No slate/blue-gray (hue 240–260) anywhere.

## Typography

| Role | Font | Weights | Notes |
|---|---|---|---|
| Heading / display | **Fraunces** (variable, axes `SOFT` = 100, `opsz` auto) | 500–600 (default 560) | tracking −0.02em; sentence case; roman for headings, *italic* only for the wordmark alt and small editorial accents (e.g. "Free — your call") |
| Heading, Bengali | **Noto Serif Bengali** | 500–600 | fallback in the heading stack |
| Body / UI | **Instrument Sans** | 400, 500, 600 | all task text, buttons, inputs, nav, editor body |
| Body, Bengali | **Hind Siliguri** | 400, 600 | fallback in the body stack (covers the Bengali capture placeholder and notes) |
| Mono | **JetBrains Mono** | 400, 500 | code blocks, timer digits; counts use body with `tabular-nums` instead |

Stacks:
- `--font-heading: "Fraunces", "Noto Serif Bengali", Georgia, serif`
- `--font-body: "Instrument Sans", "Hind Siliguri", ui-sans-serif, system-ui, sans-serif`
- `--font-mono: "JetBrains Mono", ui-monospace, monospace`

- **App scale** (px): 13 meta · 14 UI small / nav · 15 task text & body · 16 editor body · 18 section heading (serif) · 20 card / Now title (serif) · 26 page date (serif) · 32 planner Now time. Line-height 1.55 body, 1.15–1.25 headings.
- **Marketing scale** (ratio 1.25, base 16): 16 · 20 · 25 · 31 · 39 · 49 · 61.
- **Font setup:** `src/app/layout.tsx` via `next/font/google`: `Fraunces({ subsets:["latin"], axes:["SOFT","opsz"], variable:"--font-heading" })`, `Instrument_Sans({ subsets:["latin"], variable:"--font-body" })`, `Noto_Serif_Bengali` + `Hind_Siliguri({ subsets:["bengali"], weight:["400","600"] })`, `JetBrains_Mono`. Map `--font-sans: var(--font-body)`, add `--font-serif: var(--font-heading)` in `@theme inline`.
- Rules: serif only ≥18px and only for headings, dates, the Now title, empty-state lines and the wordmark — never for task text, buttons, inputs or meta. No text below 13px (removes the current 10–12px sizes). Sentence case everywhere ("Enter focus mode", not "Enter Focus Mode"). Numbers that change (timers, counts) use `tabular-nums`.

## Shape, depth & layout

- **Radius:** base `--radius: 0.75rem` (12px). Buttons, inputs, nav pills, menu items `rounded-lg` (12px); cards, panes, dialogs, Now card `rounded-xl`/`rounded-2xl` (16–20px); chips, badges, pill-track `rounded-full`. Collapse the current 15+ ad-hoc radii to these three.
- **Borders:** 1px `--border`. Use a border *or* a fill to separate — not both. Priority groups are separated by space + a small colored signifier, not bordered/tinted card stacks or colored header bands.
- **Depth:** mostly flat. `--surface-shadow` on popovers, dialogs and dragged cards only; the Now card uses the inverse fill, not a shadow. No glows or gradients in the app.
- **Margin line (signature):** a 2px `--primary` vertical rule at 40% opacity on the left of the daily note page (and on the day's heading block on mobile), like a notebook margin.
- **Density:** comfortable. 8px grid; list rows 40–44px (touch ≥44px on coarse pointers); section gap 24px; pane padding 20–32px desktop, 16px mobile. Note text max ~68ch.

## Motion

- 160–220ms, easing `cubic-bezier(0.33, 1, 0.68, 1)` (ease-out), calm. Never bounce/spring, never >300ms.
- Signature: day change is a 200ms cross-fade (page turn, no slide). Checking a task: box fills ember, text fades to `--muted-foreground` with a strike, row stays put. Now progress bar shrinks linearly.
- `prefers-reduced-motion`: fades only, no movement.

## Iconography & imagery

- Icons: **lucide-react only** (drop `@tabler/icons-react` in the final sweep), stroke 1.75, 16px in rows / 18px in toolbars, `currentColor`, outline.
- Signifiers as type, not icons: `!!` `!` `~` for priority; `•` for task bullets in the note.
- Illustration: none in the app beyond the mark. Empty states are one serif line + one sans hint.
- Photography: none.

## Components (brand-specific treatments)

- **Button:** `rounded-lg`, 36px (40px on touch), weight 600, sentence case, verb-first. Variants: primary (ember fill), secondary (`--muted` fill), ghost, outline, destructive. Press = `scale(0.98)`, 120ms. No shadow.
- **Card:** `--card` fill + 1px `--border`, `rounded-2xl`, no shadow at rest. Use sparingly (content-planner cards, dialogs); todo groups are not cards.
- **Input:** `--card` fill, 1px `--input`, `rounded-lg`, 40px; focus = 2px `--ring` outline, 2px offset. Inline "Add a line" inputs are borderless until focus.
- **Checkbox:** 18px, `rounded-[6px]`, 1.5px `--check` border; checked = `--primary` fill + white check.
- **Navigation:** top nav pills on a `--muted` track; active pill = `--card` + `--surface-shadow`, weight 600. Sidebar on paper with a right `--border` rule; selected day = `--accent` fill, weight 600.
- **Badges / status:** `rounded-full`, 13px, weight 600, `--muted` fill; age badges are muted text, never red. Sync: "Saved" with a quiet check; offline copy is reassuring.
- **Dialog / AlertDialog:** `--popover`, `rounded-2xl`, `--surface-shadow`; destructive confirms keep the item name in quotes.
- **Signature element — the Now card:** inverse `--now` surface, serif title (20px), sans meta, `--now-accent` progress bar + "N min left". Appears on `/planner` (current block) and on `/todos` as the focus-timer / current task. Only one per screen.
- **Signature element — the page heading:** eyebrow ("Thursday") in 13px sans muted + serif date ("24 September") at 26px, with the margin line.

## App vs marketing

- **App:** stays calm — one ember button, one Now card, one tinted area per pane, serif only for headings.
- **Marketing** (future landing page / store listing / OG): may use the inverse ink hero, large Fraunces display (49–61px), full ember sections, and the product screenshot as the image. Same voice.

## Voice

Traits: thoughtful, not wordy · grounded, not stern · warm, not sugary
- We say: "A fresh page — with yesterday's loose ends already on it." · "Blank page. Write one small thing." · "From yesterday · 2 days waiting" · "Crossed off. 3 today." · "Couldn't sync this page. It's saved here and will sync when you're back online." · "Tear out "Outline next week's video"? This can't be undone." · "Open today · Start focus · Add a line"
- We never say: overdue, late, failed (to the user), you forgot, productivity jargon (optimize, crush, grind), exclamation marks in errors, backend names (PocketBase, sync engine), "Oops", "Are you sure?" without naming the thing.
- Terms: todo/task → **task** (UI) · daily page → **today's page** · delete a task → **Tear out** (confirm) / **Delete** (buttons stay plain) · carryover → **From yesterday / N days waiting** · focus timer → **Focus** · Content Conveyor stages keep **Inbox / Develop / Shoot next / Published** · Critical / Important / Someday (with `!!` `!` `~`).
- Tone: errors plain and calm, say what's safe and what to do; success brief; empty states one kind line + one small action; marketing a little warmer, still no hype.
- Auth copy (current developer copy like "wired to PocketBase email") is replaced with human copy: "Welcome back", "We'll email you a link to reset it."

## Brand assets

- **Wordmark:** "DailyTodo" in Fraunces SOFT 100, weight 600, tracking −0.025em, with an ember dot (`--primary`) after the final "o" (or replacing the i-dot — pick in batch 3). Alt: *dailytodo* italic lowercase 500 (editorial use). Small sizes (<14px): Instrument Sans 600 uppercase +0.16em. Min height 16px; clear space = cap height.
- **Mark:** a bookmark-shaped notebook ribbon with an ember dot (from `.design/directions/C-ember-journal.html` `markSvg`), solid `--primary` with a `--primary-foreground` dot. Replaces the `.app-logo` teal square.
- **Favicon / app icon:** mark on cream (`#f9f3e8`) squircle for light, on espresso (`#1b130e`) for the Tauri dark variant if supported; must read at 16px. Files: `src/app/icon.svg` + `src/app/favicon.ico`, `src/app/apple-icon.png`, `src-tauri/icons/app-icon.svg` → regenerate `src-tauri/icons/*` with `pnpm tauri icon`.
- **OG image:** `src/app/opengraph-image.png` (1200×630): inverse ink, serif headline "Pick up exactly where you left off.", wordmark.

## Do / don't

| Do | Don't |
|---|---|
| One Now card, one ember button per view | Tint every group and border every card |
| Serif for page date and headings ≥18px | Serif for tasks, buttons, inputs, meta |
| `!!` / `!` / `~` + label + muted earth color | Traffic-light red/amber/green bands |
| "From yesterday", "3 days waiting" | "Overdue", red badges, streak guilt |
| Espresso dark, cream light, follow system | Slate/blue-gray dark, pure white or pure black |
| Tokens (`var(--…)`) in `@layer components` | Hardcoded hex, unlayered CSS in `globals.css` |
| 13px minimum text, sentence case | 10–12px labels, Title Case Buttons |
| 160–220ms ease-out fades | Bounce, spring, slide-heavy motion |

## Project rules that still apply

- **Tailwind v4 layers (critical):** all custom CSS in `src/app/globals.css` goes inside `@layer base` or `@layer components`. Token definitions (`:root`, `.dark`) and `@theme` stay at top level. Much of the current component CSS is unlayered — move it into `@layer components` as each batch touches it.
- Styling removal rule: delete/simplify the original rule rather than adding an override.
- Destructive actions use `AlertDialog`; icon buttons have `aria-label` + `Tooltip`; every interactive element has a hover state; focus = `outline: 2px solid var(--ring); outline-offset: 2px`.
- WCAG AA (4.5:1 text, 3:1 large text/UI); never color alone; respect reduced motion; keep A-/A+ scaling working (sizes in rem where the existing scale uses it).
- Device-local UI prefs (theme, font scale) stay local.

## Files

- Tokens: `src/app/globals.css` · Fonts: `src/app/layout.tsx` · Default theme: `src/lib/store.ts` (`themeMode: "dark"` → `"system"`) and remove the hardcoded `className="dark"` / `colorScheme: "dark"` on `<html>` in `layout.tsx`
- Components: `src/components/ui/*` · Brand assets: `src/app/icon.svg`, `src/app/favicon.ico`, `src-tauri/icons/`, sidebar/top-nav logo in `src/components/workspace/top-navbar.tsx` + `.app-logo` in `globals.css`
- Direction source: `.design/directions/C-ember-journal.html` · Decisions and progress: `.design/rollout.md` · Research: `.design/brief.md`, `.design/strategy.md`
