# DailyTodo MCP server

Lets ChatGPT or Claude work with DailyTodo from chat ("chat captures, the app shows"):
- **External brain:** tasks (Today, time blocks, Shelf, leftovers), decisions, projects, meeting summaries, follow-ups, repeats, search, and a standup agenda.
- **Content Planner:** list the board, add ideas, edit sections (idea note, shoot card…), move videos between stages, set publish links and transcripts, and manage series.
- **Change requests:** quick notes about the app itself.

**Nothing is ever hard-deleted.** "Delete" tools only hide a record (soft delete). Every write is saved in the change log, so `undo_change` can put it back and `redo_change` can bring it back again.

The server sends the assistant a short set of instructions (the Office Companion rules: proposed vs agreed, reuse tags, one small next step, protect personal time, summaries not transcripts). See `SERVER_INSTRUCTIONS` in `src/server.ts`.

It signs in to PocketBase as your normal user, so it can only touch your records. It reuses the app's own logic from `src/lib/` (moving, renumbering, Published dates, sections), so a change made in chat behaves exactly like the same change made in the app.

## Tools

- **Tasks:** `list_today`, `list_tasks`, `get_task`, `add_task`, `update_task` (incl. `append_note`), `schedule_task` (day + time block, or `"shelf"`), `complete_task` (also completes a repeat due today), `reopen_task`, `delete_task` (soft), `restore_task`
- **Decisions:** `log_decision` (incl. `replaces`), `list_decisions`, `get_decision`, `update_decision`
- **Projects:** `list_projects`, `get_project`, `add_project`, `update_project`
- **Meetings:** `file_meeting` (summary + linked decisions/tasks/follow-ups in one call; the transcript is only kept with `store_transcript: true`), `list_meetings`, `get_meeting`
- **Follow-ups:** `add_follow_up`, `list_follow_ups`, `resolve_follow_up`
- **Repeats:** `add_repeat`, `list_repeats`, `update_repeat`
- **Memory:** `search_memory`, `list_tags`, `standup_agenda`
- **History:** `list_changes`, `undo_change` (undoes a whole tool call; refuses if the record changed since), `redo_change`
- **Content Planner:** `list_board`, `get_card`, `add_idea`, `update_card`, `move_card` (pass `to: "next"` to advance like the app's button), `set_publish_info`, `list_series`, `add_series`, `update_series`, `set_card_series`
- **Change requests:** `list_change_requests`, `get_change_request`, `add_change_request`, `update_change_request`, `delete_change_request` (soft), `restore_change_request`

You can name a record by its id or by part of its title. If more than one matches, the tool lists them instead of guessing.

"Today" is the user's day in `USER_TIMEZONE` (default `Asia/Dhaka`).

## Run locally (test DB)

```bash
pnpm pocketbase:local          # in its own terminal
pnpm pocketbase:schema:apply:local
cp mcp-server/env.example mcp-server/.env   # point at http://127.0.0.1:8090, test user
pnpm mcp:dev                   # http://127.0.0.1:8787/mcp/<MCP_SECRET>
npx @modelcontextprotocol/inspector   # optional: try the tools in a UI
```

## Deploy (Coolify)

It runs as a Coolify app in the DailyTodo project, built from GitHub `ahayder/daily-todo`, branch `main`:
- Build pack: Dockerfile. Base directory: `/`. Dockerfile: `/mcp-server/Dockerfile`. Port: `8787`.
- Domain: `https://mcp.ahayder.me`. The `*.ahayder.me` DNS already points at the VPS, and Coolify handles HTTPS.
- Environment variables: the ones in `env.example`, with the **prod** `POCKETBASE_URL`. For the login, use `POCKETBASE_USER_TOKEN`, not a password. Create the token with `pnpm mcp:token [email] [days]`. It prints only the token, so pipe it straight into Coolify:
  `coolify app env create <app-uuid> --key POCKETBASE_USER_TOKEN --value "$(pnpm -s mcp:token)"`
  Then redeploy, because Coolify only applies settings on a deploy. The token stops working when it expires (365 days by default). To revoke it early, change the user's token key in PocketBase. That also signs out the app on every device.

Check it with `curl https://mcp.ahayder.me/health`, which should return `ok`.

To build the image by hand instead, run `docker build -f mcp-server/Dockerfile .` from the repo root.

Your connector URL is `https://mcp.ahayder.me/mcp/<MCP_SECRET>`. **Treat this URL like a password.** Anyone who has it can edit your board. To revoke it, change `MCP_SECRET` and restart the server.

## Connect it

- **Claude** (web or desktop): Settings → Connectors → Add custom connector. Paste the URL and leave the auth fields empty.
- **ChatGPT**: Settings → Apps & Connectors → Advanced → turn on Developer mode. Then Create, paste the URL, and set Authentication to "No authentication".

## Good to know

- An open app tab picks up chat changes when you switch back to it or reload. There's no live push.
- If an old open tab edits the same card at the same moment, the last write wins.
