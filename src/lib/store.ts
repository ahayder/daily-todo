import { getYearMonth } from "@/lib/date";
import type {
  AppState,
  DailyPage,
  NoteDoc,
  NoteFolder,
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

export const DEFAULT_NOTES_FOLDER_ID = "note-folder-default";

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

export function createNoteDoc(
  title = "Untitled Note",
  folderId: string | null = DEFAULT_NOTES_FOLDER_ID,
): NoteDoc {
  return {
    id: makeId("note"),
    title,
    folderId,
    markdown: "",
    updatedAt: new Date().toISOString(),
  };
}

export function createNoteFolder(name = "New Folder", parentId: string | null = null): NoteFolder {
  return {
    id: makeId("note-folder"),
    name,
    parentId,
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultNotesFolder(): NoteFolder {
  return {
    id: DEFAULT_NOTES_FOLDER_ID,
    name: "Notes",
    parentId: null,
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
  const defaultNotesFolder = createDefaultNotesFolder();
  const starterPlanner = createPlannerPreset();
  return {
    dailyPages: {
      [todayISO]: createEmptyDailyPage(todayISO),
    },
    notesDocs: {
      [starterNote.id]: starterNote,
    },
    noteFolders: {
      [defaultNotesFolder.id]: defaultNotesFolder,
    },
    plannerPresets: {
      [starterPlanner.id]: starterPlanner,
    },
    uiState: {
      selectedDailyDate: todayISO,
      selectedNoteId: starterNote.id,
      selectedNoteFolderId: defaultNotesFolder.id,
      selectedPlannerPresetId: starterPlanner.id,
      isSidebarCollapsed: false,
      dailyTaskPaneWidth: 500,
      expandedYears: [todayISO.slice(0, 4)],
      expandedMonths: [getYearMonth(todayISO)],
      expandedNoteFolders: [defaultNotesFolder.id],
      lastView: "daily",
      themeMode: "dark",
      categoryTheme: "normal",
      isFocusMode: false,
      focusedTodoId: null,
    },
  };
}

export function ensureNoteState(state: AppState): AppState {
  const existingFolders = state.noteFolders ?? {};
  const defaultFolder =
    existingFolders[DEFAULT_NOTES_FOLDER_ID] ?? createDefaultNotesFolder();
  const nextFolders: Record<string, NoteFolder> = {
    ...existingFolders,
    [DEFAULT_NOTES_FOLDER_ID]: defaultFolder,
  };

  let notesChanged = false;
  const nextNotesDocs = Object.fromEntries(
    Object.entries(state.notesDocs).map(([noteId, note]) => {
      const nextFolderId =
        note.folderId && nextFolders[note.folderId] ? note.folderId : DEFAULT_NOTES_FOLDER_ID;

      if (nextFolderId !== note.folderId) {
        notesChanged = true;
      }

      return [
        noteId,
        {
          ...note,
          folderId: nextFolderId,
        },
      ];
    }),
  );

  const selectedNoteId =
    state.uiState.selectedNoteId && nextNotesDocs[state.uiState.selectedNoteId]
      ? state.uiState.selectedNoteId
      : null;
  const selectedNoteFolderId = selectedNoteId
    ? nextNotesDocs[selectedNoteId].folderId
    : state.uiState.selectedNoteFolderId && nextFolders[state.uiState.selectedNoteFolderId]
      ? state.uiState.selectedNoteFolderId
      : DEFAULT_NOTES_FOLDER_ID;
  const selectedFolderIdForExpansion = selectedNoteId
    ? nextNotesDocs[selectedNoteId].folderId
    : selectedNoteFolderId;
  const expandedNoteFolders = Array.from(
    new Set(
      (state.uiState.expandedNoteFolders ?? []).filter((folderId) => Boolean(nextFolders[folderId])),
    ),
  );

  let currentFolderId: string | null = selectedFolderIdForExpansion;
  while (currentFolderId && nextFolders[currentFolderId]) {
    if (!expandedNoteFolders.includes(currentFolderId)) {
      expandedNoteFolders.push(currentFolderId);
    }
    currentFolderId = nextFolders[currentFolderId].parentId;
  }

  if (
    !notesChanged &&
    existingFolders[DEFAULT_NOTES_FOLDER_ID] &&
    state.uiState.selectedNoteFolderId === selectedNoteFolderId &&
    state.uiState.selectedNoteId === selectedNoteId &&
    (state.uiState.expandedNoteFolders ?? []).length === expandedNoteFolders.length &&
    (state.uiState.expandedNoteFolders ?? []).every((folderId) => expandedNoteFolders.includes(folderId))
  ) {
    return state;
  }

  return {
    ...state,
    notesDocs: nextNotesDocs,
    noteFolders: nextFolders,
    uiState: {
      ...state.uiState,
      selectedNoteId,
      selectedNoteFolderId,
      expandedNoteFolders,
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
