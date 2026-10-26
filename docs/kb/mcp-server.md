# Content Planner MCP server
Last verified: 2026-10-26

`mcp-server/` is a small Node server that lets ChatGPT/Claude read and edit the Content Planner
and app notes from chat (MCP over HTTP). Read/add/edit only — no hard deletes anywhere; the only
delete is the soft `delete_app_note`. Deployed on Coolify
at `https://mcp.ahayder.me` against the prod PocketBase.

## How it works
- `mcp-server/src/server.ts`: `node:http` + `@modelcontextprotocol/sdk` Streamable HTTP, **stateless** — a new `McpServer` + transport per request. Only `/mcp/<MCP_SECRET>` serves MCP; `/health` returns ok; any other path (incl. wrong secret) is a 404. Auth is just the secret URL path (no OAuth); `MCP_SECRET` must be 32+ chars.
- Env: `MCP_SECRET`, `POCKETBASE_URL`, `POCKETBASE_USER_TOKEN` (preferred), or `POCKETBASE_USER_EMAIL` + `POCKETBASE_USER_PASSWORD` (fallback), `PORT` (default 8787). Template: `mcp-server/env.example` (no leading dot because `.env*` is git-ignored); real values in `mcp-server/.env`.
- **Login token:** `POCKETBASE_USER_TOKEN` is a PocketBase impersonation token for the **normal user** (never superuser). Mint it with `pnpm mcp:token [email] [days]` (`scripts/create-mcp-token.mjs`, uses the admin login in `.env.local`; `pnpm mcp:token:local` for the test DB). It prints only the token to stdout, so pipe it straight into `coolify app env create ... --value "$(pnpm -s mcp:token)"` without it showing on screen. Current prod token: 365 days, expires 2027-10-26. Revoke early by changing the user's `tokenKey` (this also signs out all the user's devices).
- `mcp-server/src/content-store.ts`: with a token, reads the owner id from the token payload (`tokenUserId`) and errors if it's expired; otherwise falls back to `authWithPassword`.
- Tools are registered in `mcp-server/src/server.ts`; logic in `mcp-server/src/tools.ts`. 16 tools:
  - Content Planner: `list_board`, `get_card`, `add_idea`, `update_card`, `move_card` (`to="next"` = the app's advance button), `set_publish_info`, `list_series`, `add_series`, `update_series`, `set_card_series`.
  - App notes ([app-notes.md](app-notes.md)): `list_app_notes` (status `open` default / `done` / `all`, `kind`, `include_deleted`), `get_app_note`, `add_app_note` (screen = "chat"), `update_app_note`, `delete_app_note` (soft, sets `deletedAt`), `restore_app_note`. Both soft-delete tools use `setAppNoteDeletedTool`.
- Tool logic reuses pure helpers from `src/lib` (`moveContentCard`, `appendSection`, `notesToDraft`/`draftToNotes`, `getEditorSections`, `cleanPastedShootCard`, `createContentSeries`, …) so behavior matches the app.
- Writes: `saveChangedCards` saves only cards whose object reference changed, one record at a time. Series edits read the latest board record, then write it.
- If the user has no `content_boards` record, tools error ("open the Content Planner once") instead of creating one.
- Scripts: `pnpm mcp:dev` (tsx, reads `mcp-server/.env`), `pnpm mcp:build` (esbuild → single file `mcp-server/dist/server.mjs`, git-ignored; needs the `createRequire` banner for ESM). Tests: `mcp-server/src/tools.test.ts`, picked up by `vitest.config.ts` (`mcp-server/**/*.test.ts`). Deploy steps for humans: `mcp-server/README.md`.

## Deployment (Coolify)
- Coolify at `coolify.ahayder.me`, CLI context `myvps`, project **DailyTodo**.
- App `dailytodo-mcp` (uuid `jfrjb8yzrx7jwxqddehfd10n`): GitHub app source `ahayder/daily-todo`, branch `main`, build pack dockerfile, base dir `/`, dockerfile `/mcp-server/Dockerfile` (multi-stage, builds from source), port 8787, domain `https://mcp.ahayder.me`, health check `/health`. Wildcard `*.ahayder.me` DNS already points at the VPS.
- Same project: website app `daily-todo` (nixpacks, `main`, `dailytodo.alihaydershuvo.com`); PocketBase is a Coolify service at `dailytodo-pocketbase.ahayder.me`.
- Prod PocketBase has the series fields (`series_json`, `series_id`) — verified 2026-10-26.

## Gotchas
- **Coolify applies env var changes only on a full redeploy** (`coolify deploy <uuid>`); a restart does not pick them up.
- The Coolify CLI can't set the dockerfile location — it was set via the Coolify API (`PATCH` with `dockerfile_location`).
- Password login from the server kept failing with "Failed to authenticate"; that's why the token is the main login now.
- Keep secrets off screen: generate `MCP_SECRET` in the shell and copy the connector URL with `pbcopy`; never print the token.
- **Row ↔ type mapping is duplicated** in `content-store.ts` from `src/lib/pocketbase/persistence-repository.ts` (content normalizers aren't exported; app notes: `rowToAppNote`/`appNoteToPayload` mirror `appNoteFromRow`/`appNoteToRow`). If a content card/board or app note field changes, update both.
- No hard deletes on purpose. `tools.test.ts` asserts the only delete-named tool is `setAppNoteDeletedTool` (soft) and the `ContentStore` has no delete/remove method. Don't add a delete without the user's OK.
- Open app tabs only see MCP edits on focus/reload; a stale tab that then saves wins (last write wins).
- Prod deploys need the user's OK. Point `mcp:dev` at the local test DB for experiments — prod data otherwise.

## Related
[content-planner.md](content-planner.md), [app-notes.md](app-notes.md), [pocketbase.md](pocketbase.md), [decisions.md](decisions.md), [dev-environment.md](dev-environment.md)
