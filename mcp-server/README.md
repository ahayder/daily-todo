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

## Deploy to the VPS

1. On your machine, build: `pnpm mcp:build`. This produces `mcp-server/dist/server.mjs`, one file with no dependencies.
2. Copy `mcp-server/Dockerfile` and `mcp-server/dist/` to the VPS, then build and run the container:
   ```bash
   docker build -t dailytodo-mcp .
   docker run -d --name dailytodo-mcp --restart unless-stopped --env-file .env -p 127.0.0.1:8787:8787 dailytodo-mcp
   ```
   Use a `.env` that holds the **prod** `POCKETBASE_URL` and your login (see `env.example`). Without Docker, `node --env-file=.env server.mjs` under systemd works too.
3. Point DNS for `mcp.ahayder.me` at the VPS, and reverse-proxy HTTPS to `127.0.0.1:8787` (use the same proxy as PocketBase). With Caddy:
   ```
   mcp.ahayder.me {
     reverse_proxy 127.0.0.1:8787
   }
   ```
4. Check it with `curl https://mcp.ahayder.me/health`, which should return `ok`.

Your connector URL is `https://mcp.ahayder.me/mcp/<MCP_SECRET>`. **Treat this URL like a password.** Anyone who has it can edit your board. To revoke it, change `MCP_SECRET` and restart the server.

## Connect it

- **Claude** (web or desktop): Settings → Connectors → Add custom connector. Paste the URL and leave the auth fields empty.
- **ChatGPT**: Settings → Apps & Connectors → Advanced → turn on Developer mode. Then Create, paste the URL, and set Authentication to "No authentication".

## Good to know

- An open app tab picks up chat changes when you switch back to it or reload. There's no live push.
- If an old open tab edits the same card at the same moment, the last write wins.
