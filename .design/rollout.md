---
phase: rollout
step: 2
total: 9
next: "Batch 2 — Core components (src/components/ui/*)"
waiting_for: ""
updated: 2026-09-24
---

<!--
  ui-ux-pro makeover progress. This file is the workflow's memory: the SessionStart hook reads
  the frontmatter above every session, and /ui-ux-pro:makeover continue resumes from it.
  Keep the frontmatter keys exactly as they are:
    phase:       discover | interview | strategy | directions | design-language | rollout | done
    step/total:  current rollout batch and number of batches (0 before rollout)
    next:        the very next concrete action, in a few words
    waiting_for: what the user needs to do, if anything ("pick a direction", "approve batch 2"), else ""
    updated:     date of the last change
-->

# Makeover — DailyTodo

Branch: dev (user choice — sole user, no separate makeover branch)
Scope: visual language, voice & copy, logo/wordmark/app icon, anything that helps ADHD users
Boldness: evolution
Keep: nothing fixed — goal: more premium, appealing visual (Tiimo soft/friendly); theme follows system

## Phases

- [x] 1. Discover — `.design/brief.md` (+ before screenshots in `.design/screenshots/before/`)
- [x] 2. Interview — answers added to `.design/brief.md`
- [x] 3. Strategy — `.design/strategy.md`
- [x] 4. Directions — `.design/directions/index.html` (A, B, C)
- [x] 5. Design language — `.design/DESIGN.md` (chosen: C · Ember Journal, no mixes) — awaiting user approval
- [ ] 6. Rollout — batches below

## Rollout batches

Each batch: implement → design review (incl. brand fit) → show the user → user OK → commit → tick here.
No marketing/landing batch: the app has no public site yet (add one later using the "Marketing" rules in DESIGN.md).

