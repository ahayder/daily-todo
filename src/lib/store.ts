import { getYearMonth } from "@/lib/date";
import { CONTENT_FONT_SCALE_DEFAULT } from "@/lib/content-font-scale";
import type {
  AppState,
  ContentBoard,
  ContentCard,
  ContentColumn,
  DailyPage,
  NoteDoc,
  NoteFolder,
  PlannerDay,
  PlannerDayKey,
  PlannerEvent,
  PlannerEventColor,
  PlannerPreset,
  Priority,
  TaskStatus,
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
export const DEFAULT_CONTENT_COLUMNS: ContentColumn[] = [
  {
    id: "content-column-ideas",
    title: "Ideas",
    subtitle: "Capture raw concepts",
  },
  {
    id: "content-column-planned",
    title: "Planned",
    subtitle: "Ready to work on",
  },
  {
    id: "content-column-in-progress",
    title: "In Progress",
    subtitle: "Currently being created",
  },
  {
    id: "content-column-ready",
    title: "Ready",
    subtitle: "Prepared to publish",
  },
  {
    id: "content-column-published",
    title: "Published",
    subtitle: "Live and complete",
  },
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
const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  ongoing: 0,
  pending: 1,
  finished: 2,
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
    status: "pending",
    estimatedMinutes: null,
    createdAt: new Date().toISOString(),
    parentId,
  };
}

export function makeTodoSubtask(
  todos: Todo[],
  todoId: string,
  parentId: string,
): Todo[] {
  const todo = todos.find((item) => item.id === todoId);
  const parent = todos.find((item) => item.id === parentId);

  if (
    !todo ||
    !parent ||
    todo.id === parent.id ||
    todo.parentId ||
    parent.parentId
  ) {
    return todos;
  }

  const movedIds = new Set([todo.id]);
  let foundDescendant = true;

  while (foundDescendant) {
    foundDescendant = false;
    for (const item of todos) {
      if (item.parentId && movedIds.has(item.parentId) && !movedIds.has(item.id)) {
        movedIds.add(item.id);
        foundDescendant = true;
      }
    }
  }

  const movedTodos = todos
    .filter((item) => movedIds.has(item.id))
    .map((item) => ({
      ...item,
      parentId: parent.id,
      priority: parent.priority,
    }));
  const remainingTodos = todos.filter((item) => !movedIds.has(item.id));

  return [...remainingTodos, ...movedTodos];
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

export function createDefaultContentBoard(now = new Date()): ContentBoard {
  return {
    columns: DEFAULT_CONTENT_COLUMNS.map((column) => ({ ...column })),
    updatedAt: now.toISOString(),
  };
}

export function createContentColumn(title: string, subtitle = ""): ContentColumn | null {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    return null;
  }

  return {
    id: makeId("content-column"),
    title: normalizedTitle,
    subtitle: subtitle.trim(),
  };
}

export function createContentCard(input: {
  columnId: string;
  title: string;
  notes?: string;
  order: number;
}): ContentCard | null {
  const title = input.title.trim();
  if (!title || !input.columnId) {
    return null;
  }

  return {
    id: makeId("content-card"),
    columnId: input.columnId,
    title,
    notes: input.notes?.trim() ?? "",
    order: Math.max(0, Math.trunc(input.order)),
    updatedAt: new Date().toISOString(),
  };
}

export function addContentColumn(
  board: ContentBoard,
  title: string,
  subtitle = "",
): ContentBoard {
  const column = createContentColumn(title, subtitle);
  if (!column) {
    return board;
  }

  return {
    columns: [...board.columns, column],
    updatedAt: new Date().toISOString(),
  };
}

