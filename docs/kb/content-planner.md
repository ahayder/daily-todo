# Content Planner (Content Conveyor)
Last verified: 2026-10-26

`/content-planner` is a full-width **"Focus + Shelf"** page: one fixed five-stage conveyor per user,
Ideas → Develop → Shoot next → Editing → Published. Built for ADHD: everything readable at a glance,
one obvious next step. Components: `src/components/content-planner/`; logic: `src/lib/content-conveyor.ts`.

## How it works
- **This week strip** (`week-strip.tsx`): ship meter, `WEEKLY_SHIP_GOAL = 4` dots + a dashed bonus dot, counted from `publishedAt` since Monday 00:00 local; no streaks. **Next up** = top of Editing, else Shoot next, else Develop, with its one next-step button.
- **Capture box** (`capture-box.tsx`): Enter saves to the top of Ideas (`create-content-card { atTop }`); Shift+Enter = new line; first line = title, rest = notes; quiet "Saved to Ideas".
- **Shelf** (`content-shelf.tsx`): wide rows grouped by stage in "soonest work first" order — Editing → Shoot next (`SoftCapBadge` N/5, never blocks) → Develop → Ideas (the Inbox stage, relabelled) → Published (collapsed, "N this week"). Row = title (2 lines), snippet (`getRowSnippet`), three section dots (`getSectionFill`), "Shipped Tue" on Published. Group collapse is device-local (localStorage via `useSyncExternalStore`, memory fallback). Row ⋯ menu: Move to top / Move up / Move to stage / Delete — no drag-and-drop.
- **Detail** (`card-detail.tsx`): right pane at ≥1024px (`MEDIA_QUERIES.split`, defaults to Next up else first card); below that a full-screen Base UI dialog sheet with Back. Shows `StageTrack`, editable title, one auto-growing textarea per section (`getEditorSections`; `notesToDraft`/`draftToNotes` keep an Ideas-only card as plain text and write `## SECTION` blocks once it grows). Exactly one primary button: `Develop this` / `Ready to shoot` / `Start editing` / `Mark published` — saves, appends the next section, moves the card to the top of the next stage, keeps it open, focuses the new section. Mark published focuses the first link field and toasts "Shipped! N of 4 this week".
- **Auto-save:** 400 ms debounce, flush on blur/advance/unmount. A render-time `base` vs stored-card check re-seeds the draft only on external changes, so the save echo never eats typing.
- **Shoot stages** (`isShootStage`: Shoot next, Editing, Published): an **Intent** callout (derived, never stored — `getShootIntent`/`getShootCardIntent` read part 1 via `parseShootCard`; a part starts only at a non-indented `N.` line following the previous number), then the Shoot card as a readable view (`shoot-card-view.tsx`; Edit/focus → textarea, blur returns), then Original thought / Idea note / Satellites under a collapsed **Earlier notes**. Paste strips ChatGPT source chips (`cleanPastedShootCard`). The intent also replaces the row snippet and shows under Next up. Stored as `## SHOOT CARD` inside `notes`.
- **Published** cards: `publish-info.tsx` — five optional links (YouTube, Facebook, TikTok, Instagram, LinkedIn; open-in-new-tab for http(s)) + Transcript, auto-saved 400 ms via `update-content-card-publish-info`.
- **Copy:** Copy for ChatGPT (Ideas/Develop only, `buildChatGptClipboard`: prompt names the section to write, asks for a CTA part on the Shoot card, then labelled Title / Original Thought / Idea Note). Copy as Markdown (detail ⋯) appends `## LINKS` / `## TRANSCRIPT`.
- **Delete:** instant, 8 s Undo toast (`restore-content-card` puts it back at its index).
- **Review** (`ideas-review.tsx`, Ideas header when 2+ ideas): one card at a time — Develop this / Keep for later / Delete; queue fixed on open so "N left" only goes down.
- **Empty state** (`content-empty-state.tsx`): StageTrack + one illustrative, never-saved card.
- **Series** (built 2026-10-11, not yet deployed): group videos; a card is in at most one series; open-ended, no episode order. Quiet by design — no effect on Next up, ship meter or stages; no per-series color.
  - `series-strip.tsx` under This week: neutral chips "▤ Name · 5 shipped" (one count from `getSeriesHeadline`: shipped → on the way → ideas → "new"), ordered by `sortSeriesByActivity`, + ghost "New series" (`series-name-dialog.tsx`, opens the new series right away).
  - `series-detail.tsx` (centered dialog ≥1024px, full-screen sheet below): editable name + "about" (400 ms autosave), stats (`formatSeriesStats`: "2 shipped · 3 on the way · 1 idea"; shipped = Published, on the way = Develop/Shoot next/Editing, ideas = Inbox), `InlineComposer` adds a linked idea at the top of Ideas, cards by stage (`getSeriesCardsByStage`), ⋯ Delete series via `ConfirmDialog` (videos stay, they just leave).
  - `card-series-picker.tsx`: chip under the card title in `card-detail.tsx` — pick / New series… / Open series / Leave series. Shelf rows show a muted "▤ Name" line.
  - Logic: `src/lib/content-series.ts`; store helpers `createContentSeries` / `addContentSeries` / `updateContentSeries` / `deleteContentSeries` / `setContentCardSeries` / `unlinkContentSeriesCards` in `src/lib/store.ts`. Actions: `create-content-series { seriesId, title, about?, cardId? }` (caller makes the id with `makeId("content-series")`), `update-content-series`, `delete-content-series` (unlinks cards — updates only, never deletes cards), `set-content-card-series { cardId, seriesId | null }` (unknown ids ignored); `create-content-card` takes optional `seriesId`.
  - Copy for ChatGPT adds "Series: Name" + about after the Title line (`buildChatGptClipboard(columnId, card, series?)`).
