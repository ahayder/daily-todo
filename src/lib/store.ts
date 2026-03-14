import { getYearMonth } from "@/lib/date";
import type { AppState, DailyPage, NoteDoc, Priority, Todo } from "@/lib/types";

export const STORAGE_KEY = "dailytodo.v1";

export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createEmptyDailyPage(date: string): DailyPage {
  return {
    date,
    markdown: "",
    todos: [],
  };
}

export function createTodo(text: string, priority: Priority, parentId?: string): Todo {
  return {
    id: makeId("todo"),
    text,
    priority,
    done: false,
    createdAt: new Date().toISOString(),
    parentId,
  };
}

export function createNoteDoc(title = "Untitled Note"): NoteDoc {
  return {
    id: makeId("note"),
    title,
    markdown: "",
    updatedAt: new Date().toISOString(),
  };
}

export function createInitialState(todayISO: string): AppState {
  const starterNote = createNoteDoc("Quick Notes");
  return {
    dailyPages: {
      [todayISO]: createEmptyDailyPage(todayISO),
    },
    notesDocs: {
      [starterNote.id]: starterNote,
    },
    uiState: {
      selectedDailyDate: todayISO,
      selectedNoteId: starterNote.id,
      expandedYears: [todayISO.slice(0, 4)],
      expandedMonths: [getYearMonth(todayISO)],
      lastView: "daily",
      themeMode: "system",
      categoryTheme: "normal",
      isFocusMode: false,
      focusedTodoId: null,
    },
  };
}

function cloneCarryoverTodos(todos: Todo[]): Todo[] {
  return todos
    .filter((todo) => !todo.done)
    .map((todo) => ({
      ...todo,
      id: makeId("todo"),
      done: false,
      createdAt: new Date().toISOString(),
    }));
}

function getLatestDailyDate(state: AppState): string | null {
  const dates = Object.keys(state.dailyPages).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

function monthKey(dateISO: string): string {
  return getYearMonth(dateISO);
}

export function ensureDailyPageForDate(state: AppState, todayISO: string): AppState {
  if (state.dailyPages[todayISO]) {
    return {
      ...state,
      uiState: {
        ...state.uiState,
        selectedDailyDate: state.uiState.selectedDailyDate ?? todayISO,
      },
    };
  }

  const latestDate = getLatestDailyDate(state);
  const previous = latestDate ? state.dailyPages[latestDate] : null;

  const nextPage: DailyPage = {
    date: todayISO,
    markdown: previous?.markdown ?? "",
    todos: previous ? cloneCarryoverTodos(previous.todos) : [],
  };

  return {
    ...state,
    dailyPages: {
      ...state.dailyPages,
      [todayISO]: nextPage,
    },
    uiState: {
      ...state.uiState,
      selectedDailyDate: todayISO,
      expandedYears: Array.from(new Set([...state.uiState.expandedYears, todayISO.slice(0, 4)])).sort(),
      expandedMonths: Array.from(new Set([...state.uiState.expandedMonths, monthKey(todayISO)])).sort(),
    },
  };
}

export function groupTodosByPriority(todos: Todo[]): Record<Priority, Todo[]> {
  const grouped: Record<Priority, Todo[]> = {
    1: [],
    2: [],
    3: [],
  };

  for (const todo of todos) {
    grouped[todo.priority].push(todo);
  }

  for (const bucket of Object.values(grouped)) {
    bucket.sort((a, b) => Number(a.done) - Number(b.done));
  }

  return grouped;
}

export function getSortedDailyDates(state: AppState): string[] {
  return Object.keys(state.dailyPages).sort((a, b) => b.localeCompare(a));
}