export function renameContentColumn(
  board: ContentBoard,
  columnId: string,
  title: string,
): ContentBoard {
  const normalizedTitle = title.trim();
  const column = board.columns.find((candidate) => candidate.id === columnId);
  if (!column || !normalizedTitle || column.title === normalizedTitle) {
    return board;
  }

  return {
    columns: board.columns.map((candidate) =>
      candidate.id === columnId ? { ...candidate, title: normalizedTitle } : candidate,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function updateContentColumnSubtitle(
  board: ContentBoard,
  columnId: string,
  subtitle: string,
): ContentBoard {
  const normalizedSubtitle = subtitle.trim();
  const column = board.columns.find((candidate) => candidate.id === columnId);
  if (!column || column.subtitle === normalizedSubtitle) {
    return board;
  }

  return {
    columns: board.columns.map((candidate) =>
      candidate.id === columnId
        ? { ...candidate, subtitle: normalizedSubtitle }
        : candidate,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function reorderContentColumns(
  board: ContentBoard,
  activeColumnId: string,
  overColumnId: string,
): ContentBoard {
  const activeIndex = board.columns.findIndex((column) => column.id === activeColumnId);
  const overIndex = board.columns.findIndex((column) => column.id === overColumnId);
  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return board;
  }

  const columns = [...board.columns];
  const [activeColumn] = columns.splice(activeIndex, 1);
  columns.splice(overIndex, 0, activeColumn);

  return {
    columns,
    updatedAt: new Date().toISOString(),
  };
}

export function deleteContentColumn(
  board: ContentBoard,
  cards: Record<string, ContentCard>,
  columnId: string,
): ContentBoard {
  if (
    board.columns.length <= 1 ||
    !board.columns.some((column) => column.id === columnId) ||
    Object.values(cards).some((card) => card.columnId === columnId)
  ) {
    return board;
  }

  return {
    columns: board.columns.filter((column) => column.id !== columnId),
    updatedAt: new Date().toISOString(),
  };
}

export function getContentCardsForColumn(
  cards: Record<string, ContentCard>,
  columnId: string,
): ContentCard[] {
  return Object.values(cards)
    .filter((card) => card.columnId === columnId)
    .toSorted((left, right) => left.order - right.order || left.updatedAt.localeCompare(right.updatedAt));
}

function reindexContentCards(
  cards: Record<string, ContentCard>,
  columnId: string,
  orderedCardIds: string[],
  updatedAt: string,
): Record<string, ContentCard> {
  const nextCards = { ...cards };
  orderedCardIds.forEach((cardId, order) => {
    const card = nextCards[cardId];
    if (!card) return;
    nextCards[cardId] = {
      ...card,
      columnId,
      order,
      updatedAt,
    };
  });
  return nextCards;
}

export function moveContentCard(
  cards: Record<string, ContentCard>,
  cardId: string,
  targetColumnId: string,
  targetIndex: number,
): Record<string, ContentCard> {
  const card = cards[cardId];
  if (!card || !targetColumnId) {
    return cards;
  }

  const sourceColumnId = card.columnId;
  const sourceIds = getContentCardsForColumn(cards, sourceColumnId)
    .map((candidate) => candidate.id)
    .filter((candidateId) => candidateId !== cardId);
  const targetIds =
    sourceColumnId === targetColumnId
      ? sourceIds
      : getContentCardsForColumn(cards, targetColumnId)
          .map((candidate) => candidate.id)
          .filter((candidateId) => candidateId !== cardId);
  const clampedIndex = Math.max(0, Math.min(Math.trunc(targetIndex), targetIds.length));
  targetIds.splice(clampedIndex, 0, cardId);
  const updatedAt = new Date().toISOString();

  let nextCards = reindexContentCards(cards, targetColumnId, targetIds, updatedAt);
  if (sourceColumnId !== targetColumnId) {
    nextCards = reindexContentCards(nextCards, sourceColumnId, sourceIds, updatedAt);
  }
  return nextCards;
}

export function updateContentCard(
  cards: Record<string, ContentCard>,
  cardId: string,
  updates: Pick<ContentCard, "title" | "notes">,
): Record<string, ContentCard> {
  const card = cards[cardId];
  const title = updates.title.trim();
  if (!card || !title) {
    return cards;
  }

  return {
    ...cards,
    [cardId]: {
      ...card,
      title,
      notes: updates.notes.trim(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function deleteContentCard(
  cards: Record<string, ContentCard>,
  cardId: string,
): Record<string, ContentCard> {
  const card = cards[cardId];
  if (!card) {
    return cards;
  }

  const nextCards = { ...cards };
  delete nextCards[cardId];
  return reindexContentCards(
    nextCards,
    card.columnId,
    getContentCardsForColumn(nextCards, card.columnId).map((candidate) => candidate.id),
    new Date().toISOString(),
  );
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
    contentBoard: createDefaultContentBoard(),
    contentCards: {},
    uiState: {
      selectedDailyDate: todayISO,
      selectedNoteId: starterNote.id,
      selectedNoteFolderId: defaultNotesFolder.id,
      selectedPlannerPresetId: starterPlanner.id,
      isSidebarCollapsed: false,
      dailyTaskPaneWidth: 500,
      contentFontScale: CONTENT_FONT_SCALE_DEFAULT,
      expandedYears: [todayISO.slice(0, 4)],
      expandedMonths: [getYearMonth(todayISO)],
      expandedNoteFolders: [defaultNotesFolder.id],
      lastView: "todos",
      themeMode: "dark",
      categoryTheme: "normal",
      isFocusMode: false,
      focusedTodoId: null,
      focusTimerStatus: "idle",
      focusTimerRemainingSeconds: null,
      focusTimerStartedAt: null,
      focusTimerBaseEstimateMinutes: null,
      isFocusTimerCompletionPromptOpen: false,
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

export function ensureContentPlannerState(state: AppState): AppState {
  const repairTimestamp = new Date().toISOString();
  const defaultSubtitles = new Map(
    DEFAULT_CONTENT_COLUMNS.map((column) => [column.id, column.subtitle]),
  );
  const columns = state.contentBoard.columns.map((column) => {
    const defaultSubtitle = defaultSubtitles.get(column.id);
    return !column.subtitle && defaultSubtitle
      ? { ...column, subtitle: defaultSubtitle }
      : column;
  });
  const columnsChanged = columns.some(
    (column, index) => column !== state.contentBoard.columns[index],
  );
  const availableColumnIds = new Set(columns.map((column) => column.id));
  const fallbackColumnId = columns[0]?.id;
  const repairedCards = Object.fromEntries(
    Object.entries(state.contentCards)
      .filter(([, card]) => availableColumnIds.has(card.columnId) || Boolean(fallbackColumnId))
      .map(([cardId, card]) => [
        cardId,
        availableColumnIds.has(card.columnId)
          ? card
          : {
              ...card,
              columnId: fallbackColumnId!,
            },
      ]),
  );
  const cards = columns.reduce(
    (currentCards, column) =>
      reindexContentCards(
        currentCards,
        column.id,
        getContentCardsForColumn(currentCards, column.id).map((card) => card.id),
        repairTimestamp,
      ),
    repairedCards,
  );

  if (
    !columnsChanged &&
    Object.keys(cards).length === Object.keys(state.contentCards).length &&
    Object.values(cards).every((card) => {
      const previous = state.contentCards[card.id];
      return previous && previous.columnId === card.columnId && previous.order === card.order;
    })
  ) {
    return state;
  }

  return {
    ...state,
    contentBoard: columnsChanged
      ? {
          columns,
          updatedAt: repairTimestamp,
        }
      : state.contentBoard,
    contentCards: cards,
  };
}

function cloneCarryoverTodos(todos: Todo[], targetDateISO: string): Todo[] {
  const carriedTodos = todos.filter((todo) => todo.status !== "finished");
  const targetDateKey = targetDateISO.replaceAll("-", "");
  const nextIdByPreviousId = new Map(
    carriedTodos.map((todo, index) => [
      todo.id,
      `todo_carry_${targetDateKey}_${index}`,
    ]),
  );

  return carriedTodos.map((todo) => ({
    ...todo,
    id: nextIdByPreviousId.get(todo.id)!,
    status: "pending",
    createdAt: `${targetDateISO}T00:00:00.000Z`,
    parentId: todo.parentId ? nextIdByPreviousId.get(todo.parentId) : undefined,
  }));
}

function monthKey(dateISO: string): string {
  return getYearMonth(dateISO);
}

export function createCarryoverDailyPage(
  dailyPages: Record<string, DailyPage>,
  targetDateISO: string,
): DailyPage {
  const previousDate = Object.keys(dailyPages)
    .filter((date) => date < targetDateISO)
    .sort()
    .at(-1);
  const previous = previousDate ? dailyPages[previousDate] : null;

  return {
    date: targetDateISO,
    markdown: previous?.markdown ?? "",
    todos: previous ? cloneCarryoverTodos(previous.todos, targetDateISO) : [],
  };
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

  const nextPage = createCarryoverDailyPage(state.dailyPages, todayISO);

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
    bucket.sort((a, b) => TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status]);
  }

  return grouped;
}

export function getSortedDailyDates(state: AppState): string[] {
  return Object.keys(state.dailyPages).sort((a, b) => b.localeCompare(a));
}
