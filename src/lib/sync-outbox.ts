import {
  extractSyncableWorkspaceState,
  getNoteSummary,
  type PersistenceRecordKind,
  type PersistenceRecordMetadata,
  type SyncableWorkspaceState,
} from "@/lib/persistence";
import { getDailyPageKey, getTodoWorkspaceIdFromDailyPageKey } from "@/lib/store";
import type {
  AppState,
  ContentBoard,
  ContentCard,
  DailyPage,
  NoteFolder,
  NoteSummary,
  PlannerPreset,
  Todo,
} from "@/lib/types";

/**
 * Server-first sync.
 *
 * The server is the source of truth. A device never compares its whole copy
 * with the server; it only sends the records it changed itself, as queued
 * operations (the "outbox"). That makes it impossible for a device holding a
 * stale or incomplete copy to delete data it simply doesn't have — the bug that
 * wiped every daily page on 2026-10-07.
 */

export const WORKSPACE_RECORD_KEY = "workspace_state:self";

/**
 * More deletes than this in a single edit (that aren't explained by deleting
 * their parent folder) are treated as a bug, not a user action, and dropped.
 */
export const MAX_UNEXPLAINED_DELETES = 5;

export type SyncRecordValue =
  | { key: string; kind: "daily_page"; value: DailyPage }
  | { key: string; kind: "note"; value: NoteSummary }
  | { key: string; kind: "note_folder"; value: NoteFolder }
  | { key: string; kind: "planner_preset"; value: PlannerPreset }
  | { key: string; kind: "content_board"; value: ContentBoard }
  | { key: string; kind: "content_card"; value: ContentCard }
  | { key: string; kind: "workspace_state"; value: SyncableWorkspaceState };

export type SyncOp = {
  key: string;
  kind: PersistenceRecordKind;
  type: "upsert" | "delete";
  /** The value to write (for a delete: the last value this device had). */
  record: SyncRecordValue;
  /** What this device had before its first unsynced edit; null for a new record. */
  base: SyncRecordValue | null;
  /** The server's `updated_at_client` this device last saw; null if never seen. */
  baseUpdatedAtClient: string | null;
  /** When the edit happened on this device. */
  updatedAtClient: string;
};

export type ApplyOpResult =
  | { key: string; status: "written"; serverUpdatedAtClient: string | null }
  | {
      key: string;
      status: "merged";
      serverUpdatedAtClient: string | null;
      record: Extract<SyncRecordValue, { kind: "daily_page" }>;
    }
  | { key: string; status: "skipped"; reason: string }
  | { key: string; status: "failed"; errorMessage: string; offline: boolean };

export type OutboxStorage = {
  load(input: { userId: string }): SyncOp[];
  save(input: { userId: string; ops: SyncOp[] }): void;
  clear(input: { userId: string }): void;
};

export function getDailyPageRecordKey(workspaceId: string, date: string) {
  return `daily_page:${workspaceId}:${date}`;
}

export function getWorkspaceIdFromDailyPageRecordKey(key: string) {
  return key.split(":").slice(1, -1).join(":");
}

/** Key-order independent, so a value read back from PocketBase matches the local one. */
export function fingerprintSyncValue(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)))
      : item,
  );
}

export function getSyncRecordValuesFromState(state: AppState): Record<string, SyncRecordValue> {
  const values: Record<string, SyncRecordValue> = {};

  for (const [pageKey, page] of Object.entries(state.dailyPages)) {
    const key = getDailyPageRecordKey(getTodoWorkspaceIdFromDailyPageKey(pageKey), page.date);
    values[key] = { key, kind: "daily_page", value: page };
  }

  for (const [noteId, note] of Object.entries(state.notesDocs)) {
    const key = `note:${noteId}`;
    values[key] = { key, kind: "note", value: getNoteSummary(note) };
  }

  for (const [folderId, folder] of Object.entries(state.noteFolders)) {
    const key = `note_folder:${folderId}`;
    values[key] = { key, kind: "note_folder", value: folder };
  }

  for (const [presetId, preset] of Object.entries(state.plannerPresets)) {
    const key = `planner_preset:${presetId}`;
    values[key] = { key, kind: "planner_preset", value: preset };
  }

  values["content_board:self"] = {
    key: "content_board:self",
    kind: "content_board",
    value: state.contentBoard,
  };

  for (const [cardId, card] of Object.entries(state.contentCards)) {
    const key = `content_card:${cardId}`;
    values[key] = { key, kind: "content_card", value: card };
  }

  values[WORKSPACE_RECORD_KEY] = {
    key: WORKSPACE_RECORD_KEY,
    kind: "workspace_state",
    value: extractSyncableWorkspaceState(state),
  };

  return values;
}

function createOp(
  type: SyncOp["type"],
  record: SyncRecordValue,
  base: SyncRecordValue | null,
  serverRecords: Record<string, PersistenceRecordMetadata>,
  updatedAtClient: string,
): SyncOp {
  return {
    key: record.key,
    kind: record.kind,
    type,
    record,
    base,
    baseUpdatedAtClient: serverRecords[record.key]?.lastRemoteUpdatedAtClient ?? null,
    updatedAtClient,
  };
}

