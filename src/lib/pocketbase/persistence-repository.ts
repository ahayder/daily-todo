import { createBrowserLocalCacheStorage } from "@/lib/local-cache-storage";
import { createRecentNoteBodiesStorage } from "@/lib/recent-note-bodies-storage";
import { toISODate } from "@/lib/date";
import {
  APP_STATE_VERSION,
  compareTimestamps,
  createPersistenceMetadata,
  extractLocalOnlyUIState,
  extractSyncableUIState,
  extractSyncableWorkspaceState,
  getMaxTimestamp,
  getNoteSummary,
  mergeUiState,
  normalizeAppState,
  seedAppState,
  type NoteBodyLoadResult,
  type NoteBodySaveResult,
  type PersistenceConflictResolution,
  type PersistenceLoadResult,
  type PersistenceMetadata,
  type PersistenceRecordKind,
  type PersistenceRecordMetadata,
  type PersistenceSaveResult,
  type RemoteAppStateStore,
  type RemoteSnapshot,
  type SyncableUIState,
  type SyncableWorkspaceState,
} from "@/lib/persistence";
import { SplitPersistenceRepository, type SplitRemotePersistenceStore } from "@/lib/split-persistence-repository";
import { getPocketBaseClient } from "@/lib/pocketbase/client";
import {
  createCarryoverDailyPage,
  DEFAULT_TODO_WORKSPACE_ID,
  getDailyPageKey,
  getTodoWorkspaceIdFromDailyPageKey,
} from "@/lib/store";
import type {
  AppState,
  ContentBoard,
  ContentCard,
  DailyPage,
  NoteDoc,
  NoteFolder,
  NoteSummary,
  PlannerDayKey,
  PlannerPreset,
  TodoWorkspace,
} from "@/lib/types";

const WORKSPACE_RECORD_KEY = "workspace_state:self";

type PocketBaseSnapshotRecord = {
  id: string;
  state_json?: unknown;
  state_version?: number;
  updated?: string;
  updated_at_client?: string;
};

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

type SyncRecordValue =
  | { key: string; kind: "daily_page"; value: DailyPage }
  | { key: string; kind: "note"; value: NoteSummary }
  | { key: string; kind: "note_folder"; value: NoteFolder }
  | { key: string; kind: "planner_preset"; value: PlannerPreset }
  | { key: string; kind: "content_board"; value: ContentBoard }
  | { key: string; kind: "content_card"; value: ContentCard }
  | { key: string; kind: "workspace_state"; value: SyncableWorkspaceState };

type SplitWorkspaceRawRecords = {
  dailyPages: Map<string, PocketBaseDailyPageRecord>;
  notes: Map<string, PocketBaseNoteRecord>;
  noteFolders: Map<string, PocketBaseNoteFolderRecord>;
  plannerPresets: Map<string, PocketBasePlannerPresetRecord>;
  contentBoard: PocketBaseContentBoardRecord | null;
  contentCards: Map<string, PocketBaseContentCardRecord>;
  workspaceState: PocketBaseWorkspaceStateRecord | null;
};

type SplitWorkspacePayload = {
  state: AppState;
  records: Record<string, PersistenceRecordMetadata>;
  rawRecords: SplitWorkspaceRawRecords;
  hasData: boolean;
  hasRepairedDailyPage: boolean;
};

export function hasUnsavedDailyPage(
  state: AppState,
  records: Record<string, PersistenceRecordMetadata>,
): boolean {
  return Object.keys(state.dailyPages).some((pageKey) => {
    const workspaceId = getTodoWorkspaceIdFromDailyPageKey(pageKey);
    const page = state.dailyPages[pageKey];
    const workspaceRecord = records[`daily_page:${workspaceId}:${page.date}`];
    const legacyMainRecord =
      workspaceId === DEFAULT_TODO_WORKSPACE_ID
        ? records[`daily_page:${page.date}`]
        : null;
    return !workspaceRecord && !legacyMainRecord;
  });
}

