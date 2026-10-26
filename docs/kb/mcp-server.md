# Content Planner MCP server
Last verified: 2026-10-26

`mcp-server/` is a small Node server that lets ChatGPT/Claude read and edit the Content Planner
from chat (MCP over HTTP). Read/add/edit only — no delete tools, by design. Not deployed yet
(planned: Docker on the PocketBase VPS at `mcp.ahayder.me`).

## How it works
- `mcp-server/src/server.ts`: `node:http` + `@modelcontextprotocol/sdk` Streamable HTTP, **stateless** — a new `McpServer` + transport per request. Only `/mcp/<MCP_SECRET>` serves MCP; `/health` returns ok; any other path (incl. wrong secret) is a 404. Auth is just the secret URL path (no OAuth); `MCP_SECRET` must be 32+ chars.
- Env: `MCP_SECRET`, `POCKETBASE_URL`, `POCKETBASE_USER_EMAIL`, `POCKETBASE_USER_PASSWORD`, `PORT` (default 8787). Template: `mcp-server/env.example` (no leading dot because `.env*` is git-ignored); real values in `mcp-server/.env`.
- `mcp-server/src/content-store.ts`: PocketBase store signed in as the **normal user** via `authWithPassword` — never superuser.
- `mcp-server/src/tools.ts`: 10 tools — `list_board`, `get_card`, `add_idea`, `update_card`, `move_card` (`to="next"` = the app's advance button), `set_publish_info`, `list_series`, `add_series`, `update_series`, `set_card_series`. Reuses pure helpers from `src/lib` (`moveContentCard`, `appendSection`, `notesToDraft`/`draftToNotes`, `getEditorSections`, `cleanPastedShootCard`, `createContentSeries`, …) so behavior matches the app.
- Writes: `saveChangedCards` saves only cards whose object reference changed, one record at a time. Series edits read the latest board record, then write it.
- If the user has no `content_boards` record, tools error ("open the Content Planner once") instead of creating one.
- Scripts: `pnpm mcp:dev` (tsx, reads `mcp-server/.env`), `pnpm mcp:build` (esbuild → single file `mcp-server/dist/server.mjs`, git-ignored; needs the `createRequire` banner for ESM). Tests: `mcp-server/src/tools.test.ts`, picked up by `vitest.config.ts` (`mcp-server/**/*.test.ts`).

## Gotchas
- **Row ↔ type mapping is duplicated** in `content-store.ts` from `src/lib/pocketbase/persistence-repository.ts` (its normalizers aren't exported). If a content card/board field changes, update both.
- No delete tools on purpose; a test asserts no `delete`/`remove` tool exists. Don't add one without the user's OK.
- Open app tabs only see MCP edits on focus/reload; a stale tab that then saves wins (last write wins).
- Before deploying against prod: confirm the series fields (`series_json`, `series_id`) are applied to the prod schema (see [content-planner.md](content-planner.md)). Prod deploys need the user's OK.
- Point `mcp:dev` at the local test DB for experiments — prod data otherwise.

## Related
[content-planner.md](content-planner.md), [pocketbase.md](pocketbase.md), [decisions.md](decisions.md)
