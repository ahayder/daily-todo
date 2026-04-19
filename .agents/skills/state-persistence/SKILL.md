---
name: state-persistence
description: >
  Apply the State & Persistence rules when modifying how data is saved, loaded,
  or synchronized in DailyTodoApp. Use this skill when dealing with PocketBase syncing,
  local browser caching, AppState definitions, pure state factories, or modifying Zod schemas.
  It ensures the split hybrid-sync architecture and data integrity are maintained.
---

# State & Persistence

> **This skill governs the hybrid sync and state management architecture of DailyTodoApp.** Follow these rules whenever adding new state, modifying Zod schemas, or changing how data saves/loads.

---

## 1. Hybrid Sync Architecture

DailyTodoApp uses a split persistence model:

1. **Browser Cache (IndexedDB)**: Fast local startup, offline availability, and device-local UI preferences. Managed by `src/lib/local-cache-storage.ts`.
2. **PocketBase Backend**: The authoritative sync layer for multi-device usage. Uses JSON structures for nested data. Managed by `src/lib/pocketbase/persistence-repository.ts`.
3. **Split Repository**: `src/lib/split-persistence-repository.ts` coordinates between the two, writing to the local cache immediately and dual-writing syncable data to PocketBase.

### PocketBase JSON Modeling

Instead of deeply nested relational tables, the app stores large state branches as JSON payloads in PocketBase to reduce latency and round-trips.
- Keep scalar fields (IDs, dates, owners, timestamps) top-level for querying and security rules.
- Keep nested arrays/objects (Daily Todos, Expanded Layouts, Planner Events) inside `_json` fields.

---

## 2. State Mutation Rules

The app uses React Context + `useReducer` for global state (`src/components/app-context.tsx`).

### Pure State Factories
All complex state transformations must be pure functions in `src/lib/store.ts`.
Do NOT write heavy reducer logic directly inside `app-context.tsx`. Send the action to a pure helper in `store.ts` and return the new state.

### Metadata Timestamps
Every data mutation must update the client timestamp to ensure the remote sync knows which version is newest.
Use `createPersistenceMetadata()` from `src/lib/persistence.ts` when resolving sync conflicts or updating base structures.

---

## 3. Modifying the Schema

Whenever you modify the `AppState` or entities like `DailyPage`, `NoteDoc`, or `Todo`:

1. **Update `src/lib/types.ts`**: Add your type definitions here first.
2. **Update `src/lib/schema.ts`**: You MUST update the Zod validators to match. The application strictly validates payload shapes on both load and save to prevent corruption.
3. **Update Factories**: Update `createInitialState` or default entity generators in `src/lib/store.ts` so new users get the right base structure.

---

## 4. Device-Local State vs. Remote State

Not everything syncs. Device-local preferences must NOT be pushed to PocketBase unless necessary.
- **Synced**: Notes, Daily Pages, Planner Presets, standard workspace navigation state.
- **Local Only**: Theme mode, font scaling, sidebar collapsed state, focus timer active state.

---

## 5. Checklist

Before merging persistence changes:
- [ ] Zod schema in `src/lib/schema.ts` matches new TS types perfectly.
- [ ] JSON mappings in `split-persistence-repository.ts` correctly serialize/deserialize the new fields.
- [ ] State mutations use pure functions in `src/lib/store.ts`.
- [ ] Unrelated local-ui states were not accidentally added to the sync payload.
