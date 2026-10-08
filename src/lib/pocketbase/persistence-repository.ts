import { createBrowserLocalCacheStorage } from "@/lib/local-cache-storage";
import { createRecentNoteBodiesStorage } from "@/lib/recent-note-bodies-storage";
import {
  extractLocalOnlyUIState,
  extractSyncableUIState,
  mergeUiState,
  parseAppStateOrThrow,
  seedAppState,
  type NoteBodyLoadResult,
  type NoteBodySaveResult,
  type PersistenceRecordKind,
  type PersistenceRecordMetadata,
  type ServerLoadResult,
  type SyncableUIState,
  type SyncableWorkspaceState,
} from "@/lib/persistence";
import { SplitPersistenceRepository, type SplitRemotePersistenceStore } from "@/lib/split-persistence-repository";
import { getPocketBaseClient } from "@/lib/pocketbase/client";
import {
  createBrowserOutboxStorage,
  fingerprintSyncValue,
  getWorkspaceIdFromDailyPageRecordKey,
  mergeDailyPageConflict,
  sameTimestamp,
  WORKSPACE_RECORD_KEY,
  type ApplyOpResult,
  type SyncOp,
  type SyncRecordValue,
} from "@/lib/sync-outbox";
import { DEFAULT_TODO_WORKSPACE_ID, getDailyPageKey } from "@/lib/store";
import type {
  AppState,
  ContentBoard,
  ContentCard,
  ContentLinks,
  DailyPage,
  NoteDoc,
  NoteFolder,
  NoteSummary,
  PlannerDayKey,
  PlannerPreset,
  TodoWorkspace,
} from "@/lib/types";

import { CONTENT_PLATFORMS } from "@/lib/types";

export { getSyncRecordValuesFromState } from "@/lib/sync-outbox";

type PocketBaseDailyPageRecord = {
  id: string;
  owner: string;
  date?: string;
  workspace_id?: string;
  markdown?: string;
  todos_json?: unknown;
  created?: string;
  updated?: string;
  updated_at_client?: string;
};

type PocketBaseNoteRecord = {
  id: string;
  owner: string;
  note_id?: string;
  title?: string;
  folder_id?: string | null;
  markdown?: string;
  updated?: string;
  updated_at_client?: string;
};

type PocketBaseNoteFolderRecord = {
  id: string;
  owner: string;
  folder_id?: string;
  name?: string;
  parent_folder_id?: string | null;
  updated?: string;
  updated_at_client?: string;
};

type PocketBasePlannerPresetRecord = {
  id: string;
  owner: string;
  preset_id?: string;
  name?: string;
  day_order_json?: unknown;
  days_json?: unknown;
  created?: string;
  updated?: string;
  updated_at_client?: string;
};

type PocketBaseContentBoardRecord = {
  id: string;
  owner: string;
  columns_json?: unknown;
  updated?: string;
  updated_at_client?: string;
};

type PocketBaseContentCardRecord = {
  id: string;
  owner: string;
  card_id?: string;
  column_id?: string;
  title?: string;
  notes?: string;
  position?: number;
  published_at?: string;
  links?: unknown;
  transcript?: string;
  updated?: string;
  updated_at_client?: string;
};

type PocketBaseWorkspaceStateRecord = {
  id: string;
  owner: string;
  selected_daily_date?: string | null;
  selected_todo_workspace_id?: string | null;
  todo_workspaces_json?: unknown;
  selected_note_id?: string | null;
  selected_note_folder_id?: string | null;
  selected_planner_preset_id?: string | null;
  expanded_years_json?: unknown;
  expanded_months_json?: unknown;
  last_view?: SyncableUIState["lastView"] | "daily";
  updated?: string;
  updated_at_client?: string;
};

/** The fields of a written/read row that the sync writer needs. */
type PocketBaseRow = {
  id: string;
  markdown?: string;
  todos_json?: unknown;
  date?: string;
  updated_at_client?: string;
};

