"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/components/auth-context";
import { VerificationPendingScreen } from "@/components/verification-pending-screen";
import {
  createPlannerEvent,
  createPlannerPreset,
  createNoteDoc,
  createTodo,
  duplicatePlannerPreset,
  getSortedDailyDates,
} from "@/lib/store";
import {
  createPersistenceMetadata,
  seedAppState,
  type PersistenceMetadata,
  type PersistenceRepository,
  type PersistenceStatus,
} from "@/lib/persistence";
import type {
  AppState,
  CategoryTheme,
  PlannerDayKey,
  PlannerEventColor,
  Priority,
  ThemeMode,
  ViewMode,
} from "@/lib/types";

export type AppAction =
  | { type: "set-view"; view: ViewMode }
  | { type: "toggle-sidebar-collapsed" }
  | { type: "set-sidebar-collapsed"; isCollapsed: boolean }
  | { type: "set-theme-mode"; themeMode: ThemeMode }
  | { type: "set-category-theme"; theme: CategoryTheme }
  | { type: "select-daily"; date: string }
  | { type: "toggle-year"; year: string }
  | { type: "toggle-month"; month: string }
  | { type: "update-daily-markdown"; date: string; markdown: string }
  | { type: "add-todo"; date: string; text: string; priority: Priority; parentId?: string }
  | { type: "toggle-todo"; date: string; todoId: string }
  | { type: "delete-todo"; date: string; todoId: string }
  | { type: "create-note"; title?: string }
  | { type: "select-note"; noteId: string }
  | { type: "rename-note"; noteId: string; title: string }
  | { type: "delete-note"; noteId: string }
  | { type: "update-note-markdown"; noteId: string; markdown: string }
  | { type: "select-planner-preset"; presetId: string }
  | { type: "create-planner-preset"; name?: string }
  | { type: "duplicate-planner-preset"; presetId: string }
  | { type: "delete-planner-preset"; presetId: string }
  | { type: "rename-planner-preset"; presetId: string; name: string }
  | { type: "rename-planner-day"; presetId: string; dayKey: PlannerDayKey; title: string }
  | {
      type: "create-planner-event";
      presetId: string;
      dayKey: PlannerDayKey;
      title?: string;
      startMinutes: number;
      endMinutes: number;
      color?: PlannerEventColor;
      notes?: string;
    }
  | {
      type: "update-planner-event";
      presetId: string;
      dayKey: PlannerDayKey;
      eventId: string;
      updates: Partial<{
        title: string;
        startMinutes: number;
        endMinutes: number;
        color: PlannerEventColor;
        notes: string;
      }>;
    }
  | { type: "delete-planner-event"; presetId: string; dayKey: PlannerDayKey; eventId: string }
  | { type: "edit-todo"; date: string; todoId: string; text: string }
  | { type: "move-todo-priority"; date: string; todoId: string; newPriority: Priority; newIndex: number }
  | { type: "set-focus-mode"; isFocus: boolean; todoId?: string | null };

function toggleString(list: string[], value: string): string[] {
  if (list.includes(value)) {
    return list.filter((item) => item !== value);
  }
  return [...list, value];
}

function ensureSelectedDailyDate(state: AppState): string {
  const existing = state.uiState.selectedDailyDate;
  if (existing && state.dailyPages[existing]) {
    return existing;
  }
  const sorted = getSortedDailyDates(state);
  return sorted[0];
}

function ensureSelectedNoteId(state: AppState): string {
  const existing = state.uiState.selectedNoteId;
  if (existing && state.notesDocs[existing]) {
    return existing;
  }
  const first = Object.keys(state.notesDocs)[0];
  return first;
}

function ensureSelectedPlannerPresetId(state: AppState): string {
  const existing = state.uiState.selectedPlannerPresetId;
  if (existing && state.plannerPresets[existing]) {
    return existing;
  }
  const first = Object.keys(state.plannerPresets)[0];
  return first;
}

function clampPlannerMinutes(value: number): number {
  return Math.min(24 * 60, Math.max(0, value));
}