export function isUntouchedEmptyDailyPage(
  page: DailyPage,
  created: string | null | undefined,
  updated: string | null | undefined,
): boolean {
  const createdAt = created ? Date.parse(created) : Number.NaN;
  const updatedAt = updated ? Date.parse(updated) : Number.NaN;

  return (
    page.markdown.trim() === "" &&
    page.todos.length === 0 &&
    Number.isFinite(createdAt) &&
    Number.isFinite(updatedAt) &&
    Math.abs(updatedAt - createdAt) <= 1000
  );
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

function stableFingerprint(value: unknown): string {
  return JSON.stringify(value);
}

function toSnapshot(record: PocketBaseSnapshotRecord): RemoteSnapshot {
  return {
    state: record.state_json ?? null,
    stateVersion: record.state_version ?? APP_STATE_VERSION,
    updatedAt: record.updated ?? null,
    updatedAtClient: record.updated_at_client ?? null,
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
    fingerprint: stableFingerprint(value),
    lastRemoteUpdatedAt: remoteUpdatedAt,
    lastRemoteUpdatedAtClient: remoteUpdatedAtClient,
  };
}

export function getSyncRecordValuesFromState(
  state: AppState,
): Record<string, SyncRecordValue> {
  const values: Record<string, SyncRecordValue> = {};

  for (const [pageKey, page] of Object.entries(state.dailyPages)) {
    const workspaceId = getTodoWorkspaceIdFromDailyPageKey(pageKey);
    const key = `daily_page:${workspaceId}:${page.date}`;
    values[key] = {
      key,
      kind: "daily_page",
      value: page,
    };
  }

  for (const [noteId, note] of Object.entries(state.notesDocs)) {
    values[`note:${noteId}`] = {
      key: `note:${noteId}`,
      kind: "note",
      value: getNoteSummary(note),
    };
  }

  for (const [folderId, folder] of Object.entries(state.noteFolders)) {
    values[`note_folder:${folderId}`] = {
      key: `note_folder:${folderId}`,
      kind: "note_folder",
      value: folder,
    };
  }

  for (const [presetId, preset] of Object.entries(state.plannerPresets)) {
    values[`planner_preset:${presetId}`] = {
      key: `planner_preset:${presetId}`,
      kind: "planner_preset",
      value: preset,
    };
  }

  values["content_board:self"] = {
    key: "content_board:self",
    kind: "content_board",
    value: state.contentBoard,
  };

  for (const [cardId, card] of Object.entries(state.contentCards)) {
    values[`content_card:${cardId}`] = {
      key: `content_card:${cardId}`,
      kind: "content_card",
      value: card,
    };
  }

  values[WORKSPACE_RECORD_KEY] = {
    key: WORKSPACE_RECORD_KEY,
    kind: "workspace_state",
    value: extractSyncableWorkspaceState(state),
  };

  return values;
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

  return normalizeAppState(
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

function buildMetadataFromRemote(
  state: AppState,
  remoteRecords: Record<string, PersistenceRecordMetadata>,
  overrides: Partial<PersistenceMetadata> = {},
): PersistenceMetadata {
  const stateValues = getSyncRecordValuesFromState(state);
  const mergedRecords: Record<string, PersistenceRecordMetadata> = {};

  for (const [key, record] of Object.entries(stateValues)) {
    const remote = remoteRecords[key];
    mergedRecords[key] = createRecordMetadata(
      key,
      record.kind,
      record.value,
      remote?.lastRemoteUpdatedAt ?? null,
      remote?.lastRemoteUpdatedAtClient ?? null,
    );
  }

  return createPersistenceMetadata({
    records: mergedRecords,
    lastRemoteUpdatedAt: getMaxTimestamp(
      Object.values(mergedRecords).map((record) => record.lastRemoteUpdatedAt),
    ),
    lastRemoteUpdatedAtClient: getMaxTimestamp(
      Object.values(mergedRecords).map((record) => record.lastRemoteUpdatedAtClient),
    ),
    hasMigratedToSplitStore: true,
    ...overrides,
  });
}

function toLoadResult(
  state: AppState,
  metadata: PersistenceMetadata,
  input: {
    source: PersistenceLoadResult["source"];
    status: PersistenceLoadResult["status"];
    conflictResolution: PersistenceConflictResolution;
    notice: string | null;
    errorMessage: string | null;
    persistenceAvailable: boolean;
  },
): PersistenceLoadResult {
  return {
    state,
    metadata,
    source: input.source,
    status: input.status,
    conflictResolution: input.conflictResolution,
    notice: input.notice,
    errorMessage: input.errorMessage,
    persistenceAvailable: input.persistenceAvailable,
  };
}

async function getFirstByFilter<T>(collection: string, filter: string): Promise<T | null> {
  const client = getPocketBaseClient();
  const list = await client.collection(collection).getList<T>(1, 1, { filter, requestKey: null });
  return list.items[0] ?? null;
}

class PocketBaseSnapshotStore implements RemoteAppStateStore {
  async loadSnapshot({ userId }: { userId: string }): Promise<RemoteSnapshot | null> {
    const client = getPocketBaseClient();

    try {
      const record = await client
        .collection("app_state_snapshots")
        .getFirstListItem<PocketBaseSnapshotRecord>(`owner="${userId}"`, { requestKey: null });

      return toSnapshot(record);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async saveSnapshot({
    userId,
    state,
    updatedAtClient,
    knownRemoteUpdatedAt,
  }: {
    userId: string;
    state: AppState;
    updatedAtClient: string;
    knownRemoteUpdatedAt?: string | null;
  }): Promise<RemoteSnapshot> {
    const client = getPocketBaseClient();
    const payload = {
      owner: userId,
      state_json: state,
      state_version: APP_STATE_VERSION,
      updated_at_client: updatedAtClient,
    };

    try {
      const existing = await client
        .collection("app_state_snapshots")
        .getFirstListItem<PocketBaseSnapshotRecord>(`owner="${userId}"`, { requestKey: null });

      if (knownRemoteUpdatedAt && existing.updated && existing.updated !== knownRemoteUpdatedAt) {
        return toSnapshot(existing);
      }

      const updated = await client
        .collection("app_state_snapshots")
        .update<PocketBaseSnapshotRecord>(existing.id, payload, { requestKey: null });

      return toSnapshot(updated);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }

      const created = await client
        .collection("app_state_snapshots")
        .create<PocketBaseSnapshotRecord>(payload, { requestKey: null });

      return toSnapshot(created);
    }
  }
}

class PocketBaseSplitRemoteStore implements SplitRemotePersistenceStore {
  private readonly legacySnapshotStore = new PocketBaseSnapshotStore();

  async loadRemoteState({
    userId,
    cachedEnvelope,
    cacheAvailable,
    now = new Date(),
  }: {
    userId: string;
    cachedEnvelope: { state: AppState; metadata: PersistenceMetadata } | null;
    cacheAvailable: boolean;
    now?: Date;
  }): Promise<PersistenceLoadResult> {
    const splitPayload = await this.loadSplitWorkspaceState(userId, cachedEnvelope?.state ?? null, now);

    if (splitPayload.hasData) {
      const shouldBackfillDailyPage = hasUnsavedDailyPage(
        splitPayload.state,
        splitPayload.records,
      );

      if (
        !splitPayload.records["content_board:self"] ||
        shouldBackfillDailyPage ||
        splitPayload.hasRepairedDailyPage
      ) {
        const backfilled = await this.saveRemoteState({
          userId,
          state: splitPayload.state,
          metadata: createPersistenceMetadata({
            ...buildMetadataFromRemote(splitPayload.state, splitPayload.records),
            lastLocalMutationAt: now.toISOString(),
          }),
          now,
        });
        return toLoadResult(backfilled.resolvedState ?? splitPayload.state, backfilled.metadata, {
          source: cachedEnvelope ? "local" : "remote",
          status: backfilled.status,
          conflictResolution: backfilled.conflictResolution,
          notice: backfilled.notice,
          errorMessage: backfilled.errorMessage,
          persistenceAvailable: cacheAvailable,
        });
      }

      const resolved = await this.reconcileSplitState(
        userId,
        splitPayload,
        cachedEnvelope,
        cacheAvailable,
        now,
      );
      return resolved;
    }

    const legacySnapshot = await this.legacySnapshotStore.loadSnapshot({ userId });

    if (legacySnapshot) {
      const legacyState = normalizeAppState(legacySnapshot.state, now);
      const state = normalizeAppState(
        {
          ...legacyState,
          uiState: mergeUiState(
            extractSyncableUIState(legacyState.uiState),
            extractLocalOnlyUIState((cachedEnvelope?.state ?? legacyState).uiState),
            (cachedEnvelope?.state ?? legacyState).uiState,
          ),
        },
        now,
      );

      const migrationSeedMetadata = createPersistenceMetadata({
        lastLocalMutationAt:
          cachedEnvelope &&
          compareTimestamps(cachedEnvelope.metadata.lastLocalMutationAt, legacySnapshot.updatedAtClient) > 0
            ? cachedEnvelope.metadata.lastLocalMutationAt
            : legacySnapshot.updatedAtClient ?? now.toISOString(),
        lastRemoteUpdatedAt: legacySnapshot.updatedAt,
        lastRemoteUpdatedAtClient: legacySnapshot.updatedAtClient,
      });

      const migrated = await this.saveRemoteState({
        userId,
        state:
          cachedEnvelope &&
          compareTimestamps(cachedEnvelope.metadata.lastLocalMutationAt, legacySnapshot.updatedAtClient) > 0
            ? cachedEnvelope.state
            : state,
        metadata: migrationSeedMetadata,
        now,
      });

      const resolvedState = migrated.resolvedState ?? state;

      return toLoadResult(resolvedState, migrated.metadata, {
        source:
          cachedEnvelope &&
          compareTimestamps(cachedEnvelope.metadata.lastLocalMutationAt, legacySnapshot.updatedAtClient) > 0
            ? "local"
            : "remote",
        status: migrated.status,
        conflictResolution: migrated.conflictResolution,
        notice: migrated.notice,
        errorMessage: migrated.errorMessage,
        persistenceAvailable: cacheAvailable,
      });
    }

    if (cachedEnvelope) {
      const saved = await this.saveRemoteState({
        userId,
        state: cachedEnvelope.state,
        metadata: cachedEnvelope.metadata,
        now,
      });

      return toLoadResult(saved.resolvedState ?? cachedEnvelope.state, saved.metadata, {
        source: "local",
        status: saved.status,
        conflictResolution: saved.conflictResolution,
        notice: saved.notice,
        errorMessage: saved.errorMessage,
        persistenceAvailable: cacheAvailable,
      });
    }

    const seeded = seedAppState(now);
    const saved = await this.saveRemoteState({
      userId,
      state: seeded,
      metadata: createPersistenceMetadata({ lastLocalMutationAt: now.toISOString() }),
      now,
    });

    return toLoadResult(saved.resolvedState ?? seeded, saved.metadata, {
      source: "seed",
      status: saved.status,
      conflictResolution: saved.conflictResolution,
      notice: saved.notice,
      errorMessage: saved.errorMessage,
      persistenceAvailable: cacheAvailable,
    });
  }

  async saveRemoteState({
    userId,
    state,
    metadata,
    now = new Date(),
  }: {
    userId: string;
    state: AppState;
    metadata: PersistenceMetadata;
    now?: Date;
  }): Promise<PersistenceSaveResult> {
    try {
      const remote = await this.loadSplitWorkspaceState(userId, state, now);
      const localValues = getSyncRecordValuesFromState(state);
      const remoteValues = getSyncRecordValuesFromState(remote.state);
      const keys = new Set([...Object.keys(localValues), ...Object.keys(remoteValues)]);
      const operations: Array<Promise<void>> = [];
      let conflictResolution: PersistenceConflictResolution = "none";
      let remoteWon = false;
      let localWonAfterConflict = false;
      const resolvedValues: Record<string, SyncRecordValue> = { ...remoteValues };

      for (const key of keys) {
        const localRecord = localValues[key];
        const remoteRecord = remoteValues[key];
        const knownRemote = metadata.records[key];
        const currentRemote = remote.records[key];
        const remoteChangedSinceLastSync =
          currentRemote && knownRemote
            ? currentRemote.lastRemoteUpdatedAt !== knownRemote.lastRemoteUpdatedAt
            : Boolean(knownRemote && !currentRemote);

        if (!localRecord && !remoteRecord) {
          continue;
        }

        if (localRecord && remoteRecord) {
          const localFingerprint = stableFingerprint(localRecord.value);
          const sameFingerprint = localFingerprint === stableFingerprint(remoteRecord.value);
          if (sameFingerprint) {
            if (!currentRemote || currentRemote.fingerprint !== localFingerprint) {
              operations.push(
                this.upsertRecord(
                  userId,
                  localRecord,
                  metadata.lastLocalMutationAt ?? now.toISOString(),
                  remote.rawRecords,
                ),
              );
            }
            resolvedValues[key] = localRecord;
            continue;
          }
        }

        if (remoteChangedSinceLastSync) {
          const remoteTimestamp =
            currentRemote?.lastRemoteUpdatedAtClient ??
            currentRemote?.lastRemoteUpdatedAt ??
            knownRemote?.lastRemoteUpdatedAtClient ??
            knownRemote?.lastRemoteUpdatedAt ??
            null;

          if (compareTimestamps(metadata.lastLocalMutationAt, remoteTimestamp) <= 0) {
            remoteWon = true;
            if (remoteRecord) {
              resolvedValues[key] = remoteRecord;
            } else {
              delete resolvedValues[key];
            }
            continue;
          }

          localWonAfterConflict = true;
        }

        if (!localRecord && remoteRecord) {
          operations.push(this.deleteRecord(userId, remoteRecord, remote.rawRecords));
          delete resolvedValues[key];
          continue;
        }

        if (localRecord) {
          operations.push(
            this.upsertRecord(
              userId,
              localRecord,
              metadata.lastLocalMutationAt ?? now.toISOString(),
              remote.rawRecords,
            ),
          );
          resolvedValues[key] = localRecord;
        }
      }

      await Promise.all(operations);

      const resolvedState = assembleStateFromValues(resolvedValues, state, now);
      const dualWriteTimestamp = metadata.lastLocalMutationAt ?? now.toISOString();
      const legacySnapshot = await this.legacySnapshotStore.saveSnapshot({
        userId,
        state: resolvedState,
        updatedAtClient: dualWriteTimestamp,
      });
      const finalRemote = await this.loadSplitWorkspaceState(userId, resolvedState, now);
      const resolvedMetadata = createPersistenceMetadata({
        ...buildMetadataFromRemote(finalRemote.state, finalRemote.records, {
          lastLocalMutationAt: metadata.lastLocalMutationAt,
          hasMigratedToSplitStore: true,
        }),
        lastSuccessfulDualWriteAt: legacySnapshot.updatedAt ?? dualWriteTimestamp,
      });

      if (remoteWon) {
        conflictResolution = "remote-overwrote-local";
      } else if (localWonAfterConflict) {
        conflictResolution = "local-overwrote-remote";
      }

      return {
        status: "synced",
        metadata: resolvedMetadata,
        conflictResolution,
        notice:
          conflictResolution === "remote-overwrote-local"
            ? "Newer changes from another device were loaded."
            : null,
        errorMessage: null,
        resolvedState: finalRemote.state,
      };
    } catch {
      return {
        status: "offline",
        metadata,
        conflictResolution: "none",
        notice: "PocketBase is unavailable, so your changes are saved on this device.",
        errorMessage: "Sync is offline right now.",
        resolvedState: state,
      };
    }
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

  private async reconcileSplitState(
    userId: string,
    remote: SplitWorkspacePayload,
    cachedEnvelope: { state: AppState; metadata: PersistenceMetadata } | null,
    cacheAvailable: boolean,
    now: Date,
  ): Promise<PersistenceLoadResult> {
    if (!cachedEnvelope) {
      return toLoadResult(remote.state, buildMetadataFromRemote(remote.state, remote.records), {
        source: "remote",
        status: "synced",
        conflictResolution: "none",
        notice: null,
        errorMessage: null,
        persistenceAvailable: cacheAvailable,
      });
    }

    const localValues = getSyncRecordValuesFromState(cachedEnvelope.state);
    const remoteValues = getSyncRecordValuesFromState(remote.state);
    const mergedValues: Record<string, SyncRecordValue> = {};
    let hasLocalNewer = false;
    let hasRemoteNewer = false;

    for (const key of new Set([...Object.keys(localValues), ...Object.keys(remoteValues)])) {
      const localRecord = localValues[key];
      const remoteRecord = remoteValues[key];
      const remoteMeta = remote.records[key];
      const knownRemoteMeta = cachedEnvelope.metadata.records[key];

      if (localRecord && remoteRecord) {
        const sameFingerprint = stableFingerprint(localRecord.value) === stableFingerprint(remoteRecord.value);
        if (sameFingerprint) {
          mergedValues[key] = remoteRecord;
          continue;
        }
      }

      const localWasMutated =
        !knownRemoteMeta ||
        (localRecord && knownRemoteMeta.fingerprint !== stableFingerprint(localRecord.value));

      const comparisonTimestamp =
        remoteMeta?.lastRemoteUpdatedAtClient ??
        remoteMeta?.lastRemoteUpdatedAt ??
        knownRemoteMeta?.lastRemoteUpdatedAtClient ??
        knownRemoteMeta?.lastRemoteUpdatedAt ??
        null;

      if (
        localRecord &&
        localWasMutated &&
        compareTimestamps(cachedEnvelope.metadata.lastLocalMutationAt, comparisonTimestamp) > 0
      ) {
        mergedValues[key] = localRecord;
        hasLocalNewer = true;
        continue;
      }

      if (remoteRecord) {
        mergedValues[key] = remoteRecord;
        hasRemoteNewer = true;
      } else if (localRecord && !localWasMutated) {
        hasRemoteNewer = true;
      } else if (localRecord) {
        mergedValues[key] = localRecord;
        hasLocalNewer = true;
      }
    }

    if (hasLocalNewer) {
      const mergedState = assembleStateFromValues(mergedValues, cachedEnvelope.state, now);
      const saved = await this.saveRemoteState({
        userId,
        state: mergedState,
        metadata: createPersistenceMetadata({
          ...buildMetadataFromRemote(remote.state, remote.records, {
            lastLocalMutationAt: cachedEnvelope.metadata.lastLocalMutationAt,
          }),
        }),
        now,
      });

      return toLoadResult(saved.resolvedState ?? mergedState, saved.metadata, {
        source: "local",
        status: saved.status,
        conflictResolution:
          saved.conflictResolution === "none" ? "local-overwrote-remote" : saved.conflictResolution,
        notice:
          saved.notice ??
          (saved.status === "synced" ? "This device had newer changes, so they were synced." : null),
        errorMessage: saved.errorMessage,
        persistenceAvailable: cacheAvailable,
      });
    }

    return toLoadResult(remote.state, buildMetadataFromRemote(remote.state, remote.records), {
      source: "remote",
      status: "synced",
      conflictResolution: hasRemoteNewer ? "remote-overwrote-local" : "none",
      notice: hasRemoteNewer ? "Newer changes from another device were loaded." : null,
      errorMessage: null,
      persistenceAvailable: cacheAvailable,
    });
  }

  private async loadSplitWorkspaceState(
    userId: string,
    localState: AppState | null,
    now: Date,
  ): Promise<SplitWorkspacePayload> {
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
    const loadedDailyPagesByWorkspace = new Map<string, Record<string, DailyPage>>();
    const dailyPageRecords = new Map<string, PocketBaseDailyPageRecord>();
    const rawRecords: SplitWorkspaceRawRecords = {
      dailyPages: new Map(),
      notes: new Map(),
      noteFolders: new Map(),
      plannerPresets: new Map(),
      contentBoard,
      contentCards: new Map(),
      workspaceState,
    };
    let hasRepairedDailyPage = false;

    for (const record of dailyPages) {
      if (!record.date) continue;
      const workspaceId = record.workspace_id || DEFAULT_TODO_WORKSPACE_ID;
      const value: DailyPage = {
        date: record.date,
        markdown: record.markdown ?? "",
        todos: safeArray(record.todos_json),
      };
      const key = `daily_page:${workspaceId}:${record.date}`;
      const workspacePages = loadedDailyPagesByWorkspace.get(workspaceId) ?? {};
      workspacePages[record.date] = value;
      loadedDailyPagesByWorkspace.set(workspaceId, workspacePages);
      dailyPageRecords.set(`${workspaceId}:${record.date}`, record);
      rawRecords.dailyPages.set(`${workspaceId}:${record.date}`, record);
      values[key] = { key, kind: "daily_page", value };
      records[key] = createRecordMetadata(
        key,
        "daily_page",
        value,
        record.updated ?? null,
        record.updated_at_client ?? null,
      );
    }

    const todayISO = toISODate(now);
    for (const [workspaceId, loadedDailyPages] of loadedDailyPagesByWorkspace) {
      const todayPage = loadedDailyPages[todayISO];
      const todayRecord = dailyPageRecords.get(`${workspaceId}:${todayISO}`);
      if (
        todayPage &&
        todayRecord &&
        isUntouchedEmptyDailyPage(todayPage, todayRecord.created, todayRecord.updated)
      ) {
        const history = { ...loadedDailyPages };
        delete history[todayISO];
        const repairedPage = createCarryoverDailyPage(history, todayISO);

        if (repairedPage.markdown.trim() !== "" || repairedPage.todos.length > 0) {
          const key = `daily_page:${workspaceId}:${todayISO}`;
          values[key] = {
            key,
            kind: "daily_page",
            value: repairedPage,
          };
          hasRepairedDailyPage = true;
        }
      }
    }

    for (const record of notes) {
      if (!record.note_id) continue;
      rawRecords.notes.set(record.note_id, record);
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
      rawRecords.noteFolders.set(record.folder_id, record);
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
      rawRecords.plannerPresets.set(record.preset_id, record);
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
      rawRecords.contentCards.set(record.card_id, record);
      const value: ContentCard = {
        id: record.card_id,
        columnId: record.column_id,
        title: record.title,
        notes: record.notes ?? "",
        order: Math.max(0, Math.trunc(record.position ?? 0)),
        updatedAt: record.updated_at_client ?? record.updated ?? new Date(0).toISOString(),
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

    const state = assembleStateFromValues(values, localState, now);

    return {
      state,
      records,
      rawRecords,
      hasRepairedDailyPage,
      hasData:
        dailyPages.length > 0 ||
        notes.length > 0 ||
        noteFolders.length > 0 ||
        plannerPresets.length > 0 ||
        Boolean(contentBoard) ||
        contentCards.length > 0 ||
        Boolean(workspaceState),
    };
  }

  private async upsertRecord(
    userId: string,
    record: SyncRecordValue,
    updatedAtClient: string,
    rawRecords: SplitWorkspaceRawRecords,
  ) {
    const client = getPocketBaseClient();

    if (record.kind === "daily_page") {
      const workspaceId = record.key.split(":").slice(1, -1).join(":");
      const existing = rawRecords.dailyPages.get(`${workspaceId}:${record.value.date}`);
      const payload = {
        owner: userId,
        workspace_id: workspaceId,
        date: record.value.date,
        markdown: record.value.markdown,
        todos_json: record.value.todos,
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        await client.collection("daily_pages").update(existing.id, payload, { requestKey: null });
      } else {
        await client.collection("daily_pages").create(payload, { requestKey: null });
      }
      return;
    }

    if (record.kind === "note") {
      const existing = rawRecords.notes.get(record.value.id);
      const payload = {
        owner: userId,
        note_id: record.value.id,
        title: record.value.title,
        folder_id: record.value.folderId,
        markdown: existing?.markdown ?? "",
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        await client.collection("notes").update(existing.id, payload, { requestKey: null });
      } else {
        await client.collection("notes").create(payload, { requestKey: null });
      }
      return;
    }

    if (record.kind === "note_folder") {
      const existing = rawRecords.noteFolders.get(record.value.id);
      const payload = {
        owner: userId,
        folder_id: record.value.id,
        name: record.value.name,
        parent_folder_id: record.value.parentId,
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        await client.collection("note_folders").update(existing.id, payload, { requestKey: null });
      } else {
        await client.collection("note_folders").create(payload, { requestKey: null });
      }
      return;
    }

    if (record.kind === "planner_preset") {
      const existing = rawRecords.plannerPresets.get(record.value.id);
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
        await client.collection("planner_presets").update(existing.id, payload, { requestKey: null });
      } else {
        await client.collection("planner_presets").create(payload, { requestKey: null });
      }
      return;
    }

    if (record.kind === "content_board") {
      const existing = rawRecords.contentBoard;
      const payload = {
        owner: userId,
        columns_json: record.value.columns,
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        await client.collection("content_boards").update(existing.id, payload, { requestKey: null });
      } else {
        await client.collection("content_boards").create(payload, { requestKey: null });
      }
      return;
    }

    if (record.kind === "content_card") {
      const existing = rawRecords.contentCards.get(record.value.id);
      const payload = {
        owner: userId,
        card_id: record.value.id,
        column_id: record.value.columnId,
        title: record.value.title,
        notes: record.value.notes,
        position: record.value.order,
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        await client.collection("content_cards").update(existing.id, payload, { requestKey: null });
      } else {
        await client.collection("content_cards").create(payload, { requestKey: null });
      }
      return;
    }

    const existing = rawRecords.workspaceState;
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
      await client.collection("workspace_state").update(existing.id, payload, { requestKey: null });
    } else {
      await client.collection("workspace_state").create(payload, { requestKey: null });
    }
  }

  private async deleteRecord(
    userId: string,
    record: SyncRecordValue,
    rawRecords: SplitWorkspaceRawRecords,
  ) {
    const client = getPocketBaseClient();

    if (record.kind === "daily_page") {
      const workspaceId = record.key.split(":").slice(1, -1).join(":");
      const existing = rawRecords.dailyPages.get(`${workspaceId}:${record.value.date}`);
      if (existing) {
        await client.collection("daily_pages").delete(existing.id, { requestKey: null });
      }
      return;
    }

    if (record.kind === "note") {
      const existing = rawRecords.notes.get(record.value.id);
      if (existing) {
        await client.collection("notes").delete(existing.id, { requestKey: null });
      }
      return;
    }

    if (record.kind === "note_folder") {
      const existing = rawRecords.noteFolders.get(record.value.id);
      if (existing) {
        await client.collection("note_folders").delete(existing.id, { requestKey: null });
      }
      return;
    }

    if (record.kind === "planner_preset") {
      const existing = rawRecords.plannerPresets.get(record.value.id);
      if (existing) {
        await client.collection("planner_presets").delete(existing.id, { requestKey: null });
      }
      return;
    }

    if (record.kind === "content_board") {
      const existing = rawRecords.contentBoard;
      if (existing) {
        await client.collection("content_boards").delete(existing.id, { requestKey: null });
      }
      return;
    }

    if (record.kind === "content_card") {
      const existing = rawRecords.contentCards.get(record.value.id);
      if (existing) {
        await client.collection("content_cards").delete(existing.id, { requestKey: null });
      }
      return;
    }

    const existing = rawRecords.workspaceState;
    if (existing) {
      await client.collection("workspace_state").delete(existing.id, { requestKey: null });
    }
  }
}

export function createPocketBasePersistenceRepository() {
  return new SplitPersistenceRepository(
    new PocketBaseSplitRemoteStore(),
    createBrowserLocalCacheStorage(),
    createRecentNoteBodiesStorage(),
  );
}
