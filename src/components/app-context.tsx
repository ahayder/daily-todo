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
  createNoteDoc,
  createTodo,
  ensureDailyPageForDate,
  getSortedDailyDates,
} from "@/lib/store";
import type {
  AppState,
  CategoryTheme,
  Priority,
  ThemeMode,
  ViewMode,
} from "@/lib/types";

export type AppAction =
  | { type: "set-view"; view: ViewMode }
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
    ensureDailyPageForDate(loadAppState(), toISODate(new Date())),
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

  if (
    context.state.uiState.selectedDailyDate !== selectedDailyDate ||
    context.state.uiState.selectedNoteId !== selectedNoteId
  ) {
    return {
      ...context,
      state: {
        ...context.state,
        uiState: {
          ...context.state.uiState,
          selectedDailyDate,
          selectedNoteId,
        },
      },
    };
  }

  return context;
}