- [x] 1. Foundation — replace token values in `src/app/globals.css` (`:root`, `.dark`, `@theme inline`: shadcn set with `--primary`/`--ring`/`--sidebar-primary` → ember, custom `--paper`/`--ink-*`/`--line`/`--brand`/`--warn`/priority/planner/`--surface-shadow`, add `--now*`, `--check`, `--brand-subtle*`, status tokens, `--font-heading`/`--font-serif`); delete cool `.dark body` gradients; `--radius` 0.75rem. Fonts in `src/app/layout.tsx` (Fraunces SOFT, Instrument Sans, Noto Serif Bengali, Hind Siliguri, JetBrains Mono); remove hardcoded `className="dark"`/`colorScheme` so theme follows system; `src/lib/store.ts` default `themeMode: "system"` (check `src/lib/schema.ts`, `persistence.ts`, `use-app-persistence-state.ts`, related tests). Update CLAUDE.md "Design System" section to point to `.design/DESIGN.md`.
- [ ] 2. Core components — `src/components/ui/button.tsx`, `input.tsx`, `checkbox.tsx` (`--check` border, ember checked), `badge.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `popover.tsx`, `select.tsx`, `tooltip.tsx`, `scroll-area.tsx`: radii (12/16–20/full), sentence case, press effect, focus ring, 13px minimum; shared editor chrome styles (`.editor-toolbar`, `.bubble-menu`) moved into `@layer components`.
- [ ] 3. Brand assets — mark + wordmark SVG components (replace `.app-logo` square in `src/components/workspace/top-navbar.tsx` and auth screens), `src/app/icon.svg` + `favicon.ico` + `apple-icon.png`, `src-tauri/icons/app-icon.svg` → `pnpm tauri icon` to regenerate `src-tauri/icons/*`, `src/app/opengraph-image.png`, `layout.tsx` metadata description; delete Next starter SVGs in `public/`.
- [ ] 4. Auth + onboarding — `src/components/auth/auth-gate.tsx`, `password-reset-screen.tsx`, `verification-pending-screen.tsx`, `src/app/auth/reset/page.tsx`: warm welcome layout with wordmark, human copy (remove "PocketBase" developer copy), sentence case.
- [ ] 5. Todos (core flow) — `src/app/todos/page.tsx`, `src/components/todos/todos-view.tsx` (+ focus timer): serif page date + margin line, priority groups without bordered/tinted card stacks (`!!` `!` `~` + label), Now card for the focus timer/current task, gentle completion ("Crossed off. 3 today."), carryover copy, "Worth a look" filter styling, mobile Todos/Daily note switcher.
- [ ] 6. Notes + editor — `src/app/notes/page.tsx`, `src/components/notes/notes-view.tsx`, `src/components/editor/*` (toolbar, bubble menu, slash command, drawing toolbar/view): serif note title, 16px editor body at ~68ch, quiet toolbar, Bengali rendering check.
- [ ] 7. Daily Planner — `src/app/planner/page.tsx`, `src/components/planner/planner-view.tsx` (+ `planner-radial-utils.ts` colors, `planner-tour.tsx` if still rendered): Now card as the signature (inverse, `--now-accent` progress, 32px time), day strip, "Free — your call" in italic serif, Set up tabs + block list, planner colors.
- [ ] 8. Content Planner + workspace shell — `src/app/content-planner/page.tsx`, `src/components/content-planner/*`, `content-planner-view.tsx` (capture box, cards, gallery/board, inbox review, empty state, soft-cap badge on `--warning`); then `src/components/workspace/workspace.tsx`, `top-navbar.tsx` (pills, sync status copy), `sidebar.tsx` (date tree, workspaces, profile menu), `desktop-update-provider.tsx`.
- [ ] 9. Final sweep — remaining hardcoded hex/fonts/radii and sub-13px sizes in `globals.css`; move leftover unlayered CSS into `@layer components`; drop `@tabler/icons-react`; voice pass across all strings (sentence case, no "overdue"); `contrast-audit.mjs`; reduced motion + A-/A+ check; light/dark × desktop/mobile after screenshots in `.design/screenshots/after/`; update CLAUDE.md.

## Decisions log

<!-- Newest last. One line each: date — decision — reason. -->
- 2026-09-24 — Started makeover — user wants a "more premium, appealing visual"
- 2026-09-24 — Discovery done — brief.md + 6 before screenshots; top issues: generic cool dark theme, box/tint clutter, weak brand mark

- 2026-09-24 — Interview done — Tiimo soft/friendly, evolution, follow-system theme, nothing fixed, full scope, public product
- 2026-09-24 — Strategy + 3 directions built (A Quiet Desk teal/Figtree, B Soft Day lilac/Nunito, C Ember Journal terracotta/Fraunces) — all token pairs pass AA light+dark
- 2026-09-24 — Chose direction A · Quiet Desk (no mixes) — calm polished evolution of teal + paper
- 2026-09-24 — Switched to direction C · Ember Journal (no mixes) — user prefers it over A
- 2026-09-24 — DESIGN.md written from C; 5 token fixes for AA (priority-1/3 darker in light, dark `--warn` lifted, new `--now-accent`, checkboxes use `--check`); supersedes CLAUDE.md "Warm Minimalism"; 9 rollout batches planned
- 2026-09-24 — Rollout approved; committed user WIP (c699c44) first; working directly on dev per user
- 2026-09-24 — Batch 1 implemented + reviewed (tokens, fonts, system theme, 2xl radius capped at 18px); 16 failing + hanging tests are pre-existing on HEAD, flagged as a separate task
- 2026-09-24 — Fixed pre-existing test hang + stale tests separately (dd10051, e7b1305); suite 245/245 green
- 2026-09-24 — Batch 1 approved and committed

## Open questions

- Wordmark dot: after the final "o" or replacing the i-dot? (decide in batch 3)
- Tauri icon: single cream icon, or also an espresso variant for dark macOS? (batch 3)
- Rename "delete task" confirm to "Tear out …"? Voice suggests yes; buttons stay "Delete".
