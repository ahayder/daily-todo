import { toISODate } from "@/lib/date";
import { appStateSchema } from "@/lib/schema";
import { createInitialState, ensureDailyPageForDate, ensurePlannerState, STORAGE_KEY } from "@/lib/store";
import type { AppState } from "@/lib/types";

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

export function loadAppState(now = new Date()): AppState {
  const todayISO = toISODate(now);

  if (typeof window === "undefined") {
    return createInitialState(todayISO);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = createInitialState(todayISO);
    saveAppState(seeded);
    return seeded;
  }

  try {
    const parsed = normalizeLegacyState(JSON.parse(raw));
    const validated = appStateSchema.safeParse(parsed);

    if (!validated.success) {
      const fallback = createInitialState(todayISO);
      saveAppState(fallback);
      return fallback;
    }

    const normalizedState = ensurePlannerState({
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
    });

    const rolled = ensureDailyPageForDate(
      normalizedState,
      todayISO,
    );
    saveAppState(rolled);
    return rolled;
  } catch {
    const fallback = createInitialState(todayISO);
    saveAppState(fallback);
    return fallback;
  }
}

export function saveAppState(state: AppState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
