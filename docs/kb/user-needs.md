# User needs & Today redesign (proposal)
Last verified: 2026-10-14

How the user actually works, from a user interview on 2026-10-14. Use this before redesigning
Todos, Daily Planner or the home screen. **Nothing here is built yet; the proposal is not approved.**

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

## Proposal under discussion (not approved — ask before building)
Merge Todos + Daily Planner into one **"Today"** home: Now card + guideline timeline + Shelf.
Link Content Planner via a "Do today" action. Add gentle pings, "Paused at / Next" breadcrumbs,
and a quick-capture hotkey.

## Gotchas
- Merging pages, changing navigation or carryover needs the user's OK (see [decisions.md](decisions.md)).
- The user declined auto-pick / "pick for me" and hard caps in Content Planner; don't assume they want them in Today.

## Related
[todos.md](todos.md), [daily-planner.md](daily-planner.md), [content-planner.md](content-planner.md), [decisions.md](decisions.md)