const COLLECTION_BY_KIND: Record<PersistenceRecordKind, string> = {
  daily_page: "daily_pages",
  note: "notes",
  note_folder: "note_folders",
  planner_preset: "planner_presets",
  content_board: "content_boards",
  content_card: "content_cards",
  workspace_state: "workspace_state",
};

function isNetworkError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 0
  );
}

function describeWriteError(reason: unknown): string | null {
  if (!reason || typeof reason !== "object") {
    return typeof reason === "string" ? reason : null;
  }

  // PocketBase ClientResponseError carries per-field validation details under
  // response.data (e.g. { todos_json: { code, message } }). Prefer those, then
  // fall back to the top-level message.
  const response = (reason as { response?: unknown }).response;
  const data =
    response && typeof response === "object"
      ? (response as { data?: unknown }).data
      : undefined;
  if (data && typeof data === "object") {
    const fieldErrors = Object.entries(data as Record<string, unknown>)
      .map(([field, detail]) => {
        const message =
          detail && typeof detail === "object" && "message" in detail
            ? String((detail as { message?: unknown }).message ?? "")
            : "";
        return message ? `${field}: ${message}` : field;
      })
      .filter(Boolean);
    if (fieldErrors.length > 0) {
      return fieldErrors.join("; ");
    }
  }

  const message = (reason as { message?: unknown }).message;
  return typeof message === "string" && message ? message : null;
}

/** PocketBase returns "" for an unset date field; normalize to an ISO string or null. */
function normalizePocketBaseDate(value: string | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value.replace(" ", "T"));
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function normalizeContentLinks(value: unknown): ContentLinks | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const links: ContentLinks = {};
  for (const platform of CONTENT_PLATFORMS) {
    const url = (value as Record<string, unknown>)[platform];
    if (typeof url === "string" && url.trim()) links[platform] = url.trim();
  }
  return Object.keys(links).length > 0 ? links : null;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number" &&
    (error as { status: number }).status === 404
  );
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === "object" ? (value as Record<string, T>) : {};
}

function readPlannerDaysPayload(value: unknown) {
  const record = safeRecord<unknown>(value);
  if ("days" in record) {
    return {
      days: safeRecord<PlannerPreset["days"][PlannerDayKey]>(record.days),
      subtitle: typeof record.subtitle === "string" ? record.subtitle : null,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : null,
    };
  }

  return {
    days: record as PlannerPreset["days"],
    subtitle: null,
    createdAt: null,
  };
}

function createRecordMetadata(
  key: string,
  kind: PersistenceRecordKind,
  value: unknown,
  remoteUpdatedAt: string | null,
  remoteUpdatedAtClient: string | null,
): PersistenceRecordMetadata {
  return {
    key,
    kind,
    fingerprint: fingerprintSyncValue(value),
    lastRemoteUpdatedAt: remoteUpdatedAt,
    lastRemoteUpdatedAtClient: remoteUpdatedAtClient,
  };
}

