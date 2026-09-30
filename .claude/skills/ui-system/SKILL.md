---
name: ui-system
description: Use when styling any UI in DailyTodo — colors, typography, spacing, radius, shadows, dark mode, icons, or animation. Lists the project's real design tokens, theme setup, fonts, and motion primitives, with where they live and how to use them.
---
<!-- ui-ux-pro:skill v1 -->

# DailyTodo UI system

Values and rules come from `.design/DESIGN.md` (B2 "Pocket Stickers — Deep"). This skill says **where things are and how to use them**. Don't copy values here — link to the file.

## Tokens

- File: `src/app/globals.css` — `:root` (light), `.dark` (dark), mapped to utilities in `@theme inline` (Tailwind v4). Token source for regeneration: `.design/directions/_source/tokens.json` (entry `B2`).
- Use semantic classes: `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary text-primary-foreground`, `ring-ring`, `bg-destructive`, `text-success`, `text-info`.
- Project-specific tokens:

| Token / class | Use for | Not for |
|---|---|---|
| `bg-brand-subtle text-brand-subtle-foreground` | soft accent surfaces: selected segment, info alert, empty-state icon, `soft` button | primary actions |
| `bg-p1 text-p1-on` · `bg-p2 text-p2-on` · `bg-p3 text-p3-on` | priority sticker tabs / badges (1 = peach, 2 = butter, 3 = mint) | anything that isn't a priority |
| `bg-p1-soft` … `bg-p3-soft` | priority group wash behind a tab | page backgrounds |
| `text-p1-ink` … `text-p3-ink` | priority-colored text/icons on page or wash | body text |
| `bg-now text-now-foreground text-now-muted stroke-now-bar` | the Now card only (`NowCard`) | other cards |
| `bg-washi text-washi-foreground` | carryover tag only (`WashiTag`) | warnings |
| `shadow-card` | Now card, popovers, toast | ordinary panes (use surface steps + rim) |
| `shadow-[var(--rim)]` | hairline rim on dark panes / pill tracks (transparent in light) | — |
| `bg-chart-1..5` | planner pie / block colors | UI chrome |

- Legacy aliases (`--paper`, `--ink-900`, `--ink-700`, `--line`, `--brand`, `--brand-soft`, `--priority-*`, `--planner-*`) still resolve to the tokens above so old screens follow the theme. **Never use them or `bg-[var(--…)]` in new code** — use the utility.
- Never: hex/rgb/oklch in components, `text-white`/`bg-black`, arbitrary color values, new tokens without adding them to DESIGN.md and `@theme inline`.
- Custom CSS goes in `@layer base|components|utilities`, never unlayered (unlayered rules beat every utility).

## Theme & dark mode

- Dark is the default and primary theme. `themeMode` (`dark`/`light`/`system`) lives in `uiState` and is applied in `src/components/app/use-app-persistence-state.ts`; a pre-hydration script from `src/lib/theme-hint.ts` (injected in `src/app/layout.tsx`) paints the last theme before React loads.
- Rule: use tokens only — no `dark:` color overrides for new UI (the `.dark` token set handles it). Check both themes (toggle the `dark` class on `<html>`).

## Typography

- Fonts in `src/app/layout.tsx` via next/font (Google): Baloo Da 2 (latin + bengali) → `--font-display`; Nunito → `--font-latin-body`; DM Mono → `--font-numeric`. `--font-body` (globals.css) = Nunito, then Baloo Da 2 for Bengali glyphs.
- Classes: `font-sans` (body, default), `font-heading` (titles, group tabs), `font-mono` + `tabular-nums` (times, estimates, counts). `h1–h3` get `font-heading` automatically.
- Scale: `text-[0.8125rem]` (13px, the minimum — meta, tags), `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`. **No `text-xs` / `text-[11px]`.** Bengali note text line-height ≥ 1.7.

## Spacing, radius, depth

- Spacing: Tailwind 4px scale; airy — pane padding `p-6` desktop / `p-4` phone, gaps `gap-2`–`gap-4`.
- Radius (`--radius` 0.875rem): `rounded-sm` checkbox · `rounded-lg` inputs, rows, menus · `rounded-xl` cards · `rounded-2xl` group blocks, panes, toast · `rounded-3xl` Now card · `rounded-full` buttons, chips, pills, segmented controls.
- Depth: dark = surface steps (`background` → `card` → `popover` → `muted`) + rim; `shadow-card` only on floating/signature surfaces.

## Icons

- `lucide-react` only, `size-4` in rows/buttons, `size-5` in nav; decorative icons get `aria-hidden="true"`. No emoji as icons.

## Motion primitives

- File: `src/app/globals.css` (`@layer utilities`, "Motion primitives") · CSS + `tw-animate-css` · level: subtle.

| Primitive | Use for |
|---|---|
| `animate-enter` | composer open, new card/row, empty state |
| `animate-settle` | a task being checked |
| `animate-stamp` | done / stage advance / current stage |
| `press` | scale 0.97 on custom clickable surfaces (`Button` has it built in) |
| `transition` / `transition-colors` | plain state changes — default duration/easing are the tokens (`--duration-ui`, `--ease-ui`) |

- Don't write `duration-150` or custom durations; never > 300ms (the NowCard ring's linear progress is the one exception). Reduced motion is handled inside the primitives; for ad-hoc motion add `motion-reduce:` variants. No springs, bounce, loops or pulses.
