---
name: design-system
description: Apply the DailyTodoApp Warm Minimalism design system when changing UI, styling, component visuals, layout, typography, color, spacing, motion, or accessibility. Use this skill before making any visual or interaction decision so new work stays consistent with the product's warm notebook-like interface.
---

# Design System

Use this skill for any DailyTodoApp work that changes the interface or interaction design.

This skill translates the canonical rules in `CLAUDE.md` into a compact working checklist for implementation. If this file and `CLAUDE.md` ever disagree, follow `CLAUDE.md`.

## When To Use

Use this skill when you are:

- building or restyling pages, components, dialogs, forms, nav, cards, or lists
- choosing colors, spacing, typography, borders, shadows, or motion
- adding shadcn/ui components or adjusting existing component chrome
- reviewing UI work for consistency with the app's established visual language

Do not use this skill for purely non-visual backend, data, or infrastructure work.

## Working Rules

Before editing UI:

1. Read the relevant UI sections in `CLAUDE.md`.
2. Preserve the existing Warm Minimalism direction instead of inventing a new style.
3. Prefer reusing existing tokens and patterns over introducing new visual treatments.
4. When asked to remove visual styling, simplify or delete the original rule instead of layering an override when possible.

## Visual Direction

The app should feel like a physical desk notebook translated into software:

- warm, calm, and minimal
- flat and honest rather than flashy or decorative
- spacious and breathable rather than dense
- sans-serif throughout, with hierarchy coming from size and weight

Avoid anything that feels like a generic dashboard.

## Non-Negotiables

- Use CSS custom properties for colors. Do not hardcode hex colors in JSX or Tailwind utilities.
- Use the `font-body` sans-serif stack everywhere in the product UI. No serif fonts.
- Use `rounded-2xl` for panes/cards, `rounded-lg` or about `10px` for controls, and `rounded-full` for pills/badges.
- Use warm-tinted shadows only. Do not use default Tailwind shadow presets unless they are mapped to the warm shadow tokens.
- Every interactive element needs a clear hover state.
- Icon-only buttons need both `aria-label` and `Tooltip`.
- Destructive actions need `AlertDialog` confirmation.
- Tiptap stays content-first with no visible toolbar.
- Primary navigation belongs in the top navbar, not the sidebar.

## Core Tokens

Use these semantic tokens rather than raw colors:

```css
/* light mode */
--paper: #faf8f4;
--paper-strong: #ffffff;
--line: #d9d1c5;
--ink-900: #1f2430;
--ink-700: #40495e;
--brand: #2f6d62;
--brand-soft: #d9ece8;
--warn: #b8422e;

/* dark mode */
--paper: #16191f;
--paper-strong: #1e2228;
--line: #2d3340;
--ink-900: #e8e2d9;
--ink-700: #8c95a6;
--brand: #3d8c7f;
--brand-soft: #1e3533;
--warn: #d45a44;

/* priority colors */
--priority-1: #c0392b;
--priority-1-soft: #f9e8e6;
--priority-2: #c07c30;
--priority-2-soft: #fdf3e3;
--priority-3: #4a7c59;
--priority-3-soft: #e8f4ec;
```

Typical Tailwind usage:

- `bg-[var(--paper)]`
- `bg-[var(--paper-strong)]`
- `text-[var(--ink-900)]`
- `text-[var(--ink-700)]`
- `border-[var(--line)]`

## Typography

Use one font family across the interface:

```text
font-body: "Source Sans 3", Inter, DM Sans, system-ui, sans-serif
font-mono: JetBrains Mono, Fira Code, ui-monospace
```

Hierarchy should stay simple:

- note title: `text-2xl font-semibold`
- date header: `text-lg font-semibold`
- section label: `text-sm font-semibold`
- body and todo text: `text-sm font-normal`

## Layout And Spacing

Preferred spacing rhythm:

- section padding: `p-4`
- card padding: `p-3` to `p-4`
- list gaps: `gap-2`
- section gaps: `gap-4`
- priority-group gaps: `gap-3`

Rule of thumb: if the layout feels cramped, increase space before adding decoration.

## Component Patterns

### Navbar

- height around `52px`
- nav pills show active state with filled background and subtle warm shadow
- theme toggle stays in the top-right

### Sidebar

- clean tree/list presentation with clear hover states
- "Today" uses `--brand-soft` background and `--brand` text
- active note/date states should be obvious but soft

### Priority Groups

- use a left-border accent in the group color
- use `--priority-N-soft` for the group header tint
- show the count badge as a pill when items exist

### Inline Task Input

- keep it at the bottom of each priority group
- use the group's accent color for the add affordance
- keep the input visually light and content-first

### Editor

- no visible toolbar
- use the `.tiptap-editor` styling hooks already in the app
- placeholder text should be subtle and quiet

## Motion

- hover/focus: about `150ms`
- reveals: about `200ms`
- never exceed `300ms` without a strong reason
- use calm easing such as `ease` or `ease-in-out`
- respect `prefers-reduced-motion`

Do not use bouncy or playful motion.

## Accessibility

- maintain WCAG AA contrast
- use a visible focus ring such as `2px solid var(--brand)` with offset
- never rely on color alone for priority or status
- pair icon-only affordances with accessible labels

## Anti-Patterns

Avoid these unless the user explicitly requests a deliberate departure:

- cool grays or pure white replacing the warm paper palette
- bright saturated accent colors
- glassmorphism or heavy chrome
- gradients on components
- true black dark mode
- serif typography
- bounce or spring-heavy animation
- visible editor toolbars

## Implementation Notes

- Generate new shadcn/ui primitives before use: `npx shadcn@latest add <component>`
- Keep new UI aligned with existing `src/components/ui/` usage
- If you need a new token or pattern, add it only when the current system truly cannot express the requirement
