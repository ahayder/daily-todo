# Project card
Last verified: 2026-10-31

The first page to read when switching to DailyTodo. Short on purpose; links go to detail.

## What it is / who it's for
DailyTodo is Ali's personal "external brain": a Next.js web app + Tauri desktop shell with a
day-based home (Today), notes, a memory of tasks/decisions/projects, and a Content Planner.
Single user with ADHD and three life areas: day job (Velox), content (YouTube + a product), personal.
AI chats (ChatGPT/Claude) write into it through the MCP server.

## Philosophy
_Owned by Ali. kb-keeper proposes changes in decisions.md → Proposed; it never edits this section directly._
- **Desk-notebook feel** — warm, calm, analog look with digital speed (`.design/DESIGN.md`).
- **Chat captures, the app shows** — AI saves things via MCP; the app is for seeing where you
  are and trusting changes ([user-needs.md](user-needs.md)).
- **Server is the truth; nothing is ever hard-deleted** — devices send only their own changes;
  deletes are soft with undo ([sync-persistence.md](sync-persistence.md), [decisions.md](decisions.md)).
- **ADHD-friendly calm** — fewer choices, one clear next action, Focus + Shelf as the model;
  no auto-pick, no hard caps, nothing mandatory ([decisions.md](decisions.md)).
- **Guideline, not schedule** — the day plan guides; gentle pings only.
- **Protect personal time** — no job work in evenings/weekends unless asked.
- **Trust before features** — visible history and undo for every AI change; ask before
  changing layout, navigation or workflows.

## Current status
- Live: Today (Now · Journal · Standup · History tabs), Notes, Memory/Project pages, Content
  Planner; top nav Today · Notes · Memory · Content Planner, bottom tab bar on phones
  ([ui-design.md](ui-design.md)). Day plan edited from Today ([daily-planner.md](daily-planner.md)).
- External brain (tasks, decisions, projects, meetings, follow-ups, repeats + `change_log`) synced
  server-first ([external-brain.md](external-brain.md)).
- MCP server on Coolify (`mcp.ahayder.me`), add/edit + soft delete + undo ([mcp-server.md](mcp-server.md)).
- Desktop: Tauri app with updater and pings ([desktop.md](desktop.md)). 2026-10-30 nav changes are
  on `dev`, not yet in a desktop release.
- As of 2026-10-31 the repo has PR CI: lint, typecheck, Vitest, MCP build, Playwright smoke
  tests ([testing.md](testing.md)).

## Next 3 steps
1. **Security pass** (planned, separate later pass): `pnpm dev` → test DB by default, a hook
   blocking prod commands, review of dev auto-login creds ([auth.md](auth.md)).
2. Merge the two task lists (external-brain `tasks` vs Journal daily-page todos) — agreed
   direction, not planned yet (guess — confirm with Ali).
3. M4: import Office Companion + OAuth for the MCP server ([user-needs.md](user-needs.md))
   (guess — confirm with Ali).

## Open questions
- Today tab row left-aligned vs centred; "Now" tab vs "Today" title; cramped phone Journal.
- How Journal todos and `tasks` merge, and the migration of old daily-page todos.
- Privacy of work transcripts on a personal server (summaries only for now).
- Full list: [decisions.md](decisions.md) → "Needs the user's judgment".

## Related
[INDEX.md](INDEX.md), [decisions.md](decisions.md), [user-needs.md](user-needs.md), [architecture.md](architecture.md)
