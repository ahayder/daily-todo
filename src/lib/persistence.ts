import { toISODate } from "@/lib/date";
import { appStateSchema } from "@/lib/schema";
import { createInitialState, ensureDailyPageForDate, STORAGE_KEY } from "@/lib/store";
import type { AppState } from "@/lib/types";

function normalizeThemeMode(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const candidate = parsed as {
    uiState?: {
      themeMode?: unknown;
    };
  };

  if (!candidate.uiState || typeof candidate.uiState !== "object") {
    return parsed;
  }

  const themeMode = candidate.uiState.themeMode;
  if (themeMode === "light" || themeMode === "dark" || themeMode === "system") {
    return parsed;
  }

  return {
    ...candidate,
    uiState: {
      ...candidate.uiState,
      themeMode: "system",
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
    const parsed = normalizeThemeMode(JSON.parse(raw));
    const validated = appStateSchema.safeParse(parsed);

    if (!validated.success) {
      const fallback = createInitialState(todayISO);
      saveAppState(fallback);
      return fallback;
    }

    const rolled = ensureDailyPageForDate(
      {
        ...validated.data,
        uiState: {
          ...validated.data.uiState,
          themeMode: validated.data.uiState.themeMode ?? "system",
        },
      },
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