function assembleStateFromValues(
  values: Record<string, SyncRecordValue>,
  localState: AppState | null,
  now: Date,
): AppState {
  const fallbackState = localState ?? seedAppState(now);
  const dailyPages: Record<string, DailyPage> = {};
  let todoWorkspaces: Record<string, TodoWorkspace> = fallbackState.todoWorkspaces;
  const notesDocs: Record<string, NoteDoc> = {};
  const noteFolders: Record<string, NoteFolder> = {};
  const plannerPresets: Record<string, PlannerPreset> = {};
  let contentBoard = fallbackState.contentBoard;
  const contentCards: Record<string, ContentCard> = {};
  let syncableUiState = extractSyncableUIState(fallbackState.uiState);

  for (const record of Object.values(values)) {
    if (record.kind === "daily_page") {
      const workspaceId = record.key.split(":").slice(1, -1).join(":");
      dailyPages[getDailyPageKey(workspaceId, record.value.date)] = record.value;
      continue;
    }

    if (record.kind === "note") {
      notesDocs[record.value.id] = {
        ...record.value,
        markdown: undefined,
      };
      continue;
    }

    if (record.kind === "note_folder") {
      noteFolders[record.value.id] = record.value;
      continue;
    }

    if (record.kind === "planner_preset") {
      plannerPresets[record.value.id] = record.value;
      continue;
    }

    if (record.kind === "content_board") {
      contentBoard = record.value;
      continue;
    }

    if (record.kind === "content_card") {
      contentCards[record.value.id] = record.value;
      continue;
    }

    todoWorkspaces = record.value.todoWorkspaces;
    syncableUiState = record.value.uiState;
  }

  return parseAppStateOrThrow(
    {
      dailyPages,
      todoWorkspaces,
      notesDocs,
      noteFolders,
      plannerPresets,
      contentBoard,
      contentCards,
      uiState: mergeUiState(
        syncableUiState,
        extractLocalOnlyUIState(fallbackState.uiState),
        fallbackState.uiState,
      ),
    },
    now,
  );
}

async function getFirstByFilter<T>(collection: string, filter: string): Promise<T | null> {
  const client = getPocketBaseClient();
  const list = await client.collection(collection).getList<T>(1, 1, { filter, requestKey: null });
  return list.items[0] ?? null;
}

class PocketBaseSplitRemoteStore implements SplitRemotePersistenceStore {
  async loadServerState({ userId, now = new Date() }: { userId: string; now?: Date }): Promise<ServerLoadResult> {
    const { values, records } = await this.loadServerRecords(userId);
    return {
      state: assembleStateFromValues(values, null, now),
      serverRecords: records,
    };
  }

  /**
   * Writes this device's queued changes one record at a time. Each op is
   * independent: a failure leaves that op queued for the next attempt, and a
   * network failure stops early (the rest would fail the same way).
   */
  async applyOps({ userId, ops }: { userId: string; ops: SyncOp[] }): Promise<ApplyOpResult[]> {
    const results: ApplyOpResult[] = [];

    for (const [index, op] of ops.entries()) {
      try {
        results.push(await this.applyOp(userId, op));
      } catch (error) {
        const errorMessage = describeWriteError(error) ?? "Couldn’t reach PocketBase.";
        if (isNetworkError(error)) {
          for (const remaining of ops.slice(index)) {
            results.push({
              key: remaining.key,
              status: "failed",
              errorMessage: "Sync is offline right now.",
              offline: true,
            });
          }
          break;
        }
        results.push({ key: op.key, status: "failed", errorMessage, offline: false });
      }
    }

    return results;
  }

  private async applyOp(userId: string, op: SyncOp): Promise<ApplyOpResult> {
    const client = getPocketBaseClient();
    const existing = await this.findRow(userId, op.record);

    if (op.type === "delete") {
      // Daily history is append-only; the server refuses these deletes too.
      if (op.kind === "daily_page") {
        return { key: op.key, status: "skipped", reason: "Daily pages are never deleted." };
      }
      if (existing) {
        await client.collection(COLLECTION_BY_KIND[op.kind]).delete(existing.id, { requestKey: null });
      }
      return { key: op.key, status: "written", serverUpdatedAtClient: null };
    }

    // Version check: if another device changed this page since this device last
    // saw it, merge instead of overwriting their edit.
    if (
      op.record.kind === "daily_page" &&
      existing &&
      !sameTimestamp(existing.updated_at_client, op.baseUpdatedAtClient)
    ) {
      const serverPage: DailyPage = {
        date: existing.date ?? op.record.value.date,
        markdown: existing.markdown ?? "",
        todos: safeArray(existing.todos_json),
      };

      if (fingerprintSyncValue(serverPage) !== fingerprintSyncValue(op.record.value)) {
        const merged = {
          ...op.record,
          value: mergeDailyPageConflict({
            base: op.base?.kind === "daily_page" ? op.base.value : null,
            local: op.record.value,
            server: serverPage,
          }),
        };
        const saved = await this.writeRow(userId, merged, op.updatedAtClient, existing);
        return {
          key: op.key,
          status: "merged",
          record: merged,
          serverUpdatedAtClient: saved.updated_at_client ?? null,
        };
      }
    }

    const saved = await this.writeRow(userId, op.record, op.updatedAtClient, existing);
    return { key: op.key, status: "written", serverUpdatedAtClient: saved.updated_at_client ?? null };
  }

