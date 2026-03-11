"use client";

import {
  createContext,
  useContext,
  useEffect,
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
  DrawingStroke,
  Priority,
  ViewMode,
} from "@/lib/types";

export type AppAction =
  | { type: "set-view"; view: ViewMode }
  | { type: "select-daily"; date: string }
  | { type: "toggle-year"; year: string }
  | { type: "toggle-month"; month: string }
  | { type: "update-daily-markdown"; date: string; markdown: string }
  | { type: "set-daily-drawing"; date: string; drawingStrokes: DrawingStroke[] }
  | { type: "add-todo"; date: string; text: string; priority: Priority }
  | { type: "toggle-todo"; date: string; todoId: string }
  | { type: "delete-todo"; date: string; todoId: string }
  | { type: "create-note"; title?: string }
  | { type: "select-note"; noteId: string }
  | { type: "rename-note"; noteId: string; title: string }
  | { type: "delete-note"; noteId: string }
  | { type: "update-note-markdown"; noteId: string; markdown: string }
  | { type: "set-note-drawing"; noteId: string; drawingStrokes: DrawingStroke[] };

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
    case "set-daily-drawing": {
      const page = state.dailyPages[action.date];
      if (!page) return state;
      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            drawingStrokes: action.drawingStrokes,
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
            todos: [...page.todos, createTodo(action.text.trim(), action.priority)],
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
    case "set-note-drawing": {
      const note = state.notesDocs[action.noteId];
      if (!note) return state;
      return {
        ...state,
        notesDocs: {
          ...state.notesDocs,
          [action.noteId]: {
            ...note,
            drawingStrokes: action.drawingStrokes,
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
