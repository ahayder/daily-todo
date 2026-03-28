import { createBrowserLocalCacheStorage } from "@/lib/local-cache-storage";
import { createRecentNoteBodiesStorage } from "@/lib/recent-note-bodies-storage";
import {
  APP_STATE_VERSION,
  compareTimestamps,
  createPersistenceMetadata,
  extractLocalOnlyUIState,
  extractSyncableUIState,
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
} from "@/lib/persistence";
import { SplitPersistenceRepository, type SplitRemotePersistenceStore } from "@/lib/split-persistence-repository";
import { getPocketBaseClient } from "@/lib/pocketbase/client";
import type { AppState, DailyPage, NoteDoc, NoteFolder, NoteSummary, PlannerPreset } from "@/lib/types";

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
  markdown?: string;
  todos_json?: unknown;
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
  updated?: string;
  updated_at_client?: string;
};

type PocketBaseWorkspaceStateRecord = {
  id: string;
  owner: string;
  selected_daily_date?: string | null;
  selected_note_id?: string | null;
  selected_note_folder_id?: string | null;
  selected_planner_preset_id?: string | null;
  expanded_years_json?: unknown;
  expanded_months_json?: unknown;
  last_view?: SyncableUIState["lastView"];
  updated?: string;
  updated_at_client?: string;
};

type SyncRecordValue =
  | { key: string; kind: "daily_page"; value: DailyPage }
  | { key: string; kind: "note"; value: NoteSummary }
  | { key: string; kind: "note_folder"; value: NoteFolder }
  | { key: string; kind: "planner_preset"; value: PlannerPreset }
  | { key: string; kind: "workspace_state"; value: SyncableUIState };

type SplitWorkspacePayload = {
  state: AppState;
  records: Record<string, PersistenceRecordMetadata>;
  hasData: boolean;
};

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