  private async findRow(userId: string, record: SyncRecordValue): Promise<PocketBaseRow | null> {
    const client = getPocketBaseClient();
    const collection = COLLECTION_BY_KIND[record.kind];

    if (record.kind === "daily_page") {
      const workspaceId = getWorkspaceIdFromDailyPageRecordKey(record.key);
      // Legacy Main pages may be stored with an empty workspace_id.
      const filter =
        workspaceId === DEFAULT_TODO_WORKSPACE_ID
          ? client.filter('owner = {:owner} && date = {:date} && (workspace_id = {:workspace} || workspace_id = "")', {
              owner: userId,
              date: record.value.date,
              workspace: workspaceId,
            })
          : client.filter("owner = {:owner} && date = {:date} && workspace_id = {:workspace}", {
              owner: userId,
              date: record.value.date,
              workspace: workspaceId,
            });
      const list = await client
        .collection(collection)
        .getList<PocketBaseRow>(1, 1, { filter, sort: "-workspace_id", requestKey: null });
      return list.items[0] ?? null;
    }

    const idField: Partial<Record<PersistenceRecordKind, string>> = {
      note: "note_id",
      note_folder: "folder_id",
      planner_preset: "preset_id",
      content_card: "card_id",
    };
    const field = idField[record.kind];
    const filter = field
      ? client.filter(`owner = {:owner} && ${field} = {:id}`, {
          owner: userId,
          id: (record.value as { id: string }).id,
        })
      : client.filter("owner = {:owner}", { owner: userId });
    const list = await client.collection(collection).getList<PocketBaseRow>(1, 1, { filter, requestKey: null });
    return list.items[0] ?? null;
  }

