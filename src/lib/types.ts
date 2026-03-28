export type Priority = 1 | 2 | 3;

export type ViewMode = "daily" | "notes" | "planner";
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
  done: boolean;
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
  isSidebarCollapsed: boolean;
  dailyTaskPaneWidth: number;
  expandedYears: string[];
  expandedMonths: string[];
  expandedNoteFolders: string[];
  lastView: ViewMode;
  themeMode: ThemeMode;
  categoryTheme: CategoryTheme;
  isFocusMode: boolean;
  focusedTodoId: string | null;
};

export type AppState = {
  dailyPages: Record<string, DailyPage>;
  notesDocs: Record<string, NoteDoc>;
  noteFolders: Record<string, NoteFolder>;
  plannerPresets: Record<string, PlannerPreset>;
  uiState: UIState;
};