- A-/A+ reading size scales card text (em-based) via root `fontSize`.

## Persistence
- Board columns sync as one `content_boards` record; cards individually via `content_cards`. Positions reindexed to integers after every move.
- `publishedAt` (`content_cards.published_at`, non-required) is set by `moveContentCard` on entering Published, cleared on leaving. Older published cards have none and don't count.
- `ensureContentPlannerState` normalizes to exactly the five stages in order (keeps custom titles/subtitles; older 4-stage boards gain Editing) and folds legacy/custom columns away: their cards go to the end of Inbox (by old column, then position). Idempotent.
- `links` (json) and `transcript` (text, `max: 200000`) are non-required and only present when filled.
- Series list lives on the board record as `content_boards.series_json` (json, non-required; same pattern as `todo_workspaces_json`, avoids a new sync record kind). `ContentBoard.series` is **absent** when empty (`deleteContentSeries` drops the key, matching how the server reads it back). Cards: `content_cards.series_id` (text, non-required, `""` = none) ↔ `ContentCard.seriesId` (only present when set). Mapping in `src/lib/pocketbase/persistence-repository.ts` (`normalizeContentSeries` drops entries without id/title); Zod in `src/lib/schema.ts`.

## Gotchas
- Board-rebuilding helpers must spread the board (`...board`) or `series` is lost — fixed in `ensureContentPlannerState` and the column helpers in `src/lib/store.ts`.
- A stale `seriesId` (series deleted) is kept on purpose (non-destructive normalization); the UI treats it as "no series" via `getCardSeries`.
- Series fields need the prod schema applied (`pnpm pocketbase:schema:apply`) **before** shipping the code, or PocketBase silently drops them. As of 2026-10-11 applied to the local test DB only.
- Intentionally narrow: no column editing, tags (series are the one exception), scoring, scheduling, filters or AI generation. Column reducer actions (`add-/rename-/update-…-subtitle/reorder-/delete-content-column`) still exist with tests but aren't in the UI.
- Removed for good: Board/Gallery views, per-card collapse, move dialog, Markdown rendering of cards.
- Selection, sheet state, review position and focus requests are ephemeral component state.
- Changes to conveyor behavior need the user's product judgment; see [decisions.md](decisions.md).
- Card/board field changes must also be mirrored in the MCP server's duplicated mapping (`mcp-server/src/content-store.ts`); see [mcp-server.md](mcp-server.md).

## Related
[decisions.md](decisions.md), [pocketbase.md](pocketbase.md), [mcp-server.md](mcp-server.md)
