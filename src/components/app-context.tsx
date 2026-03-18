"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { toISODate } from "@/lib/date";
import { loadAppState, saveAppState } from "@/lib/persistence";
import {
  createPlannerEvent,
  createPlannerPreset,
  createNoteDoc,
  createTodo,
  duplicatePlannerPreset,
  ensureDailyPageForDate,
  ensurePlannerState,
  getSortedDailyDates,
} from "@/lib/store";
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
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, () =>
    ensureDailyPageForDate(ensurePlannerState(loadAppState()), toISODate(new Date())),
  );

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

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
  }, [state.uiState.themeMode]);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

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
