import { toISODate } from "@/lib/date";
import { appStateSchema } from "@/lib/schema";
import { createInitialState, ensureDailyPageForDate, ensurePlannerState } from "@/lib/store";
import type { AppState } from "@/lib/types";

export const APP_STATE_VERSION = 1;
export const LEGACY_LOCAL_STORAGE_KEY = "dailytodo.v1";

export type PersistenceStatus = "idle" | "loading" | "syncing" | "synced" | "offline" | "error";
export type PersistenceSource = "seed" | "local" | "remote" | "ephemeral";
export type PersistenceConflictResolution =
  | "none"
  | "local-overwrote-remote"
  | "remote-overwrote-local";

export type PersistenceMetadata = {
  stateVersion: number;
  lastLocalMutationAt: string | null;
  lastRemoteUpdatedAt: string | null;
  lastRemoteUpdatedAtClient: string | null;
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

export type PersistenceRepository = {
  load(input: { userId: string; now?: Date }): Promise<PersistenceLoadResult>;
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
