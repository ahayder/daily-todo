import { getYearMonth } from "@/lib/date";
import { CONTENT_FONT_SCALE_DEFAULT } from "@/lib/content-font-scale";
import type {
  AppState,
  ContentIdea,
  ContentIdeaHookVariant,
  ContentPlannerOptions,
  ContentIdeaScriptStep,
  ContentPlannerUIState,
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
export const CONTENT_PLANNER_DEFAULT_UI_STATE: ContentPlannerUIState = {
  layout: "split",
  density: "comfortable",
  viewMode: "list",
  showLlmPanel: true,
  statusFilter: "all",
  pillarFilter: "all",
  channelFilter: "all",
  tagFilter: "all",
  searchQuery: "",
};
export const CONTENT_PLANNER_DEFAULT_OPTIONS: ContentPlannerOptions = {
  pillars: ["Teach"],
  platforms: ["LinkedIn"],
};

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

export function createContentIdeaHookVariant(value: string): ContentIdeaHookVariant {
  return {
    id: makeId("content-hook"),
    value,
  };
}

export function createContentIdeaScriptStep(input: {
  label: string;
  body: string;
  placeholder?: boolean;
  actionLabel: string;
}): ContentIdeaScriptStep {
  return {
    id: makeId("content-step"),
    label: input.label,
    body: input.body,
    placeholder: input.placeholder,
    actionLabel: input.actionLabel,
  };
}

export function createContentIdea(input: {
  hook: string;
  premise: string;
  status?: ContentIdea["status"];
  pillar?: string;
  channels?: string[];
  tags?: string[];
  score?: number;
  scoreBreakdown?: ContentIdea["scoreBreakdown"];
  sourceLabel?: string;
  sourceType?: ContentIdea["sourceType"];
  hooks?: ContentIdeaHookVariant[];
  activeHookId?: string | null;
  scriptSteps?: ContentIdeaScriptStep[];
}): ContentIdea {
  const createdAt = new Date().toISOString();
  const hooks =
    input.hooks ??
    (input.hook.trim() ? [createContentIdeaHookVariant(input.hook.trim())] : []);

  return {
    id: makeId("content-idea"),
    code: `#${Math.floor(1000 + Math.random() * 9000)}`,
    hook: input.hook.trim(),
    premise: input.premise.trim(),
    status: input.status ?? "inbox",
    pillar: input.pillar ?? "Teach",
    channels: input.channels ?? ["LinkedIn"],
    tags: input.tags ?? [],
    score: input.score ?? 7.5,
    scoreBreakdown: input.scoreBreakdown ?? {
      hook: 8,
      proof: 7,
      fit: 8,
    },
    sourceLabel: input.sourceLabel ?? "manual",
    sourceType: input.sourceType ?? "human",
    createdAt,
    updatedAt: createdAt,
    hooks,
    activeHookId: input.activeHookId ?? hooks[0]?.id ?? null,
    scriptSteps: input.scriptSteps ?? [],
  };
}

function normalizeContentPlannerOptionValue(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function mergeContentPlannerOptionValues(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const normalizedValues: string[] = [];

  for (const value of values) {
    const normalized = normalizeContentPlannerOptionValue(value);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalizedValues.push(normalized);
  }

  return normalizedValues;
}

export function createContentPlannerOptions(
  input: Partial<ContentPlannerOptions> = {},
): ContentPlannerOptions {
  return {
    pillars: mergeContentPlannerOptionValues(input.pillars ?? []),
    platforms: mergeContentPlannerOptionValues(input.platforms ?? []),
  };
}

export function createDefaultContentPlannerOptions(
  input: Partial<ContentPlannerOptions> = {},
): ContentPlannerOptions {
  return createContentPlannerOptions({
    pillars: [...CONTENT_PLANNER_DEFAULT_OPTIONS.pillars, ...(input.pillars ?? [])],
    platforms: [...CONTENT_PLANNER_DEFAULT_OPTIONS.platforms, ...(input.platforms ?? [])],
  });
}

export function registerContentPlannerIdeaOptions(
  options: ContentPlannerOptions,
  input: {
    pillar?: string | null;
    platforms?: string[] | null;
  },
): ContentPlannerOptions {
  return createContentPlannerOptions({
    pillars: [...options.pillars, input.pillar ?? ""],
    platforms: [...options.platforms, ...(input.platforms ?? [])],
  });
}

export function removeContentPlannerOption(
  options: ContentPlannerOptions,
  kind: keyof ContentPlannerOptions,
  value: string,
): ContentPlannerOptions {
  const normalizedTarget = normalizeContentPlannerOptionValue(value).toLocaleLowerCase();
  if (!normalizedTarget) {
    return options;
  }

  return createContentPlannerOptions({
    ...options,
    [kind]: options[kind].filter(
      (option) => normalizeContentPlannerOptionValue(option).toLocaleLowerCase() !== normalizedTarget,
    ),
  });
}

export function isContentPlannerOptionInUse(
  ideas: Record<string, ContentIdea>,
  kind: keyof ContentPlannerOptions,
  value: string,
): boolean {
  const normalizedTarget = normalizeContentPlannerOptionValue(value).toLocaleLowerCase();
  if (!normalizedTarget) return false;

  return Object.values(ideas).some((idea) => {
    if (kind === "pillars") {
      return normalizeContentPlannerOptionValue(idea.pillar).toLocaleLowerCase() === normalizedTarget;
    }

    return idea.channels.some(
      (channel) => normalizeContentPlannerOptionValue(channel).toLocaleLowerCase() === normalizedTarget,
    );
  });
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
    contentIdeas: {},
    contentPlannerOptions: createDefaultContentPlannerOptions(),
    uiState: {
      selectedDailyDate: todayISO,
      selectedNoteId: starterNote.id,
      selectedNoteFolderId: defaultNotesFolder.id,
      selectedPlannerPresetId: starterPlanner.id,
      selectedContentIdeaId: null,
      isSidebarCollapsed: false,
      dailyTaskPaneWidth: 500,
      contentFontScale: CONTENT_FONT_SCALE_DEFAULT,
      expandedYears: [todayISO.slice(0, 4)],
      expandedMonths: [getYearMonth(todayISO)],
      expandedNoteFolders: [defaultNotesFolder.id],
      contentPlanner: { ...CONTENT_PLANNER_DEFAULT_UI_STATE },
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
  const contentIdeas = state.contentIdeas ?? {};
  const contentPlannerOptions = Object.values(contentIdeas).reduce(
    (options, idea) =>
      registerContentPlannerIdeaOptions(options, {
        pillar: idea.pillar,
        platforms: idea.channels,
      }),
    state.contentPlannerOptions
      ? createContentPlannerOptions(state.contentPlannerOptions)
      : createDefaultContentPlannerOptions(),
  );
  const contentPlanner = {
    ...CONTENT_PLANNER_DEFAULT_UI_STATE,
    ...(state.uiState.contentPlanner ?? {}),
  };
  const selectedContentIdeaId =
    state.uiState.selectedContentIdeaId && contentIdeas[state.uiState.selectedContentIdeaId]
      ? state.uiState.selectedContentIdeaId
      : Object.keys(contentIdeas)[0] ?? null;

  if (
    contentIdeas === state.contentIdeas &&
    JSON.stringify(contentPlannerOptions) === JSON.stringify(state.contentPlannerOptions) &&
    selectedContentIdeaId === state.uiState.selectedContentIdeaId &&
    state.uiState.contentPlanner &&
    Object.entries(CONTENT_PLANNER_DEFAULT_UI_STATE).every(
      ([key]) =>
        contentPlanner[key as keyof ContentPlannerUIState] ===
        state.uiState.contentPlanner[key as keyof ContentPlannerUIState] &&
        state.uiState.contentPlanner[key as keyof ContentPlannerUIState] !== undefined,
    )
  ) {
    return state;
  }

  return {
    ...state,
    contentIdeas,
    contentPlannerOptions,
    uiState: {
      ...state.uiState,
      selectedContentIdeaId,
      contentPlanner,
    },
  };
}

function cloneCarryoverTodos(todos: Todo[]): Todo[] {
  return todos
    .filter((todo) => todo.status !== "finished")
    .map((todo) => ({
      ...todo,
      id: makeId("todo"),
      status: "pending",
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
    bucket.sort((a, b) => TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status]);
  }

  return grouped;
}

export function getSortedDailyDates(state: AppState): string[] {
  return Object.keys(state.dailyPages).sort((a, b) => b.localeCompare(a));
}
