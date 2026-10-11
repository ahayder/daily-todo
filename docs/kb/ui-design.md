# UI & design system (pointers)
Last verified: 2026-10-11

The UI rules are not duplicated here. Source of truth: `.design/DESIGN.md` (B2 "Pocket Stickers — Deep"),
applied via the UI/UX block in `AGENTS.md` and the skills `ui-system`, `ui-components`, `ux-patterns`,
`ui-custom-elements` in `.claude/skills/`.

## How it works
- Tokens: `src/app/globals.css` (`:root`, `.dark`, `@theme inline`); fonts: `src/app/layout.tsx`; no-flash theme script: `src/lib/theme-hint.ts`.
- shadcn (Base UI) primitives in `src/components/ui/` — add with `npx shadcn@latest add <component>`.

## Gotchas
- **Tailwind v4 layers:** never write unlayered CSS in `globals.css` — it beats every utility and breaks spacing app-wide. Use `@layer base` / `@layer components`.
- When removing a visual treatment, delete the original rule; don't layer an override.
