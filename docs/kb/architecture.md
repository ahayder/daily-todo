# Architecture
Last verified: 2026-10-30

Next.js 16 App Router web app (also wrapped by a Tauri desktop shell). All app state lives in one
React `useReducer` + Context (`AppProvider`), synced to PocketBase record-by-record.

## How it works
- Routes: `src/app/today`, `history`, `memory`, `memory/project` (`?id=`; no dynamic segments because of static export), `standup`, `todos`, `notes`, `planner` (only redirects to `/today?editPlan=1`), `content-planner`, `auth/reset`; `src/app/page.tsx` redirects to `/today`. `ViewMode` includes `"today" | "history" | "memory" | "project" | "standup"` (`last_view` is a text field; old clients normalize unknown values to todos).
- State: `src/components/app/` — `app-provider.tsx`, `app-context.reducer.ts` (all actions), `use-app-persistence-state.ts` (load/sync phases, see [sync-persistence.md](sync-persistence.md)).
- Pure logic in `src/lib/`: `store.ts` (state factories, selectors, carryover, content-board defaults/migration), `content-conveyor.ts`, `planner-now.ts`, `task-attention.ts`, `date.ts`, `schema.ts` (Zod for persisted state), `types.ts` (all types).
- Persistence: `persistence.ts` (normalize, `parseAppStateOrThrow`), `sync-outbox.ts`, `split-persistence-repository.ts`, `local-cache-storage.ts`, `pocketbase/` (auth + persistence repositories).
- Shell: `src/components/workspace/` (providers, top navbar, sidebar, desktop updater, `workspace.tsx`). Todos/Notes have the sidebar; Today, History, Memory, Project, Standup, Planner and Content Planner are full-width, no sidebar toggle (the `isPlanner` branch in `workspace.tsx`).
- UI layers: `components/ui` (Base UI primitives), `components/blocks` (shared blocks), `components/signature` (product elements). See [ui-design.md](ui-design.md).

### State shape
```ts
AppState {
  dailyPages: Record<workspaceDateKey, DailyPage> // Main keeps legacy date-only keys
  todoWorkspaces: Record<id, TodoWorkspace>
  notesDocs: Record<id, NoteDoc>
  noteFolders: Record<id, NoteFolder>
  plannerPresets: Record<id, PlannerPreset>
  contentBoard: ContentBoard
  contentCards: Record<id, ContentCard>
  memory: MemoryData // tasks, decisions, projects, meetings, follow-ups, repeats (external-brain.md)
  changeLog: Record<id, ChangeLogEntry> // newest 300 loaded
  uiState: UIState // synced selection, focus timer + device prefs
}
DailyPage { date, markdown, todos[] }
TodoWorkspace { id, name, createdAt, updatedAt }
NoteDoc { id, folderId, title, markdown, updatedAt }
NoteFolder { id, parentId, name }
PlannerPreset { id, name, subtitle, dayOrder[], days, createdAt, updatedAt }
PlannerDay { key, title, purposes[], events[] }
PlannerPurpose { id, title, color, targetMinutes, role, notes }
PlannerEvent { id, purposeId, dayKey, startMinutes, endMinutes, title, color, notes }
ContentBoard { columns: ContentColumn[], updatedAt }
ContentColumn { id, title, subtitle }
ContentCard { id, columnId, title, notes, order, updatedAt, publishedAt?, links?, transcript? }
Todo { id, text, status, priority, estimatedMinutes, parentId }
```

## Gotchas
- Device-local UI state (theme, sidebar collapsed, content font scale, focus mode) stays in local storage; don't move it to PocketBase without a strong cross-device reason.
- Storage strategy: scalar/relation fields for ownership, ids, titles, timestamps; JSON fields for nested parent-owned data (daily todos, planner days/events, small UI arrays).
- `src/components/content-planner-view.tsx` is just a compatibility re-export.

## Related
[sync-persistence.md](sync-persistence.md), [pocketbase.md](pocketbase.md)
