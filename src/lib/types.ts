export type Priority = 1 | 2 | 3;
export type TaskStatus = "pending" | "ongoing" | "finished";
export type FocusTimerStatus = "idle" | "running" | "paused";

export type ViewMode =
  | "today"
  | "history"
  | "memory"
  | "project"
  | "standup"
  | "todos"
  | "notes"
  | "planner"
  | "content-planner";
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
export type PlannerPurposeRole = "primary" | "secondary";
export type ContentColumn = {
  id: string;
  title: string;
  subtitle: string;
};

/** A group of videos that belong together. Open-ended: no target count, no order. */
export type ContentSeries = {
  id: string;
  title: string;
  /** What the series is about (optional). */
  about: string;
  createdAt: string;
};

export type ContentBoard = {
  columns: ContentColumn[];
  /** The user's series (stored on the board record). Absent on older boards. */
  series?: ContentSeries[];
  updatedAt: string;
};

export const CONTENT_PLATFORMS = ["youtube", "facebook", "tiktok", "instagram", "linkedin"] as const;
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];
/** Where a published video lives, per platform. Every link is optional. */
export type ContentLinks = Partial<Record<ContentPlatform, string>>;

export type ContentCard = {
  id: string;
  columnId: string;
  title: string;
  notes: string;
  order: number;
  updatedAt: string;
  /** When the card last entered Published (drives the weekly shipped count). */
  publishedAt?: string | null;
  /** Published video links (optional, per platform). */
  links?: ContentLinks;
  /** The published video's transcript (optional). */
  transcript?: string;
  /** The series this video belongs to (at most one). Only present when set. */
  seriesId?: string;
};

export const APP_NOTE_KINDS = ["idea", "improvement", "bug"] as const;
export type AppNoteKind = (typeof APP_NOTE_KINDS)[number];
export type AppNoteStatus = "open" | "done";

/**
 * A quick note about the app itself (idea, improvement, bug) captured while
 * working. Never hard-deleted: deleting sets `deletedAt` and syncs as an edit.
 */
export type AppNote = {
  id: string;
  text: string;
  kind: AppNoteKind;
  status: AppNoteStatus;
  /** Where it was captured: an app view, or "chat" when added through MCP. */
  screen: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PlannerEvent = {
  id: string;
  dayKey: PlannerDayKey;
  purposeId: string | null;
  title: string;
  startMinutes: number;
  endMinutes: number;
  color: PlannerEventColor;
  notes: string;
};

export type PlannerPurpose = {
  id: string;
  title: string;
  color: PlannerEventColor;
  targetMinutes: number;
  role: PlannerPurposeRole;
  notes: string;
};

export type PlannerDay = {
  key: PlannerDayKey;
  title: string;
  purposes: PlannerPurpose[];
  events: PlannerEvent[];
};

export type PlannerPreset = {
  id: string;
  name: string;
  subtitle: string;
  dayOrder: PlannerDayKey[];
  days: Record<PlannerDayKey, PlannerDay>;
  createdAt: string;
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

export type TodoWorkspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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
  selectedTodoWorkspaceId: string;
  selectedNoteId: string | null;
  selectedNoteFolderId: string | null;
  selectedPlannerPresetId: string | null;
  isSidebarCollapsed: boolean;
  hasSeenPlannerTour: boolean;
  dailyTaskPaneWidth: number;
  contentFontScale: number;
  expandedYears: string[];
  expandedMonths: string[];
  expandedNoteFolders: string[];
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
  todoWorkspaces: Record<string, TodoWorkspace>;
  notesDocs: Record<string, NoteDoc>;
  noteFolders: Record<string, NoteFolder>;
  plannerPresets: Record<string, PlannerPreset>;
  contentBoard: ContentBoard;
  contentCards: Record<string, ContentCard>;
  appNotes: Record<string, AppNote>;
  /** External-brain records (tasks, decisions, …), soft-deleted only. */
  memory: MemoryData;
  /** The most recent change-log entries (History and undo). Append-only. */
  changeLog: Record<string, ChangeLogEntry>;
  uiState: UIState;
};

// ---- External brain: records saved from chat (MCP) and shown in the app ----
// None of these are ever hard-deleted: deleting sets `deletedAt`.

export const LIFE_AREAS = ["job", "content", "personal"] as const;
export type LifeArea = (typeof LIFE_AREAS)[number];

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Fields every external-brain record has. */
export type MemoryRecordBase = {
  id: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type Task = MemoryRecordBase & {
  title: string;
  notes: string;
  area: LifeArea | null;
  status: "open" | "done";
  /** YYYY-MM-DD, or null = on the Shelf (no day yet). */
  day: string | null;
  /** A PlannerEvent id (a time block of the Daily Planner). */
  blockId: string | null;
  projectId: string | null;
  link: string;
  whyDecisionId: string | null;
  /** Set when this row is a completed (or scheduled) instance of a repeat. */
  repeatId: string | null;
  contentCardId: string | null;
  /** "app" or "chat:<name>". */
  source: string;
  doneAt: string | null;
};

export const DECISION_STATUSES = ["agreed", "proposed", "yours"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export type Decision = MemoryRecordBase & {
  title: string;
  why: string;
  status: DecisionStatus;
  /** Where it came from, e.g. "Standup · Brian". */
  source: string;
  people: string[];
  projectId: string | null;
  replacesId: string | null;
  replacedById: string | null;
  revisitOn: string | null;
  decidedOn: string | null;
};

export type Project = MemoryRecordBase & {
  name: string;
  area: LifeArea | null;
  /** Where it stands. */
  state: string;
  nextStep: string;
  status: "active" | "paused" | "done";
};

export type Meeting = MemoryRecordBase & {
  title: string;
  date: string;
  projectId: string | null;
  /** Markdown summary. */
  summary: string;
  people: string[];
  /** Raw transcript, only when the user asked to keep it. Usually "". */
  transcript: string;
};

export type FollowUp = MemoryRecordBase & {
  what: string;
  who: string;
  since: string;
  projectId: string | null;
  status: "waiting" | "done";
  doneAt: string | null;
};

export type Repeat = MemoryRecordBase & {
  title: string;
  area: LifeArea | null;
  days: Weekday[];
  /** HH:MM, or "" for any time of day. */
  time: string;
  projectId: string | null;
  whyDecisionId: string | null;
  active: boolean;
};

export type MemoryKindMap = {
  task: Task;
  decision: Decision;
  project: Project;
  meeting: Meeting;
  follow_up: FollowUp;
  repeat: Repeat;
};
export type MemoryKind = keyof MemoryKindMap;
/** Every external-brain record, by kind and id. */
export type MemoryData = { [K in MemoryKind]: Record<string, MemoryKindMap[K]> };
export const MEMORY_KINDS = ["task", "decision", "project", "meeting", "follow_up", "repeat"] as const;

/** Everything the change log can point at. */
export type ChangeEntityKind = MemoryKind | "content_card" | "content_board" | "app_note";
export type ChangeAction = "create" | "update" | "delete" | "restore" | "undo" | "redo";

/** One saved change: what a record looked like before and after a write. */
export type ChangeLogEntry = {
  id: string;
  /** One tool call = one batch; undo works on the whole batch. */
  batchId: string;
  entityKind: ChangeEntityKind;
  entityId: string;
  action: ChangeAction;
  source: string;
  summary: string;
  before: unknown;
  after: unknown;
  /** The change an undo/redo reverses or re-applies. */
  refChangeId: string | null;
  at: string;
};