function normalizePlannerRange(startMinutes: number, endMinutes: number) {
  const start = clampPlannerMinutes(Math.min(startMinutes, endMinutes));
  const end = clampPlannerMinutes(Math.max(startMinutes, endMinutes));

  return {
    startMinutes: start,
    endMinutes: Math.max(start + 30, end),
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set-view":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          lastView: action.view,
        },
      };
    case "toggle-sidebar-collapsed":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          isSidebarCollapsed: !state.uiState.isSidebarCollapsed,
        },
      };
    case "set-sidebar-collapsed":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          isSidebarCollapsed: action.isCollapsed,
        },
      };
    case "set-theme-mode":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          themeMode: action.themeMode,
        },
      };
    case "set-category-theme":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          categoryTheme: action.theme,
        },
      };
    case "set-focus-mode":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          isFocusMode: action.isFocus,
          focusedTodoId: action.todoId ?? null,
        },
      };
    case "select-daily":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          selectedDailyDate: action.date,
          lastView: "daily",
        },
      };
    case "toggle-year":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          expandedYears: toggleString(state.uiState.expandedYears, action.year),
        },
      };
    case "toggle-month":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          expandedMonths: toggleString(state.uiState.expandedMonths, action.month),
        },
      };
    case "update-daily-markdown": {
      const page = state.dailyPages[action.date];
      if (!page) return state;
      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            markdown: action.markdown,
          },
        },
      };
    }
    case "add-todo": {
      const page = state.dailyPages[action.date];
      if (!page || !action.text.trim()) return state;
      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: [...page.todos, createTodo(action.text.trim(), action.priority, action.parentId)],
          },
        },
      };
    }
    case "toggle-todo": {
      const page = state.dailyPages[action.date];
      if (!page) return state;
      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: page.todos.map((todo) =>
              todo.id === action.todoId ? { ...todo, done: !todo.done } : todo,
            ),
          },
        },
      };
    }
    case "edit-todo": {
      const page = state.dailyPages[action.date];
      if (!page || !action.text.trim()) return state;
      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: page.todos.map((todo) =>
              todo.id === action.todoId ? { ...todo, text: action.text.trim() } : todo,
            ),
          },
        },
      };
    }
    case "move-todo-priority": {
      const page = state.dailyPages[action.date];
      if (!page) return state;

      const todoIndex = page.todos.findIndex((t) => t.id === action.todoId);
      if (todoIndex === -1) return state;

      const todo = page.todos[todoIndex];
      const newTodos = [...page.todos];

      // Remove from old position
      newTodos.splice(todoIndex, 1);

      // We need to insert it at the right index within the new priority group.
      // But page.todos is a flat list. We need to find the absolute insertion index.
      const todosInNewPriority = newTodos.filter((t) => t.priority === action.newPriority);
      const insertAtRelative = Math.min(Math.max(0, action.newIndex), todosInNewPriority.length);
      
      let absoluteInsertIndex = newTodos.length;
      if (insertAtRelative < todosInNewPriority.length) {
          const targetTodoId = todosInNewPriority[insertAtRelative].id;
          absoluteInsertIndex = newTodos.findIndex((t) => t.id === targetTodoId);
      }

      newTodos.splice(absoluteInsertIndex, 0, { ...todo, priority: action.newPriority });

      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: newTodos,
          },
        },
      };
    }
    case "delete-todo": {
      const page = state.dailyPages[action.date];
      if (!page) return state;
      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: page.todos.filter((todo) => todo.id !== action.todoId),
          },
        },
      };
    }
    case "create-note": {
      const note = createNoteDoc(action.title);
      return {
        ...state,
        notesDocs: {
          ...state.notesDocs,
          [note.id]: note,
        },
        uiState: {
          ...state.uiState,
          selectedNoteId: note.id,
          lastView: "notes",
        },
      };
    }
    case "select-planner-preset":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          selectedPlannerPresetId: action.presetId,
          lastView: "planner",
        },
      };
    case "create-planner-preset": {
      const preset = createPlannerPreset(action.name);
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [preset.id]: preset,
        },
        uiState: {
          ...state.uiState,
          selectedPlannerPresetId: preset.id,
          lastView: "planner",
        },
      };
    }
    case "duplicate-planner-preset": {
      const source = state.plannerPresets[action.presetId];
      if (!source) return state;
      const preset = duplicatePlannerPreset(source);
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [preset.id]: preset,
        },
        uiState: {
          ...state.uiState,
          selectedPlannerPresetId: preset.id,
          lastView: "planner",
        },
      };
    }
    case "delete-planner-preset": {
      if (!state.plannerPresets[action.presetId]) return state;

      const remainingEntries = Object.entries(state.plannerPresets).filter(
        ([id]) => id !== action.presetId,
      );

      if (!remainingEntries.length) {
        const preset = createPlannerPreset();
        return {
          ...state,
          plannerPresets: {
            [preset.id]: preset,
          },
          uiState: {
            ...state.uiState,
            selectedPlannerPresetId: preset.id,
            lastView: "planner",
          },
        };
      }

      const nextPlannerPresets = Object.fromEntries(remainingEntries);
      const nextSelectedPresetId =
        state.uiState.selectedPlannerPresetId &&
        nextPlannerPresets[state.uiState.selectedPlannerPresetId]
          ? state.uiState.selectedPlannerPresetId
          : remainingEntries[0][0];

      return {
        ...state,
        plannerPresets: nextPlannerPresets,
        uiState: {
          ...state.uiState,
          selectedPlannerPresetId: nextSelectedPresetId,
          lastView: "planner",
        },
      };
    }
    case "rename-planner-preset": {
      const preset = state.plannerPresets[action.presetId];
      if (!preset) return state;
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [action.presetId]: {
            ...preset,
            name: action.name.trim() || "Untitled Week",
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }
    case "rename-planner-day": {
      const preset = state.plannerPresets[action.presetId];
      if (!preset) return state;
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [action.presetId]: {
            ...preset,
            updatedAt: new Date().toISOString(),
            days: {
              ...preset.days,
              [action.dayKey]: {
                ...preset.days[action.dayKey],
                title: action.title.trim() || preset.days[action.dayKey].title,
              },
            },
          },
        },
      };
    }
    case "create-planner-event": {
      const preset = state.plannerPresets[action.presetId];
      if (!preset) return state;
      const { startMinutes, endMinutes } = normalizePlannerRange(
        action.startMinutes,
        action.endMinutes,
      );
      const nextEvent = createPlannerEvent({
        dayKey: action.dayKey,
        title: action.title,
        startMinutes,
        endMinutes,
        color: action.color,
        notes: action.notes,
      });
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [action.presetId]: {
            ...preset,
            updatedAt: new Date().toISOString(),
            days: {
              ...preset.days,
              [action.dayKey]: {
                ...preset.days[action.dayKey],
                events: [...preset.days[action.dayKey].events, nextEvent].sort(
                  (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
                ),
              },
            },
          },
        },
      };
    }
    case "update-planner-event": {
      const preset = state.plannerPresets[action.presetId];
      if (!preset) return state;
      const day = preset.days[action.dayKey];
      const event = day.events.find((item) => item.id === action.eventId);
      if (!event) return state;
      const range = normalizePlannerRange(
        action.updates.startMinutes ?? event.startMinutes,
        action.updates.endMinutes ?? event.endMinutes,
      );
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [action.presetId]: {
            ...preset,
            updatedAt: new Date().toISOString(),
            days: {
              ...preset.days,
              [action.dayKey]: {
                ...day,
                events: day.events
                  .map((item) =>
                    item.id === action.eventId
                      ? {
                          ...item,
                          ...action.updates,
                          title: action.updates.title?.trim() || item.title,
                          notes: action.updates.notes ?? item.notes,
                          startMinutes: range.startMinutes,
                          endMinutes: range.endMinutes,
                        }
                      : item,
                  )
                  .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes),
              },
            },
          },
        },
      };
    }
    case "delete-planner-event": {
      const preset = state.plannerPresets[action.presetId];
      if (!preset) return state;
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [action.presetId]: {
            ...preset,
            updatedAt: new Date().toISOString(),
            days: {
              ...preset.days,
              [action.dayKey]: {
                ...preset.days[action.dayKey],
                events: preset.days[action.dayKey].events.filter(
                  (item) => item.id !== action.eventId,
                ),
              },
            },
          },
        },
      };
    }
    case "select-note":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          selectedNoteId: action.noteId,
          lastView: "notes",
        },
      };
    case "rename-note": {
      const note = state.notesDocs[action.noteId];
      if (!note) return state;
      return {
        ...state,
        notesDocs: {
          ...state.notesDocs,
          [action.noteId]: {
            ...note,
            title: action.title || "Untitled Note",
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }
    case "delete-note": {
      const entries = Object.entries(state.notesDocs).filter(([id]) => id !== action.noteId);
      if (!entries.length) return state;
      const nextNotesDocs = Object.fromEntries(entries);
      return {
        ...state,
        notesDocs: nextNotesDocs,
        uiState: {
          ...state.uiState,
          selectedNoteId: nextNotesDocs[state.uiState.selectedNoteId ?? ""]
            ? state.uiState.selectedNoteId
            : entries[0][0],
        },
      };
    }
    case "update-note-markdown": {
      const note = state.notesDocs[action.noteId];
      if (!note) return state;
      return {
        ...state,
        notesDocs: {
          ...state.notesDocs,
          [action.noteId]: {
            ...note,
            markdown: action.markdown,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }
    default:
      return state;
  }
}

type AppContextValue = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  sync: {
    status: PersistenceStatus;
    lastSyncedAt: string | null;
    notice: string | null;
    errorMessage: string | null;
    hasPendingChanges: boolean;
    persistenceAvailable: boolean;
  };
  retrySync: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

type AppProviderProps = {
  children: ReactNode;
  repository: PersistenceRepository;
};

export function AppProvider({ children, repository }: AppProviderProps) {
  const { session, status: authStatus } = useAuth();
  const pathname = usePathname();
  const [state, setState] = useState<AppState | null>(null);
  const saveSnapshotRef = useRef<string | null>(null);
  const metadataRef = useRef<PersistenceMetadata>(createPersistenceMetadata());
  const dirtySnapshotRef = useRef<string | null>(null);
  const lastAuthenticatedUserIdRef = useRef<string | null>(null);
  const themeMode = state?.uiState.themeMode;
  const [syncStatus, setSyncStatus] = useState<PersistenceStatus>("idle");
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [persistenceAvailable, setPersistenceAvailable] = useState(true);

  const isPublicAuthRoute = pathname.startsWith("/auth/reset");

  const dispatch = useMemo<Dispatch<AppAction>>(
    () => (action) => {
      setState((current) => (current ? appReducer(current, action) : current));
    },
    [],
  );

  useEffect(() => {
    if (session?.userId) {
      lastAuthenticatedUserIdRef.current = session.userId;
    }
  }, [session?.userId]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !session) {
      if (authStatus === "anonymous" && lastAuthenticatedUserIdRef.current) {
        void repository.clearUserData({ userId: lastAuthenticatedUserIdRef.current });
        lastAuthenticatedUserIdRef.current = null;
      }

      saveSnapshotRef.current = null;
       dirtySnapshotRef.current = null;
      metadataRef.current = createPersistenceMetadata();
      setState(null);
      setSyncStatus("idle");
      setSyncNotice(null);
      setSyncError(null);
      setLastSyncedAt(null);
      setPersistenceAvailable(true);
      return;
    }

    let mounted = true;

    const hydrate = async () => {
      try {
        setSyncStatus("loading");
        const result = await repository.load({
          userId: session.userId,
          now: new Date(),
        });
        if (!mounted) {
          return;
        }

        const snapshot = JSON.stringify(result.state);
        saveSnapshotRef.current = snapshot;
        dirtySnapshotRef.current = null;
        metadataRef.current = result.metadata;
        setState(result.state);
        setSyncStatus(result.status);
        setSyncNotice(result.notice);
        setSyncError(result.errorMessage);
        setLastSyncedAt(result.metadata.lastRemoteUpdatedAt);
        setPersistenceAvailable(result.persistenceAvailable);
      } catch {
        if (!mounted) {
          return;
        }

        setState(seedAppState(new Date()));
        setSyncStatus("error");
        setSyncError("We couldn’t restore your workspace.");
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, [authStatus, repository, session]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !state) return;

    const root = document.documentElement;
    const query = window.matchMedia("(prefers-color-scheme: dark)");

    const applyDarkState = (isDark: boolean) => {
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    };

    if (state.uiState.themeMode === "dark") {
      applyDarkState(true);
      return;
    }

    if (state.uiState.themeMode === "light") {
      applyDarkState(false);
      return;
    }

    applyDarkState(query.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      applyDarkState(event.matches);
    };

    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, [state, themeMode]);

  useEffect(() => {
    if (!session || !state || authStatus !== "authenticated") {
      return;
    }

    const nextSnapshot = JSON.stringify(state);
    if (nextSnapshot === saveSnapshotRef.current) {
      dirtySnapshotRef.current = null;
      return;
    }

    dirtySnapshotRef.current = nextSnapshot;
    setSyncStatus((current) => (current === "offline" ? "offline" : "syncing"));

    const timer = window.setTimeout(() => {
      void repository
        .save({
          userId: session.userId,
          state,
          baseMetadata: metadataRef.current,
          now: new Date(),
        })
        .then((result) => {
          metadataRef.current = result.metadata;
          setSyncStatus(result.status);
          setSyncNotice(result.notice);
          setSyncError(result.errorMessage);
          setLastSyncedAt(result.metadata.lastRemoteUpdatedAt);
          if (result.status === "synced") {
            saveSnapshotRef.current = nextSnapshot;
            dirtySnapshotRef.current = null;
          }
        })
        .catch(() => {
          setSyncStatus("error");
          setSyncError("We couldn’t sync right now.");
        });
    }, 750);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authStatus, repository, session, state]);

  const retrySync = async () => {
    if (!session || !state || authStatus !== "authenticated") {
      return;
    }

    setSyncStatus("syncing");
    const nextSnapshot = JSON.stringify(state);
    const result = await repository.save({
      userId: session.userId,
      state,
      baseMetadata: metadataRef.current,
      now: new Date(),
    });

    metadataRef.current = result.metadata;
    setSyncStatus(result.status);
    setSyncNotice(result.notice);
    setSyncError(result.errorMessage);
    setLastSyncedAt(result.metadata.lastRemoteUpdatedAt);
    if (result.status === "synced") {
      saveSnapshotRef.current = nextSnapshot;
      dirtySnapshotRef.current = null;
    }
  };

  useEffect(() => {
    if (!session || authStatus !== "authenticated") {
      return;
    }

    const flushIfNeeded = () => {
      if (!state || !dirtySnapshotRef.current) {
        return;
      }

      void repository
        .save({
          userId: session.userId,
          state,
          baseMetadata: metadataRef.current,
          now: new Date(),
        })
        .then((result) => {
          metadataRef.current = result.metadata;
          setSyncStatus(result.status);
          setSyncNotice(result.notice);
          setSyncError(result.errorMessage);
          setLastSyncedAt(result.metadata.lastRemoteUpdatedAt);
          if (result.status === "synced") {
            saveSnapshotRef.current = dirtySnapshotRef.current;
            dirtySnapshotRef.current = null;
          }
        })
        .catch(() => {
          setSyncStatus("error");
          setSyncError("We couldn’t sync before leaving the page.");
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushIfNeeded();
      }
    };

    window.addEventListener("pagehide", flushIfNeeded);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushIfNeeded);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authStatus, repository, session, state]);

  const value = useMemo(
    () =>
      state
        ? {
            state,
            dispatch,
            sync: {
              status: syncStatus,
              lastSyncedAt,
              notice: syncNotice,
              errorMessage: syncError,
              hasPendingChanges: dirtySnapshotRef.current !== null,
              persistenceAvailable,
            },
            retrySync,
          }
        : null,
    [dispatch, lastSyncedAt, persistenceAvailable, state, syncError, syncNotice, syncStatus],
  );

  if (isPublicAuthRoute) {
    return children;
  }

  if (authStatus === "loading") {
    return <AppLoadingScreen label="Restoring your workspace" />;
  }

  if (authStatus === "verification-pending") {
    return <VerificationPendingScreen />;
  }

  if (authStatus === "anonymous") {
    return <AuthGate />;
  }

  if (!state) {
    return <AppLoadingScreen label="Loading your notes and todos" />;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppState must be used within AppProvider");
  }

  const selectedDailyDate = ensureSelectedDailyDate(context.state);
  const selectedNoteId = ensureSelectedNoteId(context.state);
  const selectedPlannerPresetId = ensureSelectedPlannerPresetId(context.state);

  if (
    context.state.uiState.selectedDailyDate !== selectedDailyDate ||
    context.state.uiState.selectedNoteId !== selectedNoteId ||
    context.state.uiState.selectedPlannerPresetId !== selectedPlannerPresetId
  ) {
    return {
      ...context,
      state: {
        ...context.state,
        uiState: {
          ...context.state.uiState,
          selectedDailyDate,
          selectedNoteId,
          selectedPlannerPresetId,
        },
      },
    };
  }

  return context;
}

function AppLoadingScreen({ label }: { label: string }) {
  return (
    <main className="auth-screen">
      <section className="auth-card auth-card--loading">
        <div className="app-logo auth-card__logo" aria-hidden="true" />
        <p className="auth-card__eyebrow">DailyTodo</p>
        <h1 className="auth-card__title">{label}</h1>
      </section>
    </main>
  );
}
