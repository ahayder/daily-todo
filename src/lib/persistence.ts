import { toISODate } from "@/lib/date";
import { appStateSchema } from "@/lib/schema";
import { createInitialState, ensureDailyPageForDate, ensurePlannerState } from "@/lib/store";
import type { AppState } from "@/lib/types";

export const APP_STATE_VERSION = 1;
export const LEGACY_LOCAL_STORAGE_KEY = "dailytodo.v1";

export type PersistenceStatus = "idle" | "loading" | "synced" | "offline" | "error";

export type PersistenceRepository = {
  load(input: { userId: string; now?: Date }): Promise<AppState>;
  save(input: { userId: string; state: AppState }): Promise<void>;
};

export type LocalCacheStorage = {
  loadCached(input: { userId: string; now?: Date }): AppState | null;
  saveCached(input: { userId: string; state: AppState }): void;
  clearCached(input: { userId: string }): void;
};

export type RemoteAppStateStore = {
  loadSnapshot(input: { userId: string }): Promise<unknown | null>;
  saveSnapshot(input: { userId: string; state: AppState }): Promise<void>;
};

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
