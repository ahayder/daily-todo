# Knowledge base — how it works

This folder holds the project's detailed knowledge: how features behave, why, and the traps.
`CLAUDE.md` only holds rules every session needs; everything else lives here.

## Rule for agents

- **Main agents never read this folder directly.** They spawn the `kb-keeper` subagent
  (`.claude/agents/kb-keeper.md`; non-Claude tools: any subagent told to follow this README)
  and work from its short brief. This keeps the main task context small and on-topic.
- **The KB improves itself.** After a task that changes behavior, fixes a non-obvious bug, or
  reveals a gotcha or a user decision, the main agent sends `kb-keeper` (record mode) a short
  summary and it updates the pages.

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