function getSyncRecordValuesFromState(state: AppState): Record<string, SyncRecordValue> {
  const values: Record<string, SyncRecordValue> = {};

  for (const [date, page] of Object.entries(state.dailyPages)) {
    values[`daily_page:${date}`] = {
      key: `daily_page:${date}`,
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

  values[WORKSPACE_RECORD_KEY] = {
    key: WORKSPACE_RECORD_KEY,
    kind: "workspace_state",
    value: extractSyncableUIState(state.uiState),
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
  const notesDocs: Record<string, NoteDoc> = {};
  const noteFolders: Record<string, NoteFolder> = {};
  const plannerPresets: Record<string, PlannerPreset> = {};
  let syncableUiState = extractSyncableUIState(fallbackState.uiState);

  for (const record of Object.values(values)) {
    if (record.kind === "daily_page") {
      dailyPages[record.value.date] = record.value;
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

    syncableUiState = record.value;
  }

  return normalizeAppState(
    {
      dailyPages,
      notesDocs,
      noteFolders,
      plannerPresets,
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
  const list = await client.collection(collection).getList<T>(1, 1, { filter });
  return list.items[0] ?? null;
}

class PocketBaseSnapshotStore implements RemoteAppStateStore {
  async loadSnapshot({ userId }: { userId: string }): Promise<RemoteSnapshot | null> {
    const client = getPocketBaseClient();

    try {
      const record = await client
        .collection("app_state_snapshots")
        .getFirstListItem<PocketBaseSnapshotRecord>(`owner="${userId}"`);

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
    knownRemoteUpdatedAt: string | null;
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
        .getFirstListItem<PocketBaseSnapshotRecord>(`owner="${userId}"`);

      if (knownRemoteUpdatedAt && existing.updated && existing.updated !== knownRemoteUpdatedAt) {
        return toSnapshot(existing);
      }

      const updated = await client
        .collection("app_state_snapshots")
        .update<PocketBaseSnapshotRecord>(existing.id, payload);

      return toSnapshot(updated);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }

      const created = await client
        .collection("app_state_snapshots")
        .create<PocketBaseSnapshotRecord>(payload);

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
          const sameFingerprint = stableFingerprint(localRecord.value) === stableFingerprint(remoteRecord.value);
          if (sameFingerprint) {
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
          operations.push(this.deleteRecord(userId, remoteRecord));
          delete resolvedValues[key];
          continue;
        }

        if (localRecord) {
          operations.push(this.upsertRecord(userId, localRecord, metadata.lastLocalMutationAt ?? now.toISOString()));
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
        knownRemoteUpdatedAt: metadata.lastRemoteUpdatedAt,
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
        .getFirstListItem<PocketBaseNoteRecord>(`owner="${userId}" && note_id="${noteId}"`);

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
        await client.collection("notes").update(existing.id, {
          owner: userId,
          note_id: noteId,
          title: existing.title ?? "",
          folder_id: existing.folder_id ?? null,
          markdown,
          updated_at_client: updatedAtClient,
        });
      } else {
        await client.collection("notes").create({
          owner: userId,
          note_id: noteId,
          title: "Untitled Note",
          folder_id: null,
          markdown,
          updated_at_client: updatedAtClient,
        });
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

      const comparisonTimestamp =
        remoteMeta?.lastRemoteUpdatedAtClient ??
        remoteMeta?.lastRemoteUpdatedAt ??
        knownRemoteMeta?.lastRemoteUpdatedAtClient ??
        knownRemoteMeta?.lastRemoteUpdatedAt ??
        null;

      if (localRecord && compareTimestamps(cachedEnvelope.metadata.lastLocalMutationAt, comparisonTimestamp) > 0) {
        mergedValues[key] = localRecord;
        hasLocalNewer = true;
        continue;
      }

      if (remoteRecord) {
        mergedValues[key] = remoteRecord;
        hasRemoteNewer = true;
      } else {
        hasRemoteNewer = true;
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
    const [dailyPages, notes, noteFolders, plannerPresets, workspaceState] = await Promise.all([
      client
        .collection("daily_pages")
        .getFullList<PocketBaseDailyPageRecord>({ filter: `owner="${userId}"` }),
      client.collection("notes").getFullList<PocketBaseNoteRecord>({ filter: `owner="${userId}"` }),
      client
        .collection("note_folders")
        .getFullList<PocketBaseNoteFolderRecord>({ filter: `owner="${userId}"` }),
      client
        .collection("planner_presets")
        .getFullList<PocketBasePlannerPresetRecord>({ filter: `owner="${userId}"` }),
      getFirstByFilter<PocketBaseWorkspaceStateRecord>("workspace_state", `owner="${userId}"`),
    ]);

    const values: Record<string, SyncRecordValue> = {};
    const records: Record<string, PersistenceRecordMetadata> = {};

    for (const record of dailyPages) {
      if (!record.date) continue;
      const value: DailyPage = {
        date: record.date,
        markdown: record.markdown ?? "",
        todos: safeArray(record.todos_json),
      };
      const key = `daily_page:${record.date}`;
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
      const value: PlannerPreset = {
        id: record.preset_id,
        name: record.name ?? "Balanced Week",
        dayOrder: safeArray(record.day_order_json),
        days: safeRecord(record.days_json),
        updatedAt: record.updated_at_client ?? record.updated ?? new Date(0).toISOString(),
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

    if (workspaceState) {
      const value: SyncableUIState = {
        selectedDailyDate: workspaceState.selected_daily_date ?? null,
        selectedNoteId: workspaceState.selected_note_id ?? null,
        selectedNoteFolderId: workspaceState.selected_note_folder_id ?? null,
        selectedPlannerPresetId: workspaceState.selected_planner_preset_id ?? null,
        expandedYears: safeArray(workspaceState.expanded_years_json),
        expandedMonths: safeArray(workspaceState.expanded_months_json),
        lastView: workspaceState.last_view ?? "daily",
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
      hasData:
        dailyPages.length > 0 ||
        notes.length > 0 ||
        noteFolders.length > 0 ||
        plannerPresets.length > 0 ||
        Boolean(workspaceState),
    };
  }

  private async upsertRecord(userId: string, record: SyncRecordValue, updatedAtClient: string) {
    const client = getPocketBaseClient();

    if (record.kind === "daily_page") {
      const existing = await getFirstByFilter<PocketBaseDailyPageRecord>(
        "daily_pages",
        `owner="${userId}" && date="${record.value.date}"`,
      );
      const payload = {
        owner: userId,
        date: record.value.date,
        markdown: record.value.markdown,
        todos_json: record.value.todos,
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        await client.collection("daily_pages").update(existing.id, payload);
      } else {
        await client.collection("daily_pages").create(payload);
      }
      return;
    }

    if (record.kind === "note") {
      const existing = await getFirstByFilter<PocketBaseNoteRecord>(
        "notes",
        `owner="${userId}" && note_id="${record.value.id}"`,
      );
      const payload = {
        owner: userId,
        note_id: record.value.id,
        title: record.value.title,
        folder_id: record.value.folderId,
        markdown: existing?.markdown ?? "",
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        await client.collection("notes").update(existing.id, payload);
      } else {
        await client.collection("notes").create(payload);
      }
      return;
    }

    if (record.kind === "note_folder") {
      const existing = await getFirstByFilter<PocketBaseNoteFolderRecord>(
        "note_folders",
        `owner="${userId}" && folder_id="${record.value.id}"`,
      );
      const payload = {
        owner: userId,
        folder_id: record.value.id,
        name: record.value.name,
        parent_folder_id: record.value.parentId,
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        await client.collection("note_folders").update(existing.id, payload);
      } else {
        await client.collection("note_folders").create(payload);
      }
      return;
    }

    if (record.kind === "planner_preset") {
      const existing = await getFirstByFilter<PocketBasePlannerPresetRecord>(
        "planner_presets",
        `owner="${userId}" && preset_id="${record.value.id}"`,
      );
      const payload = {
        owner: userId,
        preset_id: record.value.id,
        name: record.value.name,
        day_order_json: record.value.dayOrder,
        days_json: record.value.days,
        updated_at_client: updatedAtClient,
      };
      if (existing) {
        await client.collection("planner_presets").update(existing.id, payload);
      } else {
        await client.collection("planner_presets").create(payload);
      }
      return;
    }

    const existing = await getFirstByFilter<PocketBaseWorkspaceStateRecord>(
      "workspace_state",
      `owner="${userId}"`,
    );
    const payload = {
      owner: userId,
      selected_daily_date: record.value.selectedDailyDate,
      selected_note_id: record.value.selectedNoteId,
      selected_note_folder_id: record.value.selectedNoteFolderId,
      selected_planner_preset_id: record.value.selectedPlannerPresetId,
      expanded_years_json: record.value.expandedYears,
      expanded_months_json: record.value.expandedMonths,
      last_view: record.value.lastView,
      updated_at_client: updatedAtClient,
    };
    if (existing) {
      await client.collection("workspace_state").update(existing.id, payload);
    } else {
      await client.collection("workspace_state").create(payload);
    }
  }

  private async deleteRecord(userId: string, record: SyncRecordValue) {
    const client = getPocketBaseClient();

    if (record.kind === "daily_page") {
      const existing = await getFirstByFilter<PocketBaseDailyPageRecord>(
        "daily_pages",
        `owner="${userId}" && date="${record.value.date}"`,
      );
      if (existing) {
        await client.collection("daily_pages").delete(existing.id);
      }
      return;
    }

    if (record.kind === "note") {
      const existing = await getFirstByFilter<PocketBaseNoteRecord>(
        "notes",
        `owner="${userId}" && note_id="${record.value.id}"`,
      );
      if (existing) {
        await client.collection("notes").delete(existing.id);
      }
      return;
    }

    if (record.kind === "note_folder") {
      const existing = await getFirstByFilter<PocketBaseNoteFolderRecord>(
        "note_folders",
        `owner="${userId}" && folder_id="${record.value.id}"`,
      );
      if (existing) {
        await client.collection("note_folders").delete(existing.id);
      }
      return;
    }

    if (record.kind === "planner_preset") {
      const existing = await getFirstByFilter<PocketBasePlannerPresetRecord>(
        "planner_presets",
        `owner="${userId}" && preset_id="${record.value.id}"`,
      );
      if (existing) {
        await client.collection("planner_presets").delete(existing.id);
      }
      return;
    }

    const existing = await getFirstByFilter<PocketBaseWorkspaceStateRecord>(
      "workspace_state",
      `owner="${userId}"`,
    );
    if (existing) {
      await client.collection("workspace_state").delete(existing.id);
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
