---
phase: done
next: "Run /ui-brain:doctor after the next big UI change"
waiting_for: ""
brain_version: 2
updated: 2026-10-14
last_checked: 2026-10-30
---

<!--
  ui-ux-pro scaffold state. The SessionStart hook reads the frontmatter above;
  /ui-ux-pro:scaffold continue resumes from it. Keep the keys exactly as they are:
    phase:       confirm | research | interview | plan | scaffold | validate | done | update
    next:        the very next concrete action, in a few words
    waiting_for: what the user needs to do, if anything, else ""
    brain_version: version of the brain format (markers use the same number)
    updated:     date of the last change
  This file is state and history, not instructions. The rules live in AGENTS.md and .design/DESIGN.md.
-->

# UI/UX scaffold — DailyTodo

Goal (confirmed): Fresh, lasting UI system + agent brain for DailyTodo (makeover discarded); future UI work stays consistent and polished
Platforms: web (Next.js 16 + Tailwind v4 + shadcn/ui), wrapped in a Tauri desktop shell
Visual direction: new — via makeover directions (Tiimo-like, dark-first, Bengali-first-class)

## Phases

- [x] 1. Confirm — understanding approved by user
- [x] 2. Research — `.design/research/{repo,ecosystem,patterns}.md`, `.design/brief.md`
- [x] 3. Interview — taste answers in `.design/brief.md`
- [x] 4. Plan — `.design/plan.md` approved
- [x] 5. Scaffold — brain files + code foundation written, `check-brain.mjs` passes
- [x] 6. Validate — before/after on /todos (undo-delete feature), lessons applied
- [x] 7. Done

## Brain files

<!-- Filled in phase 5; update mode compares against this list. -->
- `.design/DESIGN.md` — source of truth (B2 tokens, type, shape, motion, UX patterns, custom elements, legacy vs target)
- `AGENTS.md` (ui-brain v2 block, ≤15 lines) — always-loaded rules; long rules live in `ux-patterns`
- `.claude/agents/ui-qa.md` — UI/UX QA helper (report only)
- Project knowledge: `kb-keeper` + `docs/kb/` (user's own; no `.brain/`)
- `CLAUDE.md` — `@AGENTS.md` import; Warm Minimalism section replaced by a pointer + Styling Removal / Tailwind layer rules
- `.claude/skills/ui-system`, `ui-components`, `ux-patterns`, `ui-custom-elements`
- Removed: `.claude/skills/design-system`, `.agents/skills/design-system`; `.agents/skills/tiptap-editor` now points at DESIGN.md
- Code: `globals.css` tokens/aliases/motion/washi, `layout.tsx` fonts + theme-hint script, `src/lib/theme-hint.ts`, `ui/{button,badge}` restyle, new `ui/{icon-button,toast,dropdown-menu,textarea,separator,skeleton}`, `blocks/*`, `signature/*`, `hooks/use-media-query.ts`, tokenized confetti, removed `@tabler/icons-react`

## Decisions log

<!-- Newest last. One line each: date — decision — reason. -->
- 2026-10-01 — Reverted the Ember Journal makeover (commit fe0353c → aa86b68) and removed its .design/ files — user asked to clean it and start fresh
- 2026-10-01 — Started scaffold — fresh UI system + agent brain
- 2026-10-01 — Understanding confirmed — moving to research
- 2026-10-01 — Research done (repo, ecosystem, patterns, brief) — moving to interview
- 2026-10-01 — Interview answered: new direction, Tiimo, subtle motion, polished+signatures, dark-first, Bengali often, undo-toast deletes — generating directions
- 2026-10-01 — Direction pick: B (Pocket Stickers) but much darker (liked A's depth) — building B2 preview
- 2026-10-01 — B2 approved as direction; plan written to .design/plan.md
- 2026-10-01 — Plan approved as written (remove Warm Minimalism from CLAUDE.md); validation = undo-delete on /todos; work on dev (no branch)
- 2026-10-01 — Scaffold built; check-brain OK (0 warnings); design review fixed contrast/focus/toast/segmented issues; snapshot ref refs/scaffold/phase5
- 2026-10-01 — Scaffold built; check-brain OK (0 warnings); design review fixed contrast/focus/toast/segmented issues
- 2026-10-01 — Validation run: brain guided the agent well; 3 small brain fixes applied (undo helper, verify steps, touched-part definition)
- 2026-10-01 — User kept the undo-delete feature; scaffold done
- 2026-10-14 Doctor: 9 findings (check only, no fixes applied)
- 2026-10-14 — Similar helper `.claude/agents/kb-keeper.md` (+ `docs/kb/`): user chose **Keep yours and connect it** — no `.brain/`, no `brain` agent, no Stop hook; block points to kb-keeper
- 2026-10-14 — Similar helper `.agents/skills/vitest-testing` partly overlaps `ui-qa` (unit tests vs usability): kept both
- 2026-10-14 — Upgraded v1 → v2: renamed markers + `scaffold.md` → `setup.md`; block cut 54 → 11 lines (long rules moved to `ux-patterns` / `ui-system`); added Clarity, DESIGN.md Quick card, `ui-qa`; fixed 4 DESIGN.md contradictions; inventory +11 content-planner pieces, Series chip, "not adopted yet" marks
- 2026-10-14 — Offline sync pill: user chose `warning` (amber) per DESIGN.md
- 2026-10-14 — App-code fixes approved: top bar cleanup, `text-xs` in shadcn primitives, raw AlertDialog → `ConfirmDialog` (new `variant` prop)

- 2026-10-30 — Doctor: 4 brain findings (nav/layout/inventory drift) + 7 app-structure findings (focus: layout, nav, structure)

- 2026-10-30 — Structure decided (not built yet): Today is the one home; Todos daily pages become a Journal inside Today; two task lists merge over time (separate job)
- 2026-10-30 — Nav decided: pills Today · Notes · Memory + "Plan" menu (Daily Planner, Content Planner); Journal, Standup, History = tabs/links inside Today
- 2026-10-30 — Mobile nav decided: bottom tab bar (Today, Notes, Memory, Plan); desktop keeps top pills

## Validation notes

<!-- Phase 6: what the brain failed to guide, and what was changed because of it. -->
Task: "On the Todos page, let me delete a todo safely: deleting should be instant but undoable." (fresh general-purpose agent, no ui-ux-pro)
- Got right: read CLAUDE.md → AGENTS.md block → `ux-patterns` + `ui-components`; used the shared toast and the decided pattern (instant + Undo, no confirm); exact restore via new `restore-todo` reducer action + tests; didn't restructure anything; listed judgment calls instead of guessing.
- Miss 1: Undo toast used the 5s default — too short (the agent itself timed out). Fix: added `showUndoToast` (8s, closes after Undo) in `ui/toast.tsx`; `ux-patterns` + `ui-components` now require it; call site migrated.
- Miss 2: didn't check mobile/light. Fix: AGENTS.md "Done means" now says how to check (devWorkspace URL, 375px/1280px, remove `dark` class) and to report what was checked.
- Miss 3 (ambiguity): unsure whether to restyle the touched legacy delete button. Fix: AGENTS.md defines "the part you touch" (markup/styling changes; behavior-only changes don't force restyling; restyle a whole row, not one control).
- Not a brain issue: deleting the focused task stops the timer and Undo doesn't restore it (product judgment → asked).
- Fixes were small; no rerun needed.