/**
 * Builds the operations for one local edit by comparing this device's state
 * before and after it. Never compares against the server.
 *
 * Safety rules:
 * - Daily pages are never deleted (history is append-only; the server also
 *   refuses such deletes). Emptying a page is an ordinary upsert.
 * - A note/folder delete caused by deleting its parent folder is "explained".
 *   More than MAX_UNEXPLAINED_DELETES unexplained deletes at once means the
 *   state was replaced or corrupted, so all deletes of that edit are dropped.
 */
export function diffSyncRecords({
  prev,
  next,
  serverRecords,
  now,
}: {
  prev: Record<string, SyncRecordValue>;
  next: Record<string, SyncRecordValue>;
  serverRecords: Record<string, PersistenceRecordMetadata>;
  now: string;
}): { ops: SyncOp[]; blockedDeletes: number } {
  const ops: SyncOp[] = [];

  for (const [key, record] of Object.entries(next)) {
    const before = prev[key];
    const fingerprint = fingerprintSyncValue(record.value);
    const changedHere = !before || fingerprintSyncValue(before.value) !== fingerprint;
    // Never send a record that is already identical on the server.
    if (changedHere && serverRecords[key]?.fingerprint !== fingerprint) {
      ops.push(createOp("upsert", record, before ?? null, serverRecords, now));
    }
  }

  const removed = Object.values(prev).filter(
    (record) => !next[record.key] && record.kind !== "daily_page",
  );
  const deletedFolderIds = new Set(
    removed.filter((record) => record.kind === "note_folder").map((record) => record.value.id),
  );
  const isExplained = (record: SyncRecordValue) =>
    (record.kind === "note" && record.value.folderId !== null && deletedFolderIds.has(record.value.folderId)) ||
    (record.kind === "note_folder" && record.value.parentId !== null && deletedFolderIds.has(record.value.parentId));
  const unexplained = removed.filter((record) => !isExplained(record)).length;

  if (unexplained > MAX_UNEXPLAINED_DELETES) {
    return { ops, blockedDeletes: removed.length };
  }

  for (const record of removed) {
    ops.push(createOp("delete", record, record, serverRecords, now));
  }

  return { ops, blockedDeletes: 0 };
}

/**
 * Records that exist in the freshly loaded (normalized) state but not on the
 * server at all — e.g. today's carried-over page or first-run defaults — need
 * to be created. Only creates, never deletes or overwrites.
 */
export function getMissingRecordOps({
  state,
  serverRecords,
  outbox,
  now,
}: {
  state: AppState;
  serverRecords: Record<string, PersistenceRecordMetadata>;
  outbox: SyncOp[];
  now: string;
}): SyncOp[] {
  const pendingKeys = new Set(outbox.map((op) => op.key));
  return Object.values(getSyncRecordValuesFromState(state))
    .filter((record) => !serverRecords[record.key] && !pendingKeys.has(record.key))
    .map((record) => createOp("upsert", record, null, serverRecords, now));
}

/**
 * Adds operations to the outbox, keeping one entry per record. The first
 * unsynced edit's base is kept so conflict merges compare against what the
 * device originally had. Deleting a record that never reached the server just
 * drops it from the outbox.
 */
export function enqueueOps(outbox: SyncOp[], ops: SyncOp[]): SyncOp[] {
  const byKey = new Map(outbox.map((op) => [op.key, op]));

  for (const op of ops) {
    const existing = byKey.get(op.key);
    if (!existing) {
      byKey.set(op.key, op);
      continue;
    }

    const neverReachedServer = existing.base === null && existing.baseUpdatedAtClient === null;
    if (op.type === "delete" && neverReachedServer) {
      byKey.delete(op.key);
      continue;
    }

    byKey.set(op.key, {
      ...op,
      base: existing.base,
      baseUpdatedAtClient: existing.baseUpdatedAtClient,
    });
  }

  return Array.from(byKey.values());
}

/** Puts one synced record into the state (used for outbox overlays and merge results). */
export function applySyncOpsToState(state: AppState, ops: Array<Pick<SyncOp, "type" | "record">>): AppState {
  let next = state;

  for (const { type, record } of ops) {
    if (record.kind === "daily_page") {
      const pageKey = getDailyPageKey(getWorkspaceIdFromDailyPageRecordKey(record.key), record.value.date);
      const dailyPages = { ...next.dailyPages };
      if (type === "delete") delete dailyPages[pageKey];
      else dailyPages[pageKey] = record.value;
      next = { ...next, dailyPages };
      continue;
    }

    if (record.kind === "note") {
      const notesDocs = { ...next.notesDocs };
      if (type === "delete") delete notesDocs[record.value.id];
      else notesDocs[record.value.id] = { ...record.value, markdown: next.notesDocs[record.value.id]?.markdown };
      next = { ...next, notesDocs };
      continue;
    }

    if (record.kind === "note_folder") {
      const noteFolders = { ...next.noteFolders };
      if (type === "delete") delete noteFolders[record.value.id];
      else noteFolders[record.value.id] = record.value;
      next = { ...next, noteFolders };
      continue;
    }

    if (record.kind === "planner_preset") {
      const plannerPresets = { ...next.plannerPresets };
      if (type === "delete") delete plannerPresets[record.value.id];
      else plannerPresets[record.value.id] = record.value;
      next = { ...next, plannerPresets };
      continue;
    }

    if (record.kind === "content_card") {
      const contentCards = { ...next.contentCards };
      if (type === "delete") delete contentCards[record.value.id];
      else contentCards[record.value.id] = record.value;
      next = { ...next, contentCards };
      continue;
    }

    if (type === "delete") continue;

    if (record.kind === "content_board") {
      next = { ...next, contentBoard: record.value };
      continue;
    }

    next = {
      ...next,
      todoWorkspaces: record.value.todoWorkspaces,
      uiState: { ...next.uiState, ...record.value.uiState },
    };
  }

  return next;
}

