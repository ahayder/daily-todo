import { toISODate } from "@/lib/date";
import { appStateSchema } from "@/lib/schema";
import { createInitialState, ensureDailyPageForDate, ensurePlannerState } from "@/lib/store";
import type { AppState, UIState } from "@/lib/types";

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
  | "selectedPlannerPresetId"
  | "expandedYears"
  | "expandedMonths"
  | "lastView"
>;

export type LocalOnlyUIState = Pick<
  UIState,
  | "isSidebarCollapsed"
  | "themeMode"
  | "categoryTheme"
  | "isFocusMode"
  | "focusedTodoId"
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
      isSidebarCollapsed?: unknown;
      categoryTheme?: unknown;
      isFocusMode?: unknown;
      focusedTodoId?: unknown;
    };
    plannerPresets?: unknown;
  };

  if (!candidate.uiState || typeof candidate.uiState !== "object") {
    return parsed;
  }

  const themeMode = candidate.uiState.themeMode;
  const normalizedThemeMode =
    themeMode === "light" || themeMode === "dark" || themeMode === "system"
      ? themeMode
      : "system";

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
    uiState: {
      ...candidate.uiState,
      themeMode: normalizedThemeMode,
      lastView: normalizedLastView,
      selectedPlannerPresetId:
        typeof candidate.uiState.selectedPlannerPresetId === "string" ||
        candidate.uiState.selectedPlannerPresetId === null
          ? candidate.uiState.selectedPlannerPresetId
          : null,
      isSidebarCollapsed:
        typeof candidate.uiState.isSidebarCollapsed === "boolean"
          ? candidate.uiState.isSidebarCollapsed
          : false,
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
    ensurePlannerState({
      ...validated.data,
      uiState: {
        ...validated.data.uiState,
        themeMode: validated.data.uiState.themeMode ?? "system",
        categoryTheme: validated.data.uiState.categoryTheme ?? "normal",
        isFocusMode: validated.data.uiState.isFocusMode ?? false,
        focusedTodoId: validated.data.uiState.focusedTodoId ?? null,
        selectedPlannerPresetId: validated.data.uiState.selectedPlannerPresetId ?? null,
        isSidebarCollapsed: validated.data.uiState.isSidebarCollapsed ?? false,
      },
    }),
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
    selectedPlannerPresetId: uiState.selectedPlannerPresetId,
    expandedYears: uiState.expandedYears,
    expandedMonths: uiState.expandedMonths,
    lastView: uiState.lastView,
  };
}

export function extractLocalOnlyUIState(uiState: UIState): LocalOnlyUIState {
  return {
    isSidebarCollapsed: uiState.isSidebarCollapsed,
    themeMode: uiState.themeMode,
    categoryTheme: uiState.categoryTheme,
    isFocusMode: uiState.isFocusMode,
    focusedTodoId: uiState.focusedTodoId,
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

export function getMaxTimestamp(values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;

  for (const value of values) {
    if (compareTimestamps(value ?? null, latest) > 0) {
      latest = value ?? null;
    }
  }

  return latest;
}
