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

## Knowledge Base

Detailed project knowledge lives in `docs/kb/` (rules: `docs/kb/README.md`). Never read it in the main context — ask a subagent (Claude: `.claude/agents/kb-keeper.md`; other tools: any subagent told to follow `docs/kb/README.md`) for a brief before planning, and send it what you learned after finishing. See `CLAUDE.md` → "Knowledge base".

## Local Skill Reference

Skill documentation is discoverable from the canonical source and local paths:
- `./.agents/skills/` (state, desktop, editor, testing)
- `./.claude/skills/` (UI/UX: `ui-system`, `ui-components`, `ux-patterns`, `ui-custom-elements`)

<!-- ui-brain:start v2 -->
## UI/UX system

- Project knowledge: ask `kb-keeper` before a non-trivial task and record after it (see "Knowledge base" above and in `CLAUDE.md`).
- Source of truth: `.design/DESIGN.md` — read its **Quick card** first; open other sections only when the task needs them. How-to: skills `ui-system`, `ui-components`, `ux-patterns` (Clarity, legacy vs target, ask-first, product-judgment list, done means), `ui-custom-elements`.
- Every screen must be obvious: where am I, what is this for, what do I do, what happens next. One primary action, labelled with its outcome. Clarity beats style.
- Reuse first: existing component → block → compose from tokens → new custom element. Never hardcode colors, fonts, or spacing.
- Ask before changing layout, navigation, hierarchy, or a workflow.
- Dark is the primary theme; check dark + light, 375px + desktop (`localhost:5005/<route>?devWorkspace=1`).
- After a task that changed a screen: launch the `ui-qa` sub-agent with what changed; fix its High and Medium findings (ask the user about "needs user" items).
<!-- ui-brain:end -->
