# Agent Delegation Policy

This repository uses [`CLAUDE.md`](./CLAUDE.md) as the authoritative, single source of truth for:
- project conventions
- architecture and implementation guidance
- UI/design system rules
- workflow and prioritization instructions

## Precedence

If any instruction in `AGENTS.md` conflicts with `CLAUDE.md`, follow `CLAUDE.md`.

## Required Agent Workflow

Before planning or implementation, agents must read `CLAUDE.md` first and apply it as canonical guidance.

## Maintenance Rule

Keep this file short and delegating only. Update `AGENTS.md` only when delegation metadata changes, such as:
- canonical file path or name
- ownership/location of the canonical instructions
- pointer paths for locally referenced skill docs

Do not update `AGENTS.md` for normal project-guidance/content changes; those belong in `CLAUDE.md`.

## Local Skill Reference

Skill documentation is discoverable from the canonical source and local path:
- `./.agents/skills/`
