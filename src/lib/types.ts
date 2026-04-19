export type Priority = 1 | 2 | 3;
export type TaskStatus = "pending" | "ongoing" | "finished";
export type FocusTimerStatus = "idle" | "running" | "paused";

export type ViewMode = "todos" | "notes" | "planner" | "content-planner";
export type ThemeMode = "light" | "dark" | "system";
export type CategoryTheme = "normal" | "adhd1" | "adhd2";
export type PlannerDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
export type PlannerEventColor =
  | "teal"
  | "gold"
  | "rose"
  | "sage"
  | "lavender";
export type ContentIdeaStatus =
  | "inbox"
  | "curating"
  | "outlined"
  | "scripted"
  | "published"
  | "archived";
export type ContentIdeaSourceType = "human" | "ai";
export type ContentPlannerLayout = "split" | "kanban" | "detail-right";
export type ContentPlannerDensity = "comfortable" | "compact";
export type ContentPlannerViewMode = "list" | "kanban" | "grid";

export type ContentIdeaScoreBreakdown = {
  hook: number;
  proof: number;
  fit: number;
};

export type ContentIdeaHookVariant = {
  id: string;
  value: string;
};

export type ContentIdeaScriptStep = {
  id: string;
  label: string;
  body: string;
  placeholder?: boolean;
  actionLabel: string;
};

export type ContentIdea = {
  id: string;
  code: string;
  hook: string;
  premise: string;
  status: ContentIdeaStatus;
  pillar: string;
  channels: string[];
  tags: string[];
  score: number;
  scoreBreakdown: ContentIdeaScoreBreakdown;
  sourceLabel: string;
  sourceType: ContentIdeaSourceType;
  createdAt: string;
  updatedAt: string;
  hooks: ContentIdeaHookVariant[];
  activeHookId: string | null;
  scriptSteps: ContentIdeaScriptStep[];
};

export type ContentPlannerUIState = {
  layout: ContentPlannerLayout;
  density: ContentPlannerDensity;
  viewMode: ContentPlannerViewMode;
  showLlmPanel: boolean;
  statusFilter: string;
  pillarFilter: string;
  channelFilter: string;
  tagFilter: string;
  searchQuery: string;
};

export type ContentPlannerOptions = {
  pillars: string[];
  platforms: string[];
};

export type PlannerEvent = {
  id: string;
  dayKey: PlannerDayKey;
  title: string;
  startMinutes: number;
  endMinutes: number;
  color: PlannerEventColor;
  notes: string;
};

export type PlannerDay = {
  key: PlannerDayKey;
  title: string;
  events: PlannerEvent[];
};

export type PlannerPreset = {
  id: string;
  name: string;
  dayOrder: PlannerDayKey[];
  days: Record<PlannerDayKey, PlannerDay>;
  updatedAt: string;
};

export type Todo = {
  id: string;
  text: string;
  priority: Priority;
  status: TaskStatus;
  estimatedMinutes: number | null;
  createdAt: string;
  parentId?: string;
};

export type DailyPage = {
  date: string;
  markdown: string;
  todos: Todo[];
};

export type NoteDoc = {
  id: string;
  title: string;
  folderId: string | null;
  markdown?: string;
  updatedAt: string;
};

export type NoteSummary = Pick<NoteDoc, "id" | "title" | "folderId" | "updatedAt">;

export type CachedNoteBody = {
  noteId: string;
  markdown: string;
  updatedAtClient: string | null;
  lastAccessedAt: string;
  expiresAt: string;
};

export type NoteBodyStatus = "idle" | "loading" | "ready" | "error" | "stale-offline";

export type NoteFolder = {
  id: string;
  name: string;
  parentId: string | null;
  updatedAt: string;
};

export type UIState = {
  selectedDailyDate: string | null;
  selectedNoteId: string | null;
  selectedNoteFolderId: string | null;
  selectedPlannerPresetId: string | null;
  selectedContentIdeaId: string | null;
  isSidebarCollapsed: boolean;
  dailyTaskPaneWidth: number;
  contentFontScale: number;
  expandedYears: string[];
  expandedMonths: string[];
  expandedNoteFolders: string[];
  contentPlanner: ContentPlannerUIState;
  lastView: ViewMode;
  themeMode: ThemeMode;
  categoryTheme: CategoryTheme;
  isFocusMode: boolean;
  focusedTodoId: string | null;
  focusTimerStatus: FocusTimerStatus;
  focusTimerRemainingSeconds: number | null;
  focusTimerStartedAt: string | null;
  focusTimerBaseEstimateMinutes: number | null;
  isFocusTimerCompletionPromptOpen: boolean;
};

export type AppState = {
  dailyPages: Record<string, DailyPage>;
  notesDocs: Record<string, NoteDoc>;
  noteFolders: Record<string, NoteFolder>;
  plannerPresets: Record<string, PlannerPreset>;
  contentIdeas: Record<string, ContentIdea>;
  contentPlannerOptions: ContentPlannerOptions;
  uiState: UIState;
};
