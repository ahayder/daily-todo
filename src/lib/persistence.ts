import { toISODate } from "@/lib/date";
import { appStateSchema } from "@/lib/schema";
import {
  createInitialState,
  ensureDailyPageForDate,
  ensureNoteState,
  ensurePlannerState,
} from "@/lib/store";
import type { AppState, CachedNoteBody, NoteSummary, UIState } from "@/lib/types";

export const APP_STATE_VERSION = 1;
export const LEGACY_LOCAL_STORAGE_KEY = "dailytodo.v1";

export type PersistenceStatus = "idle" | "loading" | "syncing" | "synced" | "offline" | "error";
export type PersistenceSource = "seed" | "local" | "remote" | "ephemeral";
export type PersistenceConflictResolution =
  | "none"
  | "local-overwrote-remote"
  | "remote-overwrote-local";

export type PersistenceRecordKind =
  | "daily_page"
  | "note"
  | "note_folder"
  | "planner_preset"
  | "workspace_state";

export type PersistenceRecordMetadata = {
  key: string;
  kind: PersistenceRecordKind;
  fingerprint: string;
  lastRemoteUpdatedAt: string | null;
  lastRemoteUpdatedAtClient: string | null;
};

export type PersistenceMetadata = {
  stateVersion: number;
  lastLocalMutationAt: string | null;
  lastRemoteUpdatedAt: string | null;
  lastRemoteUpdatedAtClient: string | null;
  records: Record<string, PersistenceRecordMetadata>;
  hasMigratedToSplitStore: boolean;
  lastSuccessfulDualWriteAt: string | null;
};

export type CachedAppStateEnvelope = {
  state: AppState;
  metadata: PersistenceMetadata;
};

export type NoteBodyLoadResult = {
  markdown: string | null;
  status: "ready" | "stale-offline" | "error";
  source: "local" | "remote" | "none";
  updatedAtClient: string | null;
  notice: string | null;
  errorMessage: string | null;
};

export type NoteBodySaveResult = {
  markdown: string;
  updatedAtClient: string;
  status: PersistenceStatus;
  notice: string | null;
  errorMessage: string | null;
};

export type PersistenceLoadResult = {
  state: AppState;
  source: PersistenceSource;
  status: PersistenceStatus;
  metadata: PersistenceMetadata;
  conflictResolution: PersistenceConflictResolution;
  notice: string | null;
  errorMessage: string | null;
  persistenceAvailable: boolean;
};

export type PersistenceSaveResult = {
  status: PersistenceStatus;
  metadata: PersistenceMetadata;
  conflictResolution: PersistenceConflictResolution;
  notice: string | null;
  errorMessage: string | null;
  resolvedState?: AppState;
};

export type LocalCacheLoadResult = {
  envelope: CachedAppStateEnvelope | null;
  available: boolean;
};

export type LocalCacheWriteResult = {
  available: boolean;
};

export type RemoteSnapshot = {
  state: unknown;
  stateVersion: number;
  updatedAt: string | null;
  updatedAtClient: string | null;
};

export type SyncableUIState = Pick<
  UIState,
  | "selectedDailyDate"
  | "selectedNoteId"
  | "selectedNoteFolderId"
  | "selectedPlannerPresetId"
  | "expandedYears"
  | "expandedMonths"
  | "lastView"
>;

export type LocalOnlyUIState = Pick<
  UIState,
  | "isSidebarCollapsed"
  | "dailyTaskPaneWidth"
  | "themeMode"
  | "categoryTheme"
  | "isFocusMode"
  | "focusedTodoId"
  | "expandedNoteFolders"
>;

export type PersistenceRepository = {
  load(input: {
    userId: string;
    now?: Date;
    onRemoteSync?: (result: PersistenceLoadResult) => void;
  }): Promise<PersistenceLoadResult>;
  save(input: {
    userId: string;
    state: AppState;
    baseMetadata: PersistenceMetadata;
    now?: Date;
  }): Promise<PersistenceSaveResult>;
  loadNoteBody(input: {
    userId: string;
    noteId: string;
    now?: Date;
  }): Promise<NoteBodyLoadResult>;
  saveNoteBody(input: {
    userId: string;
    noteId: string;
    markdown: string;
    updatedAtClient: string;
    now?: Date;
  }): Promise<NoteBodySaveResult>;
  primeRecentNoteCache(input: {
    userId: string;
    noteBodies: Array<{ noteId: string; markdown: string; updatedAtClient: string | null }>;
    now?: Date;
  }): Promise<void>;
  evictExpiredCachedBodies(input: { userId?: string; now?: Date }): Promise<void>;
  clearUserData(input: { userId: string }): Promise<void>;
};

