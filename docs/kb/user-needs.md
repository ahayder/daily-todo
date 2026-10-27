# User needs & Today redesign (proposal)
Last verified: 2026-10-27

How the user actually works (interview 2026-10-14) and the redesign direction agreed in mockups
(2026-10-27). Use this before redesigning Todos, Daily Planner, Notes or the home screen.
M1 (backend: collections, logic, MCP tools, change history) is live on prod since 2026-10-27;
M2 (Today + History UI) is built on branch `claude/charming-bun-fe98e0` — see
[external-brain.md](external-brain.md). Old Todos / Daily Planner stay until a migration of old
daily-page todos is decided. Next: M3 Memory / Project / Standup pages, M4 import Office Companion + OAuth.

## Pain points
- Too many choices (decision paralysis), losing the thread mid-day (shiny things), time
  vanishing (time blindness). **Not** "can't start".
- Job (Jira + asks from meetings/Slack) and content/YouTube work are mixed all day.

## What is (and isn't) used
- **Content Planner** — the only page used daily. Works because of clear stages, one button per
  card, and Focus + Shelf. Treat it as the model for other screens.
- **Todos** — feels a bit cluttered. The user mostly forgets to open it and, on sitting down to
  work, doesn't know where to look.
- **Daily Planner** — unused: blocks are empty (name + time only), the user forgets it exists.
  Wants it as a **guideline, not a strict schedule**.
- **Daily note and Notes** — unused because the user fears data loss while the app is under heavy
  development. Trust is a blocker; any redesign that leans on notes depends on sync feeling safe.

## What the user wants
- On sit-down: **"Now + timeline"** — the current block and its task on top, the rest of the day below.
- Gentle nudges (desktop pings) are welcome.
- Leftovers (unfinished tasks): no preference.

## Life areas (2026-10-26)
Three: **day job** (Velox for the Astra team, a skills repo), **content** (YouTube + a product
sold through content), **personal**.

## Redesign direction: "chat captures, the app shows" (2026-10-27; Today + History built, Memory still mockup)
- ChatGPT/Claude save tasks, decisions (status Agreed / Proposed / Yours + source), ideas,
  repeats/routines and meeting summaries through the MCP server. The app is for seeing where
  you are and trusting AI changes. Agreed parts are in [decisions.md](decisions.md).
- Mockups: https://claude.ai/artifact/6aszsDDcxexqxFf33KH1KK. Technical plan (outside the repo):
  `/Users/ahayder/.claude/plans/yes-look-it-up-warm-hinton.md` — `tasks` + `change_log`
  collections, MCP task/history tools, a `withHistory` wrapper.
- Screens: **Today** (Todos + Daily Planner merged: Now card + guideline timeline + Shelf),
  **Memory** (search → project cards → decisions), **Content**.
- UI review (ui-qa) outcomes already in the mockups: timeline rows show time + task only
  (details on expand); "Do today" opens a block picker; Now card has a "Not now" button; no
  D-codes in the UI; reuse the NowCard ring and WashiTag ("N days waiting"); headings ≤30px;
  free time copy is "Free — your call".
- **Office Companion fold-in:** the user's folder `/Users/ahayder/Documents/Work/AlisOfficeCompanion`
  (meeting transcripts, CURRENT, DECISIONS D01–D18, TIMELINE, 16:00 Asia/Dhaka standup agendas;
  Brian joins Mon/Wed/Fri) is to move into DailyTodo. Its rules — "reported ≠ verified",
  "proposal ≠ approved", "protect personal time and weekends", "one small step" — go into the
  MCP server instructions.

## Gotchas
- Merging pages, changing navigation or carryover needs the user's OK (see [decisions.md](decisions.md)).
- **Privacy:** work transcripts would live on a personal server. Store summaries, not raw
  transcripts, unless the employer allows it.
- The user declined auto-pick / "pick for me" and hard caps in Content Planner; don't assume they want them in Today.

## Related
[external-brain.md](external-brain.md), [todos.md](todos.md), [daily-planner.md](daily-planner.md), [content-planner.md](content-planner.md), [decisions.md](decisions.md)
