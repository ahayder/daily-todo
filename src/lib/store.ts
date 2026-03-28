import { getYearMonth } from "@/lib/date";
import type {
  AppState,
  DailyPage,
  NoteDoc,
  PlannerDay,
  PlannerDayKey,
  PlannerEvent,
  PlannerEventColor,
  PlannerPreset,
  Priority,
  Todo,
} from "@/lib/types";

export const PLANNER_DAY_ORDER: PlannerDayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
export const PLANNER_EVENT_COLORS: PlannerEventColor[] = [
  "teal",
  "gold",
  "rose",
  "sage",
  "lavender",
];

const DEFAULT_DAY_TITLES: Record<PlannerDayKey, string> = {
  monday: "Deep Workday Monday",
  tuesday: "Momentum Tuesday",
  wednesday: "Steady Wednesday",
  thursday: "Deep Focus Thursday",
  friday: "Light Work Friday",
  saturday: "No Work Saturday",
  sunday: "Reset Sunday",
};

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

function createPlannerDay(key: PlannerDayKey): PlannerDay {
  return {
    key,
    title: DEFAULT_DAY_TITLES[key],
    events: [],
  };
}

export function createPlannerPreset(name = "Balanced Week"): PlannerPreset {
  const dayOrder = [...PLANNER_DAY_ORDER];
  const days = Object.fromEntries(
    dayOrder.map((dayKey) => [dayKey, createPlannerDay(dayKey)]),
  ) as Record<PlannerDayKey, PlannerDay>;

  return {
    id: makeId("planner"),
    name,
    dayOrder,
    days,
    updatedAt: new Date().toISOString(),
  };
}

export function duplicatePlannerPreset(source: PlannerPreset): PlannerPreset {
  return {
    ...source,
    id: makeId("planner"),
    name: `${source.name} Copy`,
    dayOrder: [...source.dayOrder],
    days: Object.fromEntries(
      source.dayOrder.map((dayKey) => [
        dayKey,
        {
          ...source.days[dayKey],
          events: source.days[dayKey].events.map((event) => ({
            ...event,
            id: makeId("planner-event"),
          })),
        },
      ]),
    ) as Record<PlannerDayKey, PlannerDay>,
    updatedAt: new Date().toISOString(),
  };
}

export function createPlannerEvent(input: {
  dayKey: PlannerDayKey;
  title?: string;
  startMinutes: number;
  endMinutes: number;
  color?: PlannerEventColor;
  notes?: string;
}): PlannerEvent {
  return {
    id: makeId("planner-event"),
    dayKey: input.dayKey,
    title: input.title?.trim() || "New block",
    startMinutes: input.startMinutes,
    endMinutes: input.endMinutes,
    color: input.color ?? "teal",
    notes: input.notes ?? "",
  };
}

export function createInitialState(todayISO: string): AppState {
  const starterNote = createNoteDoc("Quick Notes");
  const starterPlanner = createPlannerPreset();
  return {
    dailyPages: {
      [todayISO]: createEmptyDailyPage(todayISO),
    },
    notesDocs: {
      [starterNote.id]: starterNote,
    },
    plannerPresets: {
      [starterPlanner.id]: starterPlanner,
    },
    uiState: {
      selectedDailyDate: todayISO,
      selectedNoteId: starterNote.id,
      selectedPlannerPresetId: starterPlanner.id,
      isSidebarCollapsed: false,
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

export function ensurePlannerState(state: AppState): AppState {
  const existingPresets = state.plannerPresets ?? {};
  const presetIds = Object.keys(existingPresets);

  if (presetIds.length > 0) {
    const selectedPlannerPresetId =
      state.uiState.selectedPlannerPresetId && existingPresets[state.uiState.selectedPlannerPresetId]
        ? state.uiState.selectedPlannerPresetId
        : presetIds[0];

    if (selectedPlannerPresetId === state.uiState.selectedPlannerPresetId) {
      return state;
    }

    return {
      ...state,
      uiState: {
        ...state.uiState,
        selectedPlannerPresetId,
      },
    };
  }

  const starterPlanner = createPlannerPreset();

  return {
    ...state,
    plannerPresets: {
      [starterPlanner.id]: starterPlanner,
    },
    uiState: {
      ...state.uiState,
      selectedPlannerPresetId: starterPlanner.id,
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
