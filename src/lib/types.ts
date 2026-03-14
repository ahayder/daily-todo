export type Priority = 1 | 2 | 3;

export type ViewMode = "daily" | "notes";
export type ThemeMode = "light" | "dark" | "system";
export type CategoryTheme = "normal" | "adhd1" | "adhd2";



export type Todo = {
  id: string;
  text: string;
  priority: Priority;
  done: boolean;
  createdAt: string;
};

export type DailyPage = {
  date: string;
  markdown: string;
  todos: Todo[];
};

export type NoteDoc = {
  id: string;
  title: string;
  markdown: string;
  updatedAt: string;
};

export type UIState = {
  selectedDailyDate: string | null;
  selectedNoteId: string | null;
  expandedYears: string[];
  expandedMonths: string[];
  lastView: ViewMode;
  themeMode: ThemeMode;
  categoryTheme: CategoryTheme;
};

export type AppState = {
  dailyPages: Record<string, DailyPage>;
  notesDocs: Record<string, NoteDoc>;
  uiState: UIState;
};
