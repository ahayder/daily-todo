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
| [mcp-server.md](mcp-server.md) | `mcp-server/` MCP server for ChatGPT/Claude (Content Planner, app notes, external brain): 49 tools, change history + undo, secret-URL auth, token login, Coolify deploy | Editing the MCP server, its tools, or content card/board fields |
| [external-brain.md](external-brain.md) | Tasks, decisions, projects, meetings, follow-ups, repeats + append-only `change_log`: schema, `src/lib/memory/` helpers, app state + sync, Today (`/today`) and History (`/history`) screens, app-side undo/redo | Today/History/Memory UI, MCP task/memory tools, undo of AI or app changes |
| [app-notes.md](app-notes.md) | "Note for the app" quick capture (⌘⇧I): dialog, `app_notes` sync, soft-delete only, Base UI dialog traps | App notes, adding a never-deleted record kind, undo/Esc inside a modal |
| [auth.md](auth.md) | PocketBase auth, dev workspace, dev auto-login, account menu, super-admin | Login, accounts, dev/test tools |
| [desktop.md](desktop.md) | Tauri shell, updater, releases | Desktop app or releases |
| [testing.md](testing.md) | Vitest, how to check UI in the browser | Writing tests or verifying UI |
| [ui-design.md](ui-design.md) | Pointers to DESIGN.md, UI skills (inventory), ui-qa agent, ConfirmDialog, sync pill, Tailwind v4 layer trap | Any UI change |
| [user-needs.md](user-needs.md) | How the user really works (2026-10-14 interview), life areas, "chat captures, the app shows" redesign (Today · Memory · Content, mockups + plan), Office Companion fold-in | Redesigning Todos, Daily Planner, Notes, home screen, nudges; MCP task/memory tools |
| [decisions.md](decisions.md) | Product decisions the user made (and what they declined) | Before adding features or changing behavior |
| [dev-environment.md](dev-environment.md) | Git identity, scripts, env files | Committing, pushing, running scripts |

Other docs (not KB pages, but useful): `docs/pocketbase.md` (full PocketBase setup),
`docs/macos-personal-release.md` (mac release), `docs/2026-04-19-content-planner-user-stories.md`
(old, pre-conveyor), `.design/DESIGN.md` (UI source of truth), `.agents/skills/*` (state, desktop, editor, testing).
