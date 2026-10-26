# KB index

Read this first, then open only the pages that matter for the task.

| Page | Covers | Read when |
|---|---|---|
| [architecture.md](architecture.md) | Folder map, state shape, reducer/AppProvider, routes | Touching state, adding an entity, finding where code lives |
| [sync-persistence.md](sync-persistence.md) | Server-first sync, outbox, phases, safety rules, 2026-10-07 data loss | Anything that saves, loads, caches or syncs data |
| [pocketbase.md](pocketbase.md) | Collections, schema script, local vs prod DB, backups, required-empty trap | Changing the DB schema, adding a synced field, testing real sync |
| [todos.md](todos.md) | Daily pages, carryover, day advance, workspaces, task attention, delete/undo, small screens | Todos view, daily notes, dates, workspaces |
| [notes-editor.md](notes-editor.md) | Tiptap editor, markdown, Excalidraw drawings, legacy tldraw | Notes view or the markdown editor |
| [daily-planner.md](daily-planner.md) | `/planner` NOW + Set up screens, templates, 24h clock | Daily Planner |
| [content-planner.md](content-planner.md) | `/content-planner` Focus + Shelf conveyor, stages, Shoot card, publish info, video series | Content Planner |
| [mcp-server.md](mcp-server.md) | `mcp-server/` Content Planner MCP server for ChatGPT/Claude: tools, secret-URL auth, token login, Coolify deploy | Editing the MCP server, its tools, or content card/board fields |
| [auth.md](auth.md) | PocketBase auth, dev workspace, dev auto-login, account menu, super-admin | Login, accounts, dev/test tools |
| [desktop.md](desktop.md) | Tauri shell, updater, releases | Desktop app or releases |
| [testing.md](testing.md) | Vitest, how to check UI in the browser | Writing tests or verifying UI |
| [ui-design.md](ui-design.md) | Pointers to DESIGN.md, UI skills (inventory), ui-qa agent, ConfirmDialog, sync pill, Tailwind v4 layer trap | Any UI change |
| [user-needs.md](user-needs.md) | How the user really works (2026-10-14 interview): pain points, pages used/unused, "Today" redesign proposal | Redesigning Todos, Daily Planner, home screen, nudges |
| [decisions.md](decisions.md) | Product decisions the user made (and what they declined) | Before adding features or changing behavior |
| [dev-environment.md](dev-environment.md) | Git identity, scripts, env files | Committing, pushing, running scripts |

Other docs (not KB pages, but useful): `docs/pocketbase.md` (full PocketBase setup),
`docs/macos-personal-release.md` (mac release), `docs/2026-04-19-content-planner-user-stories.md`
(old, pre-conveyor), `.design/DESIGN.md` (UI source of truth), `.agents/skills/*` (state, desktop, editor, testing).
