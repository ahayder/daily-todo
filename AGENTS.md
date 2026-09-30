# Agent Delegation Policy

This repository uses [`CLAUDE.md`](./CLAUDE.md) as the authoritative, single source of truth for:
- project conventions
- architecture and implementation guidance
- workflow and prioritization instructions

## Precedence

If any instruction in `AGENTS.md` conflicts with `CLAUDE.md`, follow `CLAUDE.md` — except UI/UX: the **UI/UX system** block below and `.design/DESIGN.md` are canonical for look, feel and UX patterns.

## Required Agent Workflow

Before planning or implementation, agents must read `CLAUDE.md` first and apply it as canonical guidance.

## Maintenance Rule

Keep this file short and delegating only. Update `AGENTS.md` only when delegation metadata changes, such as:
- canonical file path or name
- ownership/location of the canonical instructions
- pointer paths for locally referenced skill docs

Do not update `AGENTS.md` for normal project-guidance/content changes; those belong in `CLAUDE.md`.

## Local Skill Reference

Skill documentation is discoverable from the canonical source and local paths:
- `./.agents/skills/` (state, desktop, editor, testing)
- `./.claude/skills/` (UI/UX: `ui-system`, `ui-components`, `ux-patterns`, `ui-custom-elements`)

<!-- ui-ux-pro:brain:start v1 -->
## UI/UX system

This project has an established UI/UX system. Follow it for every change that touches UI.

- **Source of truth:** `.design/DESIGN.md` (look, feel, UX rules, custom elements). If anything here or in a skill disagrees with it, DESIGN.md wins — then fix the other file.
- **Code:** tokens `src/app/globals.css` (`:root`, `.dark`, `@theme inline`) · fonts `src/app/layout.tsx` · components `src/components/ui/` · blocks `src/components/blocks/` · signature elements `src/components/signature/` · motion utilities in `globals.css` (`@layer utilities`) · hooks `src/hooks/`

### Skills (read the one that matches your task)

| Skill | Use when |
|---|---|
| `.claude/skills/ui-system/SKILL.md` | styling anything: colors, type, spacing, radius, dark mode, motion |
| `.claude/skills/ui-components/SKILL.md` | building any screen or section — check what already exists first |
| `.claude/skills/ux-patterns/SKILL.md` | forms, loading, errors, empty states, destructive actions, navigation, a11y |
| `.claude/skills/ui-custom-elements/SKILL.md` | using or creating product-specific design elements |

### Build order

1. Existing component → 2. existing block → 3. compose from primitives + tokens → 4. new custom element (then add it to `ui-custom-elements`). New UI is fine when nothing fits; don't force a poor match. Never hardcode colors, fonts, or spacing.

### Project rules

- Primitives are **Base UI**, not Radix: compose with `render={<Button …/>}`; `asChild` exists only on `PopoverTrigger` / `TooltipTrigger`.
- Semantic utilities only (`bg-card`, `text-muted-foreground`, `bg-p1-soft`) — never `bg-[var(--…)]`, legacy `--paper`, `--ink-*`, `--brand` vars, hex or `text-white`.
- Icon-only buttons use `IconButton`. Text ≥ 13px (no `text-xs`); Bengali must read well (note text line-height ≥ 1.7).
- Dark is the primary theme; check dark and light, 375px and desktop.
- Todos/Notes keep the sidebar; Planner and Content Planner are full-width.

### Legacy vs target

- DESIGN.md is the target. Screens that don't follow it are legacy — never use them as a reference.
- New UI follows the target fully.
- When you change an existing area, bring the part you touch up to the target. Don't expand into untouched areas.
  - "The part you touch" = elements whose markup or styling you change. A behavior-only change (e.g. a new `onClick`) doesn't require restyling the element or its siblings; if you do restyle one control in a row of legacy controls, restyle the whole row so it stays consistent.
- Leave untouched legacy areas alone.
- If asked to **redesign**, apply the target fully; don't preserve the legacy look.

### Ask before major UI/UX changes

Before any of these, stop and explain in 2–4 lines (current approach → proposed approach under the design system → why), then wait for approval:
layout restructure · navigation change · information-hierarchy change · workflow change · substantial visual-direction change.

Don't ask for routine compliance: correct components/tokens/spacing, accessibility, responsive fixes, missing loading/empty/error states, small consistency fixes.

### Needs product judgment (ask)

Keeping or dropping the todo status-change confirmation · extending soft caps (e.g. Must do ≤ 3) beyond Shoot next · confetti frequency · any delete that can't be undone and isn't a workspace/folder/note/column · changes to carryover or Content Conveyor behavior.

### Done means

Uses tokens and existing components · all states handled (loading, empty, error, success, disabled) · keyboard + screen-reader friendly · checked at mobile and desktop width, light and dark.
How to check: `http://localhost:5005/<route>?devWorkspace=1` (local workspace, no login; if a dev server already runs on 5005, use it). Test at 375px and ≥1280px; for light mode remove the `dark` class on `<html>` (or switch theme in the profile menu). Report which of these you checked.
<!-- ui-ux-pro:brain:end -->
