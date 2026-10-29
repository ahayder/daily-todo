# DailyTodo — Claude Brain File

@AGENTS.md

> This file holds only what **every** agent and session needs: the project in brief, workflow rules, and safety rules.
> Detailed project knowledge (how features work, why, past bugs, user decisions) lives in the **knowledge base** at `docs/kb/` — see below.
> UI look, feel and UX rules live in `.design/DESIGN.md`, applied through the UI/UX block in `AGENTS.md` (imported above).

---

## Project Overview

**DailyTodo** is a personal productivity app (Next.js web UI + Tauri desktop shell) combining a daily journal (markdown + drawing) and a structured todo list, organized by day. Dev server: `localhost:5005`.

The core metaphor is a **physical desk notebook** — warm, calm, analog in feel, with the efficiency of a digital tool. Think Bear Notes meets a bullet journal.

Areas: **Todos** (daily pages + carryover, Todo workspaces), **Notes**, **Daily Planner** (`/planner`), **Content Planner** (`/content-planner`).

## Tech Stack

Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS v4 + shadcn/ui on Base UI · Tiptap editor + Excalidraw · React `useReducer` + Context (`AppProvider`) · PocketBase auth + server-first per-record sync · Tauri 2 + native updater · lucide-react · Vitest + Testing Library · pnpm.

## Where code lives

- `src/app/` routes · `src/components/app/` state (reducer, provider, persistence hook) · `src/components/<area>/` feature UI · `src/components/{ui,blocks,signature}/` design system
- `src/lib/` pure logic: `types.ts`, `store.ts`, `sync-outbox.ts`, `persistence.ts`, `pocketbase/`, `content-conveyor.ts`, `planner-now.ts`
- `scripts/` PocketBase admin scripts · `src-tauri/` desktop shell · `docs/` docs + knowledge base

---

## Knowledge base (`docs/kb/`)

**Do not read `docs/kb/` yourself in the main context.** Use the `kb-keeper` subagent (`.claude/agents/kb-keeper.md`) so your context stays focused on the task.

1. **Before planning any non-trivial task** (a feature, bug fix, refactor, schema change — not a typo or one-liner), spawn `kb-keeper` in **ask mode** with the task description. Work from its brief. If the brief says a page disagrees with the code, trust the code.
2. **After finishing a task** that changed behavior or architecture, fixed a non-obvious bug, or revealed a gotcha or a user decision, spawn `kb-keeper` in **record mode** with a short summary (what changed, why, files, traps). Skip it for trivial changes. This is how the KB improves itself — it replaces the old rule of editing this file after every big change.
3. Only edit `CLAUDE.md` when a rule every session needs changes. Feature detail goes to the KB.

---

## Safety rules (always)

- **`pnpm dev` uses the production PocketBase** — localhost edits real data. Use the local test DB for experiments (`pnpm dev:test`, details in the KB). Prod deploys, prod schema applies and prod backup changes need the user's OK.
- **Sync is server-first.** Never add logic that deletes or overwrites server records based on what a device *lacks*; never seed/replace the workspace on load failure; daily pages are never deleted. (A whole-copy sync wiped all prod daily pages on 2026-10-07.)
- **PocketBase fields that can be empty or zero must not be `required`** — required fields reject `[]`, `{}`, `0`, `""` and silently freeze sync.
- **Dev auto-login credentials** (`NEXT_PUBLIC_DEV_AUTO_LOGIN_*`) are bundled into the client — local only, never in production.
- **Git:** commit as the personal account (`git config user.email` must be the `ahayder` no-reply address), on `dev`; `main` is the PR base. Don't create worktrees without asking the user; use a separate branch only when `dev` is busy or for an isolated test feature.

## Engineering rules

- **Styling Removal Rule:** when asked to remove a visual treatment (border, shadow, radius, background, divider, spacing, chrome…), delete or simplify the original rule instead of layering an override that cancels it. Only override when the original must stay for another component/state and can't be split yet.
- **Tailwind v4 layers (CRITICAL):** custom CSS in `globals.css` goes inside `@layer base | components | utilities`. Never write unlayered CSS there — unlayered rules beat every utility and break spacing app-wide.
- **Device-local UI state** (theme, sidebar collapsed, font scale, focus mode) stays local; don't move it to PocketBase without a strong cross-device reason.
- New shadcn components: `npx shadcn@latest add <component>` (lands in `src/components/ui/`).
- Tests: `pnpm test` (Vitest, pure, never touches PocketBase).
