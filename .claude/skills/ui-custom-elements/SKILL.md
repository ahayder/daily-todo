---
name: ui-custom-elements
description: Use when a DailyTodo screen needs something more distinctive than stock components, or when creating any new visual element (card style, badge, marker, illustration, pattern, signature motion). Lists the product's own custom design elements — Now card, priority sticker tabs, washi carryover tags, content stage track, soft-cap badge — where they belong, and the rules for adding new ones.
---
<!-- ui-ux-pro:skill v1 -->

# DailyTodo custom design elements

These make DailyTodo look like a friendly night notebook, not a generic kit. They are reusable and rule-bound, not one-off decoration. Visual rules: `.design/DESIGN.md` → Custom design elements.

## Elements

| Element | Import / file | Appears in | Rules |
|---|---|---|---|
| `NowCard` (`block` / `task` / `mini`) | `@/components/signature/now-card` | Planner NOW (`block`), Focus-mode timer (`task`), compact spots (`mini`) | max one per screen; the ring is the only glow; times in `font-mono`; over time / off-plan never turns warning-colored; pass `remainingDescription` for screen readers |
| `PriorityTab` + `PRIORITY_GROUP_SURFACE` | `@/components/signature/priority-tab` | todo group headers, priority filters | fixed hues (1 peach, 2 butter, 3 mint) for every label set; always the word from the active label set; task text stays plain |
| `WashiTag` | `@/components/signature/washi-tag` | todo rows, focus card, "Worth a look" | pass `getTaskAgeDays(todo, date)`; renders nothing under 1 day; one per row; hide on finished tasks; weight grows, never color |
| `StageTrack` | `@/components/signature/stage-track` | content board / gallery / review inbox / empty state | `current` from `getStageForColumn(columnId)` — never from editable column titles |
| `SoftCapBadge` | `@/components/signature/stage-track` | Shoot next header (`count`/`5`) | tints past the cap, never blocks, never red |
| `.washi-tape` | `src/app/globals.css` (`@layer components`) | torn-tape edge used by `WashiTag` | only for carryover |

### Example

```tsx
import { NowCard } from "@/components/signature/now-card";

<NowCard
  title={block.title}
  meta={`${formatMinutes(block.startMinutes)}–${formatMinutes(block.endMinutes)}`}
  progress={progress}
  remainingLabel={`${minutesLeft}m`}
  remainingDescription={`${minutesLeft} minutes left`}
  next={next ? `Next: ${next.title}` : undefined}
/>
```

## Where custom elements belong

- Yes: the "what now" moments (planner, focus), priority grouping, carryover, content workflow, empty states.
- No: settings, auth forms, dialogs, menus, dense lists beyond the one tag per row, error states.

## Adding a new custom element

Create one when an existing component/block doesn't express what the screen needs and the element will likely be used again.

1. Check DESIGN.md (principles: one obvious next action, stickers stay on the edges, kind never judgy) — the element must fit them.
2. Build it from tokens only; include all states and reduced motion.
3. Put it in `src/components/signature/` with a clear name.
4. Add a row above (import, where it appears, rules) in the same change.
5. If it changes the product's look noticeably (new motif, new color use, a fourth pastel), it's a major change — ask first (see AGENTS.md).