function sameTodo(left: Todo | undefined, right: Todo | undefined) {
  return fingerprintSyncValue(left) === fingerprintSyncValue(right);
}

/**
 * Merges a daily page that was changed both here and on another device.
 * Todos merge by id: this device's edits win per todo, todos added elsewhere
 * are kept, and a todo deleted on one side stays deleted unless the other side
 * edited it. The note text keeps whichever side changed; if both changed it,
 * both versions are kept so nothing is silently lost.
 */
export function mergeDailyPageConflict({
  base,
  local,
  server,
}: {
  base: DailyPage | null;
  local: DailyPage;
  server: DailyPage;
}): DailyPage {
  const baseById = new Map((base?.todos ?? []).map((todo) => [todo.id, todo]));
  const localById = new Map(local.todos.map((todo) => [todo.id, todo]));
  const serverById = new Map(server.todos.map((todo) => [todo.id, todo]));
  const todos: Todo[] = [];

  for (const localTodo of local.todos) {
    const baseTodo = baseById.get(localTodo.id);
    const serverTodo = serverById.get(localTodo.id);
    const changedHere = !baseTodo || !sameTodo(baseTodo, localTodo);

    if (changedHere) {
      todos.push(localTodo);
    } else if (serverTodo) {
      todos.push(serverTodo);
    }
    // Unchanged here and deleted on the server: stays deleted.
  }

  for (const serverTodo of server.todos) {
    if (localById.has(serverTodo.id)) continue;
    const baseTodo = baseById.get(serverTodo.id);
    const addedOnServer = !baseTodo;
    const editedOnServer = baseTodo !== undefined && !sameTodo(baseTodo, serverTodo);
    // Deleted here but edited on the server: keep the server's edit.
    if (addedOnServer || editedOnServer) {
      todos.push(serverTodo);
    }
  }

  const baseMarkdown = base?.markdown ?? "";
  let markdown: string;
  if (local.markdown === server.markdown || local.markdown === baseMarkdown) {
    markdown = server.markdown;
  } else if (server.markdown === baseMarkdown) {
    markdown = local.markdown;
  } else {
    markdown = `${server.markdown}\n\n---\n\n**Edited on two devices at once — both versions kept:**\n\n${local.markdown}`;
  }

  return { date: server.date, markdown, todos };
}

/** PocketBase returns "2026-10-07 10:14:55.542Z"; the client writes ISO. */
export function sameTimestamp(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return !left && !right;
  return Date.parse(left.replace(" ", "T")) === Date.parse(right.replace(" ", "T"));
}

const OUTBOX_KEY_PREFIX = "dailytodo.outbox.v1";

export function getOutboxStorageKey(userId: string) {
  return `${OUTBOX_KEY_PREFIX}.${userId}`;
}

function isSyncOp(value: unknown): value is SyncOp {
  if (!value || typeof value !== "object") return false;
  const op = value as Partial<SyncOp>;
  return (
    typeof op.key === "string" &&
    (op.type === "upsert" || op.type === "delete") &&
    typeof op.updatedAtClient === "string" &&
    Boolean(op.record && typeof op.record === "object")
  );
}

export function createBrowserOutboxStorage(): OutboxStorage {
  const memory = new Map<string, SyncOp[]>();

  return {
    load({ userId }) {
      try {
        const raw = window.localStorage.getItem(getOutboxStorageKey(userId));
        if (!raw) return memory.get(userId) ?? [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isSyncOp) : [];
      } catch {
        return memory.get(userId) ?? [];
      }
    },
    save({ userId, ops }) {
      memory.set(userId, ops);
      try {
        if (ops.length === 0) {
          window.localStorage.removeItem(getOutboxStorageKey(userId));
        } else {
          window.localStorage.setItem(getOutboxStorageKey(userId), JSON.stringify(ops));
        }
      } catch {
        // Storage unavailable (private mode): the in-memory copy still syncs this session.
      }
    },
    clear({ userId }) {
      memory.delete(userId);
      try {
        window.localStorage.removeItem(getOutboxStorageKey(userId));
      } catch {
        // Nothing to clear.
      }
    },
  };
}
