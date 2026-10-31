# Knowledge base — how it works

This folder holds the project's detailed knowledge: how features behave, why, and the traps.
`CLAUDE.md` only holds rules every session needs; everything else lives here.

## Rule for agents

- **Main agents never read this folder directly.** They spawn the `kb-keeper` subagent
  (`.claude/agents/kb-keeper.md`; non-Claude tools: any subagent told to follow this README)
  and work from its short brief. This keeps the main task context small and on-topic.
- **The KB improves itself.** After a task that changes behavior, fixes a non-obvious bug, or
  reveals a gotcha or a user decision, the main agent sends `kb-keeper` (record mode) a short
  summary and it updates the pages. A Stop hook (`scripts/kb-reminder.mjs`) prints a reminder
  when code changed but `docs/kb/` didn't. It never writes.

## What belongs in the KB
Why, decisions, philosophy, traps, current status, and where things live. Not step-by-step
"how the code works" that the code already says: keep "How it works" to pointers + the
non-obvious bits, and slim those sections when you touch a page.

## Size budgets
Each page ≤ 90 lines; INDEX ≤ 40 rows; `project.md` ≤ 60 lines. Over budget → split or trim
(enforced by `pnpm kb:lint`, script `scripts/kb-lint.mjs`).

## Who may change what
kb-keeper edits facts freely. Philosophy (`project.md` → Philosophy), rules in `CLAUDE.md` /
`AGENTS.md`, and the kb-keeper agent's own instructions are changed only by Ali: kb-keeper adds a
proposal to `decisions.md` → "## Proposed (needs Ali)" with date + why.

## Modes
- **ask** — short brief for a task.
- **record** — after work; input = summary + `git diff --stat`.
- **tidy** — run `pnpm kb:lint`, fix broken paths, trim over-budget pages, re-verify the oldest
  `Last verified` pages against code.

## Repeated mistakes
When an agent repeats a mistake the KB already covers, add "(repeated YYYY-MM-DD)" to that
Gotcha. Repeats mean the page or rule needs rewriting.

## Page format

```md
# <Topic>
Last verified: YYYY-MM-DD

<Short summary: what it is, in 2–3 lines.>

## How it works
- Facts, with code paths like `src/lib/store.ts` (function names over line numbers).

## Gotchas
- Traps, past bugs, things not to do — with the reason.

## Related
- Other KB pages / docs.
```

## Writing rules

1. Plain, short language. Facts about the **current** code, not a diary of changes.
2. One topic per page. Update an existing page before creating a new one; no duplicates.
3. If something is wrong or removed, fix or delete it — don't append "update:" notes.
4. Name real files and functions so readers can jump to code. Check they exist.
5. Product decisions the user made go in `decisions.md` with the date and the why.
6. Bump `Last verified` on any page you change or confirm against code.
7. Every page must have a line in `INDEX.md`.
8. Never store secrets (passwords, tokens, admin creds) — only say where they live.
