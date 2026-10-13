# UI & design system (pointers)
Last verified: 2026-10-14

The UI rules are not duplicated here. Source of truth: `.design/DESIGN.md` (B2 "Pocket Stickers — Deep";
opens with a Quick card), applied via the short UI brain block in `AGENTS.md` (markers `ui-brain:start v2` /
`ui-brain:end`) and the skills in `.claude/skills/`:
- `ui-system` — tokens, type, dark mode, motion, Base UI + semantic-utility rules.
- `ui-components` / `ui-custom-elements` — the **UI inventory** (what exists). Check there; the KB doesn't copy it.
- `ux-patterns` — states, a11y, Clarity, plus legacy-vs-target, ask-before-major-changes, needs-product-judgment, "done means".

## How it works
- Tokens: `src/app/globals.css` (`:root`, `.dark`, `@theme inline`); fonts: `src/app/layout.tsx`; no-flash theme script: `src/lib/theme-hint.ts`.
- shadcn (Base UI) primitives in `src/components/ui/` — add with `npx shadcn@latest add <component>`. Small text in primitives is `text-[0.8125rem]` (13px), not `text-xs`.
- UI brain setup state: `.design/setup.md`. After a screen changes, run the `.claude/agents/ui-qa.md` agent (uses `?devWorkspace=1`, never plain `pnpm dev`).
- Confirms use `ConfirmDialog` (`src/components/blocks/confirm-dialog.tsx`): `variant` `"destructive"` (default) or `"default"`; `onConfirm(event)` gets the click event (todo status confirm uses it as the confetti origin). All raw AlertDialog confirms were migrated except `src/components/workspace/desktop-update-provider.tsx` (rich update dialog, kept on purpose).
- Sync pill (`src/components/workspace/top-navbar.tsx`): offline/issue = amber `bg-warning` dot + `text-foreground` label.
- User-facing copy never says "PocketBase" (sync notices in `top-navbar.tsx`, `src/lib/split-persistence-repository.ts`, `src/lib/pocketbase/persistence-repository.ts`). Legacy leftover: `src/components/auth/auth-gate.tsx` still does.

## Gotchas
- **Tailwind v4 layers:** never write unlayered CSS in `globals.css` — it beats every utility and breaks spacing app-wide. Use `@layer base` / `@layer components`.
- When removing a visual treatment, delete the original rule; don't layer an override.
- Amber (`text-warning`) text fails contrast in light mode — use amber only for dots/fills, keep text `text-foreground`.
- ui-brain's `.brain/`, `brain` agent and Stop hook are deliberately not installed (see [decisions.md](decisions.md)); `check-brain.mjs` reporting them missing is expected.

## Related
- [testing.md](testing.md) — browser checks. [decisions.md](decisions.md).