export type LocalCacheStorage = {
  loadCached(input: { userId: string; now?: Date }): LocalCacheLoadResult;
  saveCached(input: { userId: string; envelope: CachedAppStateEnvelope }): LocalCacheWriteResult;
  clearCached(input: { userId: string }): LocalCacheWriteResult;
};

export type RemoteAppStateStore = {
  loadSnapshot(input: { userId: string }): Promise<RemoteSnapshot | null>;
  saveSnapshot(input: {
    userId: string;
    state: AppState;
    updatedAtClient: string;
    knownRemoteUpdatedAt: string | null;
  }): Promise<RemoteSnapshot>;
};

export type RecentNoteBodiesStorage = {
  loadNoteBody(input: { userId: string; noteId: string; now?: Date }): Promise<CachedNoteBody | null>;
  saveNoteBody(input: {
    userId: string;
    noteId: string;
    markdown: string;
    updatedAtClient: string | null;
    now?: Date;
  }): Promise<CachedNoteBody>;
  deleteNoteBody(input: { userId: string; noteId: string }): Promise<void>;
  clearUserData(input: { userId: string }): Promise<void>;
  evictExpired(input: { userId?: string; now?: Date }): Promise<void>;
  countUserBodies?(input: { userId: string }): Promise<number>;
};

export function createPersistenceMetadata(
  overrides: Partial<PersistenceMetadata> = {},
): PersistenceMetadata {
  return {
    stateVersion: APP_STATE_VERSION,
    lastLocalMutationAt: null,
    lastRemoteUpdatedAt: null,
    lastRemoteUpdatedAtClient: null,
    records: {},
    hasMigratedToSplitStore: false,
    lastSuccessfulDualWriteAt: null,
    ...overrides,
  };
}

export function compareTimestamps(left: string | null, right: string | null): number {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;

  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return -1;
  if (Number.isNaN(rightTime)) return 1;
  if (leftTime === rightTime) return 0;

  return leftTime > rightTime ? 1 : -1;
}

function normalizeLegacyState(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;

  const candidate = parsed as {
    uiState?: {
      themeMode?: unknown;
      lastView?: unknown;
      selectedPlannerPresetId?: unknown;
      selectedNoteFolderId?: unknown;
      isSidebarCollapsed?: unknown;
      dailyTaskPaneWidth?: unknown;
      categoryTheme?: unknown;
      isFocusMode?: unknown;
      focusedTodoId?: unknown;
      expandedNoteFolders?: unknown;
    };
    plannerPresets?: unknown;
    noteFolders?: unknown;
  };

  if (!candidate.uiState || typeof candidate.uiState !== "object") {
    return parsed;
  }

  const themeMode = candidate.uiState.themeMode;
  const normalizedThemeMode =
    themeMode === "light" || themeMode === "dark" || themeMode === "system"
      ? themeMode
      : "dark";

  const normalizedLastView =
    candidate.uiState.lastView === "daily" ||
    candidate.uiState.lastView === "notes" ||
    candidate.uiState.lastView === "planner"
      ? candidate.uiState.lastView
      : "daily";

  return {
    ...candidate,
    plannerPresets:
      candidate.plannerPresets && typeof candidate.plannerPresets === "object"
        ? candidate.plannerPresets
        : {},
    noteFolders:
      candidate.noteFolders && typeof candidate.noteFolders === "object" ? candidate.noteFolders : {},
    uiState: {
      ...candidate.uiState,
      themeMode: normalizedThemeMode,
      lastView: normalizedLastView,
      selectedPlannerPresetId:
        typeof candidate.uiState.selectedPlannerPresetId === "string" ||
        candidate.uiState.selectedPlannerPresetId === null
          ? candidate.uiState.selectedPlannerPresetId
          : null,
      selectedNoteFolderId:
        typeof candidate.uiState.selectedNoteFolderId === "string" ||
        candidate.uiState.selectedNoteFolderId === null
          ? candidate.uiState.selectedNoteFolderId
          : null,
      isSidebarCollapsed:
        typeof candidate.uiState.isSidebarCollapsed === "boolean"
          ? candidate.uiState.isSidebarCollapsed
          : false,
      dailyTaskPaneWidth:
        typeof candidate.uiState.dailyTaskPaneWidth === "number"
          ? candidate.uiState.dailyTaskPaneWidth
          : 500,
      categoryTheme:
        candidate.uiState.categoryTheme === "adhd1" ||
        candidate.uiState.categoryTheme === "adhd2" ||
        candidate.uiState.categoryTheme === "normal"
          ? candidate.uiState.categoryTheme
          : "normal",
      isFocusMode:
        typeof candidate.uiState.isFocusMode === "boolean" ? candidate.uiState.isFocusMode : false,
      focusedTodoId:
        typeof candidate.uiState.focusedTodoId === "string" ||
        candidate.uiState.focusedTodoId === null
          ? candidate.uiState.focusedTodoId
          : null,
      expandedNoteFolders: Array.isArray(candidate.uiState.expandedNoteFolders)
        ? candidate.uiState.expandedNoteFolders.filter((value): value is string => typeof value === "string")
        : [],
    },
  };
}

