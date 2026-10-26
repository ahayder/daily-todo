# Content Planner MCP server

Lets ChatGPT or Claude read and edit the Content Planner from chat: list the board, add ideas, edit sections (idea note, shoot card…), move videos between stages, set publish links and transcripts, and manage series. **There are no delete tools.**

It signs in to PocketBase as your normal user, so it can only touch your records. It reuses the app's own logic from `src/lib/` (moving, renumbering, Published dates, sections), so a change made in chat behaves exactly like the same change made in the app.

## Tools

`list_board`, `get_card`, `add_idea`, `update_card`, `move_card` (pass `to: "next"` to advance like the app's button), `set_publish_info`, `list_series`, `add_series`, `update_series`, `set_card_series`.

You can name a card by its id or by part of its title. If more than one card matches, the tool lists them instead of guessing.

## Run locally (test DB)

```bash
pnpm pocketbase:local          # in its own terminal
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
