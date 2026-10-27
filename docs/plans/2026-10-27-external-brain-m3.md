# Plan: Milestone 3 — Memory, Project, Standup pages + gentle desktop pings

Date: 2026-10-27 · Builds on M2 (Today + History, commit 74e53df on `dev`).
Mockups: https://claude.ai/artifact/6aszsDDcxexqxFf33KH1KK (Memory, Topic, Standup boards).

## Goal

"Chat captures, the app shows." M3 lets the user find what they decided and where each project stands, without asking an AI:
- **Memory**: search everything, project cards, the decisions log.
- **Project**: one project's state, next step, tasks, decisions, follow-ups, meetings and timeline.
- **Standup**: today's 16:00 agenda, built from the records.
- **Gentle pings**: small desktop reminders (block starting, standup soon), never pushy.

After M3 is built and checked, it ships to production. The user then uses it for 2–3 days and sends feedback.

## Rules (from CLAUDE.md and the KB)

- Server-first sync: soft delete only, never delete what a device lacks. Memory kinds are upsert only; `change_log` is create only.
- Every app edit goes through `src/lib/memory/app-actions.ts` → `writeWithHistory`, so it shows in History with Undo.
- Test on the local DB only (`pnpm pocketbase:local`, `pnpm dev:test`, http://dailytodo.localhost:5005).
- UI: tokens only, life areas as neutral chips, no D-codes, headings ≤ 30px, dark + light, 375px + desktop. Run `ui-qa` after building and fix its High and Medium findings.
- "Today" and standup times use Asia/Dhaka.
- Ask before changing navigation, layout or a workflow. No "pick for me", no hard caps.
- The "Note for the app" lightbulb (⌘⇧I) stays in the top bar on every page, new pages included.

## 1. Memory page (`/memory`)

Built from `src/lib/memory/search.ts` (`searchMemory`, `collectTags`) and `decisions.ts` (`currentDecisions`, `decisionChain`).

- Header "Memory" + one line: "Where your projects stand and what you decided."
- **Search box** (search as you type): results across tasks, decisions, projects, meetings, follow-ups and repeats, grouped by kind, each linking to where it lives (task → Today, project → Project page, meeting → Project page or a meeting detail).
- **Projects**: one card per active project: name, area chip, "where it stands", "Next: …". Paused/done projects sit under a fold ("Paused and done (n)").
- **Decisions log**: newest first. Status chip (Agreed / Proposed / Yours), title, why, date, source ("Standup · Brian"), tags, and links (project, tasks it caused). A replaced decision is struck through: "You changed this: now '…'". Tag chips filter the list ("All", #velox, #youtube …).
- **Waiting on others**: open follow-ups grouped by person with a washi "N days waiting" tag, plus "Resolved" (logged, undoable).
- Empty state teaches the flow: "Tell your AI 'remember that we decided…' and it shows up here."

## 2. Project page (`/memory/project?id=…`)

Static export (desktop app) can't use dynamic route segments, so the id goes in the query string.

- Back link "← Memory", project name, area chip, status.
- **Where it stands** card: state text + "Next small step" with one primary button: "Do today" (puts the matching task on Today, or creates one from the next step). Link "Today's standup agenda →" for job projects.
- **Tasks**: open tasks of the project (on Today / on the Shelf / leftovers), each with "Do today"; a "Done" fold for finished ones.
- **Decisions** (current, newest first), **Waiting on others**, **Meetings** (title, date, who filed it; expands to the markdown summary — never the transcript unless it was kept on purpose), **Timeline** (this project's change_log in plain words, via `describeChange`).
- Light edits (each logged with Undo): set the next step, set the state text, pause/resume the project.

## 3. Standup page (`/standup`)

Built from `buildStandupAgenda(date, memory, { timeZone, area: "job" })`.

- Title "Standup · Tue 27 Oct, 16:00". Sections: **What I did** (since the last workday), **Today**, **Waiting on others** (by person), **Open proposals**, **Next** (each project's next step).
- Each item has a check box to tick off while talking. Ticks are device-local and reset each day (they're a meeting aid, not data).
- "After the meeting" box: paste the transcript into your AI and say "file today's standup"; it shows on Today with Undo.
- Linked from Today (a quiet "Standup agenda" link near the standup block, or when a repeat/block named "Standup" exists) and from job project pages.

## 4. Gentle desktop pings (Tauri)

Needs `tauri-plugin-notification` (Rust + JS), a capability entry, and a **new desktop release** (the desktop app bundles the static web build, so it only gets M2/M3 through a release anyway).

Proposed defaults (to confirm):
- **Block starting**: "Deep work starts now — velox submit: compare link" at the start of each planner block that has a task. Free blocks: no ping.
- **Standup soon**: 10 minutes before 16:00 on workdays, "Standup in 10 min — agenda is ready".
- **Never** on weekends, never before 08:00 or after 18:00 (protect personal time), at most one ping per block, none while the app window is focused (the Now card already shows it).
- One switch in the app to turn pings off (device-local, like theme). Asks the OS for permission the first time it's turned on.
- The web app (browser) gets no pings in M3.

## 5. App data path additions

New reducer actions in `app-actions.ts` (all through `writeWithHistory`, source "app"):
- `memory-resolve-follow-up`, `memory-reopen-follow-up`
- `memory-update-project` (state, nextStep, status)
- `memory-set-decision-status` (proposed → agreed, etc.)
No new collections or fields are needed; the M1 schema (already on prod) covers everything.

## 6. Navigation (needs the user's OK)

Agreed long-term nav is **Today · Memory · Content**. The M2 decision kept Todos, Notes, Daily Planner and Content Planner until old daily-page todos have a migration. Proposal for M3: **add a "Memory" pill after Today** and keep the rest. Project and Standup pages have no pill (opened from Memory and Today).

## 7. Tests

- Pure tests (Vitest): search grouping, project page selectors (tasks/decisions/follow-ups/timeline for a project), standup view model, new app actions + undo, ping scheduler (which pings fire when, quiet hours, weekends).
- Component smoke tests for the three pages.
- Real sync on the local DB, then `ui-qa`.

## 8. Shipping to production (after M3 is checked)

1. Push `dev`; open a PR `dev` → `main` (personal gh account), merge.
2. **Web**: Coolify app `daily-todo` deploys `main` (check whether it auto-deploys; else `coolify deploy`). The MCP server needs no redeploy unless `mcp-server/` changed (it did in M2: shared mappers + the weekday fix, so redeploy `dailytodo-mcp` too).
3. **Desktop**: bump the version, `pnpm version:sync`, tag `v*` on `main`; GitHub Actions builds and signs the macOS app and the in-app updater offers it.
4. Smoke test on production: Today, History, Memory, Project, Standup; one AI capture from chat shows up with Undo.

Each production step needs the user's go-ahead at the time.

## Order of work

1. Data actions + pure selectors + tests.
2. Memory page → Project page → Standup page (one commit each).
3. Pings (plugin, scheduler, switch).
4. Check the "Note for the app" button on every page; full tests; `ui-qa`; fixes; KB record.
5. Push `dev`, ship (section 8).

## Questions for the user

1. Add a **Memory** pill now (keeping Todos / Notes / Planner / Content)?
2. Pings: are the defaults in section 4 right (block start + standup in 10 min, 08:00–18:00, weekdays only, off while the app is focused)?
3. Ship the **desktop app** too (new release with pings), or only the web app for the 2–3 day trial?
4. Leftover from M2: Shelf before "Your day" on phones? An "Only AI changes" filter on History?

## Out of scope (M4)

Importing the Office Companion folder, OAuth for MCP, retiring Todos/Daily Planner after a migration, browser pings.