  async loadNoteBody({
    userId,
    noteId,
  }: {
    userId: string;
    noteId: string;
  }): Promise<NoteBodyLoadResult> {
    try {
      const client = getPocketBaseClient();
      const record = await client
        .collection("notes")
        .getFirstListItem<PocketBaseNoteRecord>(`owner="${userId}" && note_id="${noteId}"`, {
          requestKey: null,
        });

      return {
        markdown: record.markdown ?? "",
        status: "ready",
        source: "remote",
        updatedAtClient: record.updated_at_client ?? record.updated ?? null,
        notice: null,
        errorMessage: null,
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          markdown: "",
          status: "ready",
          source: "remote",
          updatedAtClient: null,
          notice: null,
          errorMessage: null,
        };
      }

      return {
        markdown: null,
        status: "stale-offline",
        source: "none",
        updatedAtClient: null,
        notice: "This note isn’t cached on this device yet.",
        errorMessage: "Connect to the internet to load this note.",
      };
    }
  }

  async saveNoteBody({
    userId,
    noteId,
    markdown,
    updatedAtClient,
  }: {
    userId: string;
    noteId: string;
    markdown: string;
    updatedAtClient: string;
  }): Promise<NoteBodySaveResult> {
    try {
      const client = getPocketBaseClient();
      const existing = await getFirstByFilter<PocketBaseNoteRecord>(
        "notes",
        `owner="${userId}" && note_id="${noteId}"`,
      );

      if (existing) {
        await client.collection("notes").update(
          existing.id,
          {
            owner: userId,
            note_id: noteId,
            title: existing.title ?? "",
            folder_id: existing.folder_id ?? null,
            markdown,
            updated_at_client: updatedAtClient,
          },
          { requestKey: null },
        );
      } else {
        await client.collection("notes").create(
          {
            owner: userId,
            note_id: noteId,
            title: "Untitled Note",
            folder_id: null,
            markdown,
            updated_at_client: updatedAtClient,
          },
          { requestKey: null },
        );
      }

      return {
        markdown,
        updatedAtClient,
        status: "synced",
        notice: null,
        errorMessage: null,
      };
    } catch {
      return {
        markdown,
        updatedAtClient,
        status: "offline",
        notice: "PocketBase is unavailable, so your changes are saved on this device.",
        errorMessage: "Sync is offline right now.",
      };
    }
  }

  /** Reads every record the user has. Never writes. */
  private async loadServerRecords(userId: string): Promise<{
    values: Record<string, SyncRecordValue>;
    records: Record<string, PersistenceRecordMetadata>;
  }> {
    const client = getPocketBaseClient();
    const [dailyPages, notes, noteFolders, plannerPresets, contentBoard, contentCards, workspaceState] =
      await Promise.all([
      client
        .collection("daily_pages")
        .getFullList<PocketBaseDailyPageRecord>({ filter: `owner="${userId}"`, requestKey: null }),
      client.collection("notes").getFullList<PocketBaseNoteRecord>({ filter: `owner="${userId}"`, requestKey: null }),
      client
        .collection("note_folders")
        .getFullList<PocketBaseNoteFolderRecord>({ filter: `owner="${userId}"`, requestKey: null }),
      client
        .collection("planner_presets")
        .getFullList<PocketBasePlannerPresetRecord>({ filter: `owner="${userId}"`, requestKey: null }),
      getFirstByFilter<PocketBaseContentBoardRecord>("content_boards", `owner="${userId}"`),
      client
        .collection("content_cards")
        .getFullList<PocketBaseContentCardRecord>({ filter: `owner="${userId}"`, requestKey: null }),
      getFirstByFilter<PocketBaseWorkspaceStateRecord>("workspace_state", `owner="${userId}"`),
    ]);

    const values: Record<string, SyncRecordValue> = {};
    const records: Record<string, PersistenceRecordMetadata> = {};

    for (const record of dailyPages) {
      if (!record.date) continue;
      const workspaceId = record.workspace_id || DEFAULT_TODO_WORKSPACE_ID;
      const value: DailyPage = {
        date: record.date,
        markdown: record.markdown ?? "",
        todos: safeArray(record.todos_json),
      };
      const key = `daily_page:${workspaceId}:${record.date}`;
      values[key] = { key, kind: "daily_page", value };
      records[key] = createRecordMetadata(
        key,
        "daily_page",
        value,
        record.updated ?? null,
        record.updated_at_client ?? null,
      );
    }

    for (const record of notes) {
      if (!record.note_id) continue;
      const value: NoteSummary = {
        id: record.note_id,
        title: record.title ?? "",
        folderId: record.folder_id ?? null,
        updatedAt: record.updated_at_client ?? record.updated ?? new Date(0).toISOString(),
      };
      const key = `note:${record.note_id}`;
      values[key] = { key, kind: "note", value };
      records[key] = createRecordMetadata(
        key,
        "note",
        value,
        record.updated ?? null,
        record.updated_at_client ?? null,
      );
    }

    for (const record of noteFolders) {
      if (!record.folder_id) continue;
      const value: NoteFolder = {
        id: record.folder_id,
        name: record.name ?? "New Folder",
        parentId: record.parent_folder_id ?? null,
        updatedAt: record.updated_at_client ?? record.updated ?? new Date(0).toISOString(),
      };
      const key = `note_folder:${record.folder_id}`;
      values[key] = { key, kind: "note_folder", value };
      records[key] = createRecordMetadata(
        key,
        "note_folder",
        value,
        record.updated ?? null,
        record.updated_at_client ?? null,
      );
    }

    for (const record of plannerPresets) {
      if (!record.preset_id) continue;
      const updatedAt = record.updated_at_client ?? record.updated ?? new Date(0).toISOString();
      const plannerPayload = readPlannerDaysPayload(record.days_json);
      const value: PlannerPreset = {
        id: record.preset_id,
        name: record.name ?? "Balanced Week",
        subtitle:
          plannerPayload.subtitle ??
          "Shape a reusable weekly rhythm around the things that matter most.",
        dayOrder: safeArray(record.day_order_json),
        days: plannerPayload.days,
        createdAt: plannerPayload.createdAt ?? record.created ?? updatedAt,
        updatedAt,
      };
      const key = `planner_preset:${record.preset_id}`;
      values[key] = { key, kind: "planner_preset", value };
      records[key] = createRecordMetadata(
        key,
        "planner_preset",
        value,
        record.updated ?? null,
        record.updated_at_client ?? null,
      );
    }

    if (contentBoard) {
      const value: ContentBoard = {
        columns: safeArray(contentBoard.columns_json),
        updatedAt:
          contentBoard.updated_at_client ?? contentBoard.updated ?? new Date(0).toISOString(),
      };
      const key = "content_board:self";
      values[key] = { key, kind: "content_board", value };
      records[key] = createRecordMetadata(
        key,
        "content_board",
        value,
        contentBoard.updated ?? null,
        contentBoard.updated_at_client ?? null,
      );
    }

    for (const record of contentCards) {
      if (!record.card_id || !record.column_id || !record.title) continue;
      const links = normalizeContentLinks(record.links);
      const value: ContentCard = {
        id: record.card_id,
        columnId: record.column_id,
        title: record.title,
        notes: record.notes ?? "",
        order: Math.max(0, Math.trunc(record.position ?? 0)),
        updatedAt: record.updated_at_client ?? record.updated ?? new Date(0).toISOString(),
        publishedAt: normalizePocketBaseDate(record.published_at),
        // Only present when filled, so older cards keep their exact shape.
        ...(links ? { links } : {}),
        ...(record.transcript ? { transcript: record.transcript } : {}),
      };
      const key = `content_card:${record.card_id}`;
      values[key] = { key, kind: "content_card", value };
      records[key] = createRecordMetadata(
        key,
        "content_card",
        value,
        record.updated ?? null,
        record.updated_at_client ?? null,
      );
    }

    if (workspaceState) {
      const value: SyncableWorkspaceState = {
        todoWorkspaces: safeRecord<TodoWorkspace>(workspaceState.todo_workspaces_json),
        uiState: {
          selectedDailyDate: workspaceState.selected_daily_date ?? null,
          selectedTodoWorkspaceId:
            workspaceState.selected_todo_workspace_id ?? DEFAULT_TODO_WORKSPACE_ID,
          selectedNoteId: workspaceState.selected_note_id ?? null,
          selectedNoteFolderId: workspaceState.selected_note_folder_id ?? null,
          selectedPlannerPresetId: workspaceState.selected_planner_preset_id ?? null,
          expandedYears: safeArray(workspaceState.expanded_years_json),
          expandedMonths: safeArray(workspaceState.expanded_months_json),
          lastView: workspaceState.last_view === "daily" ? "todos" : workspaceState.last_view ?? "todos",
        },
      };
      values[WORKSPACE_RECORD_KEY] = { key: WORKSPACE_RECORD_KEY, kind: "workspace_state", value };
      records[WORKSPACE_RECORD_KEY] = createRecordMetadata(
        WORKSPACE_RECORD_KEY,
        "workspace_state",
        value,
        workspaceState.updated ?? null,
        workspaceState.updated_at_client ?? null,
      );
    }

    return { values, records };
  }

  private async writeRow(
    userId: string,
    record: SyncRecordValue,
    updatedAtClient: string,
    existing: PocketBaseRow | null,
  ): Promise<PocketBaseRow> {
    const client = getPocketBaseClient();

    if (record.kind === "daily_page") {
      const workspaceId = record.key.split(":").slice(1, -1).join(":");
      const payload = {
        owner: userId,
        workspace_id: workspaceId,
        date: record.value.date,
        markdown: record.value.markdown,
        todos_json: record.value.todos,
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        return client.collection("daily_pages").update<PocketBaseRow>(existing.id, payload, { requestKey: null });
      } else {
        return client.collection("daily_pages").create<PocketBaseRow>(payload, { requestKey: null });
      }
    }

    if (record.kind === "note") {
      const payload = {
        owner: userId,
        note_id: record.value.id,
        title: record.value.title,
        folder_id: record.value.folderId,
        markdown: existing?.markdown ?? "",
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        return client.collection("notes").update<PocketBaseRow>(existing.id, payload, { requestKey: null });
      } else {
        return client.collection("notes").create<PocketBaseRow>(payload, { requestKey: null });
      }
    }

    if (record.kind === "note_folder") {
      const payload = {
        owner: userId,
        folder_id: record.value.id,
        name: record.value.name,
        parent_folder_id: record.value.parentId,
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        return client.collection("note_folders").update<PocketBaseRow>(existing.id, payload, { requestKey: null });
      } else {
        return client.collection("note_folders").create<PocketBaseRow>(payload, { requestKey: null });
      }
    }

    if (record.kind === "planner_preset") {
      const payload = {
        owner: userId,
        preset_id: record.value.id,
        name: record.value.name,
        day_order_json: record.value.dayOrder,
        days_json: {
          days: record.value.days,
          subtitle: record.value.subtitle,
          createdAt: record.value.createdAt,
        },
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        return client.collection("planner_presets").update<PocketBaseRow>(existing.id, payload, { requestKey: null });
      } else {
        return client.collection("planner_presets").create<PocketBaseRow>(payload, { requestKey: null });
      }
    }

    if (record.kind === "content_board") {
      const payload = {
        owner: userId,
        columns_json: record.value.columns,
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        return client.collection("content_boards").update<PocketBaseRow>(existing.id, payload, { requestKey: null });
      } else {
        return client.collection("content_boards").create<PocketBaseRow>(payload, { requestKey: null });
      }
    }

    if (record.kind === "content_card") {
      const payload = {
        owner: userId,
        card_id: record.value.id,
        column_id: record.value.columnId,
        title: record.value.title,
        notes: record.value.notes,
        position: record.value.order,
        // Empty string clears the optional date field in PocketBase.
        published_at: record.value.publishedAt ?? "",
        links: record.value.links ?? {},
        transcript: record.value.transcript ?? "",
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        return client.collection("content_cards").update<PocketBaseRow>(existing.id, payload, { requestKey: null });
      } else {
        return client.collection("content_cards").create<PocketBaseRow>(payload, { requestKey: null });
      }
    }

    const payload = {
      owner: userId,
      selected_daily_date: record.value.uiState.selectedDailyDate,
      selected_todo_workspace_id: record.value.uiState.selectedTodoWorkspaceId,
      todo_workspaces_json: record.value.todoWorkspaces,
      selected_note_id: record.value.uiState.selectedNoteId,
      selected_note_folder_id: record.value.uiState.selectedNoteFolderId,
      selected_planner_preset_id: record.value.uiState.selectedPlannerPresetId,
      expanded_years_json: record.value.uiState.expandedYears,
      expanded_months_json: record.value.uiState.expandedMonths,
      last_view: record.value.uiState.lastView,
      updated_at_client: updatedAtClient,
    };
    if (existing) {
      return client.collection("workspace_state").update<PocketBaseRow>(existing.id, payload, { requestKey: null });
    } else {
      return client.collection("workspace_state").create<PocketBaseRow>(payload, { requestKey: null });
    }
  }

}

export function createPocketBasePersistenceRepository() {
  return new SplitPersistenceRepository(
    new PocketBaseSplitRemoteStore(),
    createBrowserLocalCacheStorage(),
    createBrowserOutboxStorage(),
    createRecentNoteBodiesStorage(),
  );
}