export function seedAppState(now = new Date()): AppState {
  return createInitialState(toISODate(now));
}

export function tryParseAppState(input: unknown, now = new Date()): AppState | null {
  const parsed = normalizeLegacyState(input);
  const validated = appStateSchema.safeParse(parsed);

  if (!validated.success) {
    return null;
  }

  return ensureDailyPageForDate(
    ensureNoteState(
      ensurePlannerState({
        ...validated.data,
        uiState: {
          ...validated.data.uiState,
          themeMode: validated.data.uiState.themeMode ?? "dark",
          categoryTheme: validated.data.uiState.categoryTheme ?? "normal",
          isFocusMode: validated.data.uiState.isFocusMode ?? false,
          focusedTodoId: validated.data.uiState.focusedTodoId ?? null,
          expandedNoteFolders: validated.data.uiState.expandedNoteFolders ?? [],
          selectedNoteFolderId: validated.data.uiState.selectedNoteFolderId ?? null,
          selectedPlannerPresetId: validated.data.uiState.selectedPlannerPresetId ?? null,
          isSidebarCollapsed: validated.data.uiState.isSidebarCollapsed ?? false,
          dailyTaskPaneWidth: validated.data.uiState.dailyTaskPaneWidth ?? 500,
        },
      }),
    ),
    toISODate(now),
  );
}

export function normalizeAppState(input: unknown, now = new Date()): AppState {
  return tryParseAppState(input, now) ?? seedAppState(now);
}

export function extractSyncableUIState(uiState: UIState): SyncableUIState {
  return {
    selectedDailyDate: uiState.selectedDailyDate,
    selectedNoteId: uiState.selectedNoteId,
    selectedNoteFolderId: uiState.selectedNoteFolderId,
    selectedPlannerPresetId: uiState.selectedPlannerPresetId,
    expandedYears: uiState.expandedYears,
    expandedMonths: uiState.expandedMonths,
    lastView: uiState.lastView,
  };
}

export function extractLocalOnlyUIState(uiState: UIState): LocalOnlyUIState {
  return {
    isSidebarCollapsed: uiState.isSidebarCollapsed,
    dailyTaskPaneWidth: uiState.dailyTaskPaneWidth,
    themeMode: uiState.themeMode,
    categoryTheme: uiState.categoryTheme,
    isFocusMode: uiState.isFocusMode,
    focusedTodoId: uiState.focusedTodoId,
    expandedNoteFolders: uiState.expandedNoteFolders,
  };
}

export function mergeUiState(
  syncable: SyncableUIState,
  localOnly: LocalOnlyUIState,
  fallback: UIState,
): UIState {
  return {
    ...fallback,
    ...syncable,
    ...localOnly,
  };
}

export function stripNoteBodies(state: AppState): AppState {
  return {
    ...state,
    notesDocs: Object.fromEntries(
      Object.entries(state.notesDocs).map(([noteId, note]) => [
        noteId,
        {
          ...note,
          markdown: undefined,
        },
      ]),
    ),
  };
}

export function getNoteSummary(note: NoteSummary | { id: string; title: string; folderId: string | null; updatedAt: string }) {
  return {
    id: note.id,
    title: note.title,
    folderId: note.folderId,
    updatedAt: note.updatedAt,
  };
}

export function getMaxTimestamp(values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;

  for (const value of values) {
    if (compareTimestamps(value ?? null, latest) > 0) {
      latest = value ?? null;
    }
  }

  return latest;
}
