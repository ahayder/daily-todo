# Product decisions
Last verified: 2026-10-11

Decisions the user made. Don't undo or re-propose without asking. Newest first.

- **2026-10-11 — Content Planner series.** User wanted to group videos into series, note the series idea, and see published counts per series. Chose: open-ended (no target episode count), no episode order, a card in at most one series, counts also on the main page. Series stay quiet — they don't change Next up, the ship meter or stages. Relaxes the "no tags" narrowness only for series.
- **2026-10-08 — Content Planner Editing stage + publish info.** User asked for Editing after Shoot next ("Start editing") and optional per-platform links + transcript on Published — "nothing mandatory". They praised Focus + Shelf as natural and intuitive: keep its feel.
- **2026-10-07 — Server-first sync.** After the data loss the user chose "server is the truth; devices only send their own changes", as bulletproof as possible. See [sync-persistence.md](sync-persistence.md).
- **Oct 2026 — Content Planner redesign to Focus + Shelf.** The user has ADHD, shiny-object syndrome and analysis paralysis; Kanban and Gallery truncated cards. Goal: publish 4–5 pieces a week; uses phone and desktop equally. **Declined:** auto-picked Now card with swap / "pick for me", hiding Ideas as a "parked" count, hard Shoot-next cap of 3 (stays soft 5). Chose only the weekly ship tracker. Legacy columns folded into Inbox at the user's request. Before adding helpers, ask what the next pain point is.
- **Oct 2026 — Daily Planner NOW + Set up.** Radial editor, budgets, roles, multi-presets and tour removed from the UI (data kept).

## Needs the user's judgment (ask first)
Todo status-change confirmation · soft caps beyond Shoot next · confetti frequency · any delete that can't be undone and isn't a workspace/folder/note/column · carryover or Content Conveyor behavior changes.
