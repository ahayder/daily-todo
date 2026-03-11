export type Priority = 1 | 2 | 3;

export type ViewMode = "daily" | "notes";
export type ThemeMode = "light" | "dark" | "system";

export type Point = {
  x: number;
  y: number;
};

export type DrawingTool = "pen" | "eraser";

export type DrawingStroke = {
  id: string;
  tool: DrawingTool;
  size: number;
  points: Point[];
};

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
  drawingStrokes: DrawingStroke[];
  todos: Todo[];
};

export type NoteDoc = {
  id: string;
  title: string;
  markdown: string;
  drawingStrokes: DrawingStroke[];
  updatedAt: string;
};

export type UIState = {
  selectedDailyDate: string | null;
  selectedNoteId: string | null;
  expandedYears: string[];
  expandedMonths: string[];
  lastView: ViewMode;
  themeMode: ThemeMode;
};

export type AppState = {
  dailyPages: Record<string, DailyPage>;
  notesDocs: Record<string, NoteDoc>;
  uiState: UIState;
};
