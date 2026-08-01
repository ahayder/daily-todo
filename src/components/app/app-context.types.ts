import type { Dispatch, ReactNode } from "react";
import type {
  AppState,
  CategoryTheme,
  NoteBodyStatus,
  PlannerDayKey,
  PlannerEventColor,
  Priority,
  TaskStatus,
  ThemeMode,
  ViewMode,
} from "@/lib/types";
import type {
  PersistenceRepository,
  PersistenceStatus,
} from "@/lib/persistence";

export type AppAction =
  | { type: "set-view"; view: ViewMode }
  | { type: "toggle-sidebar-collapsed" }
  | { type: "set-sidebar-collapsed"; isCollapsed: boolean }
  | { type: "set-daily-task-pane-width"; width: number }
  | { type: "increase-content-font-scale" }
  | { type: "decrease-content-font-scale" }
  | { type: "reset-content-font-scale" }
  | { type: "set-theme-mode"; themeMode: ThemeMode }
  | { type: "set-category-theme"; theme: CategoryTheme }
  | { type: "select-daily"; date: string }
  | { type: "toggle-year"; year: string }
  | { type: "toggle-month"; month: string }
  | { type: "toggle-note-folder"; folderId: string }
  | { type: "update-daily-markdown"; date: string; markdown: string }
  | { type: "add-todo"; date: string; text: string; priority: Priority; parentId?: string }
  | { type: "set-todo-status"; date: string; todoId: string; status: TaskStatus }
  | { type: "set-todo-estimated-minutes"; date: string; todoId: string; estimatedMinutes: number | null }
  | { type: "delete-todo"; date: string; todoId: string }
  | { type: "create-note"; title?: string }
  | { type: "create-note-folder"; name?: string; parentFolderId?: string | null }
  | { type: "rename-note-folder"; folderId: string; name: string }
  | { type: "delete-note-folder"; folderId: string }
  | { type: "move-note-to-folder"; noteId: string; folderId: string | null }
  | { type: "select-note-folder"; folderId: string | null }
  | { type: "select-note"; noteId: string }
  | { type: "rename-note"; noteId: string; title: string }
  | { type: "delete-note"; noteId: string }
  | { type: "update-note-markdown"; noteId: string; markdown: string }
  | { type: "select-planner-preset"; presetId: string }
  | { type: "add-content-column"; title: string; subtitle?: string }
  | { type: "rename-content-column"; columnId: string; title: string }
  | { type: "update-content-column-subtitle"; columnId: string; subtitle: string }
  | { type: "reorder-content-columns"; activeColumnId: string; overColumnId: string }
  | { type: "delete-content-column"; columnId: string }
  | { type: "create-content-card"; columnId: string; title: string; notes?: string }
  | { type: "update-content-card"; cardId: string; title: string; notes: string }
  | { type: "move-content-card"; cardId: string; targetColumnId: string; targetIndex: number }
  | { type: "delete-content-card"; cardId: string }
  | { type: "create-planner-preset"; name?: string }
  | { type: "duplicate-planner-preset"; presetId: string }
  | { type: "delete-planner-preset"; presetId: string }
  | { type: "rename-planner-preset"; presetId: string; name: string }
  | { type: "rename-planner-day"; presetId: string; dayKey: PlannerDayKey; title: string }
  | {
      type: "create-planner-event";
      presetId: string;
      dayKey: PlannerDayKey;
      title?: string;
      startMinutes: number;
      endMinutes: number;
      color?: PlannerEventColor;
      notes?: string;
    }
  | {
      type: "update-planner-event";
      presetId: string;
      dayKey: PlannerDayKey;
      eventId: string;
      updates: Partial<{
        title: string;
        startMinutes: number;
        endMinutes: number;
        color: PlannerEventColor;
        notes: string;
      }>;
    }
  | { type: "delete-planner-event"; presetId: string; dayKey: PlannerDayKey; eventId: string }
  | { type: "edit-todo"; date: string; todoId: string; text: string }
  | { type: "move-todo-priority"; date: string; todoId: string; newPriority: Priority; newIndex: number }
  | { type: "set-focus-mode"; isFocus: boolean; todoId?: string | null }
  | { type: "start-focus-timer"; date: string; todoId: string; estimateMinutes?: number | null }
  | { type: "pause-focus-timer" }
  | { type: "resume-focus-timer" }
  | { type: "reset-focus-timer" }
  | { type: "tick-focus-timer" }
  | {
      type: "resolve-focus-timer-complete";
      resolution: "finish" | "keep-ongoing" | "add-time";
      extraMinutes?: number;
    };

export type AppContextValue = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  notes: {
    selectedBodyStatus: NoteBodyStatus;
    selectedBodyNotice: string | null;
    selectedBodyError: string | null;
  };
  sync: {
    status: PersistenceStatus;
    indicator: "saved" | "saving" | "unsynced" | "issue";
    lastSavedAt: string | null;
    lastSyncedAt: string | null;
    notice: string | null;
    errorMessage: string | null;
    hasPendingChanges: boolean;
    hasUnsyncedChanges: boolean;
    isSaving: boolean;
    persistenceAvailable: boolean;
  };
  retrySync: () => Promise<void>;
};

export type AppProviderProps = {
  children: ReactNode;
  repository: PersistenceRepository;
};
