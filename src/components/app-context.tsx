"use client";

import {
  startTransition,
  useCallback,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/components/auth-context";
import { VerificationPendingScreen } from "@/components/verification-pending-screen";
import {
  createPlannerEvent,
  createPlannerPreset,
  createNoteDoc,
  createNoteFolder,
  DEFAULT_NOTES_FOLDER_ID,
  createTodo,
  duplicatePlannerPreset,
  getSortedDailyDates,
} from "@/lib/store";
import {
  createPersistenceMetadata,
  normalizeAppState,
  seedAppState,
  stripNoteBodies,
  type PersistenceMetadata,
  type PersistenceRepository,
  type PersistenceStatus,
} from "@/lib/persistence";
import {
  DEV_WORKSPACE_STATE_KEY,
  isDevelopmentWorkspaceSession,
} from "@/lib/dev-mode";
import type {
  AppState,
  CategoryTheme,
  FocusTimerStatus,
  NoteBodyStatus,
  PlannerDayKey,
  PlannerEventColor,
  Priority,
  TaskStatus,
  ThemeMode,
  ViewMode,
} from "@/lib/types";

export type AppAction =
  | { type: "set-view"; view: ViewMode }
  | { type: "toggle-sidebar-collapsed" }
  | { type: "set-sidebar-collapsed"; isCollapsed: boolean }
  | { type: "set-daily-task-pane-width"; width: number }
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

function toggleString(list: string[], value: string): string[] {
  if (list.includes(value)) {
    return list.filter((item) => item !== value);
  }
  return [...list, value];
}

function clearFocusTimerState(state: AppState["uiState"], overrides: Partial<AppState["uiState"]> = {}) {
  return {
    ...state,
    focusTimerStatus: "idle" as FocusTimerStatus,
    focusTimerRemainingSeconds: null,
    focusTimerStartedAt: null,
    focusTimerBaseEstimateMinutes: null,
    isFocusTimerCompletionPromptOpen: false,
    ...overrides,
  };
}

function stopFocusTimerForTodo(state: AppState, todoId: string | null) {
  if (!todoId || state.uiState.focusedTodoId !== todoId) {
    return state.uiState;
  }

  return clearFocusTimerState(state.uiState, {
    focusedTodoId: null,
    isFocusMode: false,
  });
}

function ensureSelectedDailyDate(state: AppState): string {
  const existing = state.uiState.selectedDailyDate;
  if (existing && state.dailyPages[existing]) {
    return existing;
  }
  const sorted = getSortedDailyDates(state);
  return sorted[0];
}

function ensureSelectedNoteId(state: AppState): string | null {
  const existing = state.uiState.selectedNoteId;
  if (existing && state.notesDocs[existing]) {
    return existing;
  }
  if (state.uiState.selectedNoteFolderId) {
    return null;
  }
  const first = Object.keys(state.notesDocs)[0];
  return first ?? null;
}

function ensureSelectedNoteFolderId(state: AppState): string | null {
  const existing = state.uiState.selectedNoteFolderId;
  if (existing && state.noteFolders[existing]) {
    return existing;
  }

  return null;
}

function collectFolderTreeIds(
  folders: AppState["noteFolders"],
  rootFolderId: string,
): Set<string> {
  const ids = new Set<string>();
  const stack = [rootFolderId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || ids.has(currentId) || !folders[currentId]) {
      continue;
    }

    ids.add(currentId);

    for (const folder of Object.values(folders)) {
      if (folder.parentId === currentId) {
        stack.push(folder.id);
      }
    }
  }

  return ids;
}

function expandFolderPath(
  expandedFolderIds: string[],
  folders: AppState["noteFolders"],
  folderId: string | null | undefined,
): string[] {
  const nextExpanded = new Set(
    expandedFolderIds.filter((expandedFolderId) => Boolean(folders[expandedFolderId])),
  );

  let currentFolderId = folderId;
  while (currentFolderId && folders[currentFolderId]) {
    nextExpanded.add(currentFolderId);
    currentFolderId = folders[currentFolderId].parentId;
  }

  if (folders[DEFAULT_NOTES_FOLDER_ID]) {
    nextExpanded.add(DEFAULT_NOTES_FOLDER_ID);
  }

  return Array.from(nextExpanded);
}

function ensureSelectedPlannerPresetId(state: AppState): string {
  const existing = state.uiState.selectedPlannerPresetId;
  if (existing && state.plannerPresets[existing]) {
    return existing;
  }
  const first = Object.keys(state.plannerPresets)[0];
  return first;
}

function clampPlannerMinutes(value: number): number {
  return Math.min(24 * 60, Math.max(0, value));
}

function normalizePlannerRange(startMinutes: number, endMinutes: number) {
  const start = clampPlannerMinutes(Math.min(startMinutes, endMinutes));
  const end = clampPlannerMinutes(Math.max(startMinutes, endMinutes));

  return {
    startMinutes: start,
    endMinutes: Math.max(start + 30, end),
  };
}

function saveDevelopmentWorkspaceState(nextState: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEV_WORKSPACE_STATE_KEY, JSON.stringify(nextState));
}

function loadDevelopmentWorkspaceState() {
  if (typeof window === "undefined") {
    return seedAppState(new Date());
  }

  const saved = window.localStorage.getItem(DEV_WORKSPACE_STATE_KEY);
  if (!saved) {
    return seedAppState(new Date());
  }

  try {
    return normalizeAppState(JSON.parse(saved), new Date());
  } catch {
    return seedAppState(new Date());
  }
}

function serializeStateForSync(state: AppState) {
  return JSON.stringify(stripNoteBodies(state));
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set-view":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          lastView: action.view,
        },
      };
    case "toggle-sidebar-collapsed":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          isSidebarCollapsed: !state.uiState.isSidebarCollapsed,
        },
      };
    case "set-sidebar-collapsed":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          isSidebarCollapsed: action.isCollapsed,
        },
      };
    case "set-daily-task-pane-width":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          dailyTaskPaneWidth: action.width,
        },
      };
    case "set-theme-mode":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          themeMode: action.themeMode,
        },
      };
    case "set-category-theme":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          categoryTheme: action.theme,
        },
      };
    case "set-focus-mode":
      return {
        ...state,
        uiState: {
          ...(action.isFocus
            ? state.uiState
            : clearFocusTimerState(state.uiState, { focusedTodoId: null })),
          isFocusMode: action.isFocus,
          focusedTodoId: action.todoId ?? null,
        },
      };
    case "select-daily":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          selectedDailyDate: action.date,
          lastView: "todos",
        },
      };
    case "toggle-year":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          expandedYears: toggleString(state.uiState.expandedYears, action.year),
        },
      };
    case "toggle-month":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          expandedMonths: toggleString(state.uiState.expandedMonths, action.month),
        },
      };
    case "toggle-note-folder":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          expandedNoteFolders: toggleString(state.uiState.expandedNoteFolders, action.folderId),
        },
      };
    case "update-daily-markdown": {
      const page = state.dailyPages[action.date];
      if (!page) return state;
      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            markdown: action.markdown,
          },
        },
      };
    }
    case "add-todo": {
      const page = state.dailyPages[action.date];
      if (!page || !action.text.trim()) return state;
      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: [...page.todos, createTodo(action.text.trim(), action.priority, action.parentId)],
          },
        },
      };
    }
    case "set-todo-status": {
      const page = state.dailyPages[action.date];
      if (!page) return state;
      const nextUiState =
        action.status === "finished"
          ? stopFocusTimerForTodo(state, action.todoId)
          : state.uiState;

      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: page.todos.map((todo) =>
              todo.id === action.todoId
                ? {
                    ...todo,
                    status: action.status,
                  }
                : todo,
            ),
          },
        },
        uiState: nextUiState,
      };
    }
    case "set-todo-estimated-minutes": {
      const page = state.dailyPages[action.date];
      if (!page) return state;

      const nextEstimatedMinutes =
        action.estimatedMinutes && action.estimatedMinutes > 0 ? action.estimatedMinutes : null;
      const updatedTodos = page.todos.map((todo) =>
        todo.id === action.todoId ? { ...todo, estimatedMinutes: nextEstimatedMinutes } : todo,
      );
      const updatedTodo = updatedTodos.find((todo) => todo.id === action.todoId) ?? null;
      const nextUiState =
        state.uiState.focusedTodoId === action.todoId
          ? {
              ...state.uiState,
              focusTimerBaseEstimateMinutes:
                state.uiState.focusTimerStatus === "idle"
                  ? updatedTodo?.estimatedMinutes ?? null
                  : state.uiState.focusTimerBaseEstimateMinutes,
            }
          : state.uiState;

      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: updatedTodos,
          },
        },
        uiState: nextUiState,
      };
    }
    case "edit-todo": {
      const page = state.dailyPages[action.date];
      if (!page || !action.text.trim()) return state;
      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: page.todos.map((todo) =>
              todo.id === action.todoId ? { ...todo, text: action.text.trim() } : todo,
            ),
          },
        },
      };
    }
    case "move-todo-priority": {
      const page = state.dailyPages[action.date];
      if (!page) return state;

      const todoIndex = page.todos.findIndex((t) => t.id === action.todoId);
      if (todoIndex === -1) return state;

      const todo = page.todos[todoIndex];
      const newTodos = [...page.todos];

      // Remove from old position
      newTodos.splice(todoIndex, 1);

      // We need to insert it at the right index within the new priority group.
      // But page.todos is a flat list. We need to find the absolute insertion index.
      const todosInNewPriority = newTodos.filter((t) => t.priority === action.newPriority);
      const insertAtRelative = Math.min(Math.max(0, action.newIndex), todosInNewPriority.length);
      
      let absoluteInsertIndex = newTodos.length;
      if (insertAtRelative < todosInNewPriority.length) {
          const targetTodoId = todosInNewPriority[insertAtRelative].id;
          absoluteInsertIndex = newTodos.findIndex((t) => t.id === targetTodoId);
      }

      newTodos.splice(absoluteInsertIndex, 0, { ...todo, priority: action.newPriority });

      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: newTodos,
          },
        },
      };
    }
    case "start-focus-timer": {
      const page = state.dailyPages[action.date];
      if (!page) return state;

      const todo = page.todos.find((item) => item.id === action.todoId);
      if (!todo) return state;

      const baseEstimateMinutes =
        action.estimateMinutes ?? todo.estimatedMinutes ?? state.uiState.focusTimerBaseEstimateMinutes;

      if (!baseEstimateMinutes || baseEstimateMinutes <= 0) {
        return state;
      }

      const remainingSeconds =
        state.uiState.focusedTodoId === action.todoId &&
        state.uiState.focusTimerStatus === "paused" &&
        state.uiState.focusTimerRemainingSeconds !== null
          ? state.uiState.focusTimerRemainingSeconds
          : baseEstimateMinutes * 60;

      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: page.todos.map((item) =>
              item.id === action.todoId && item.status === "pending"
                ? { ...item, status: "ongoing" }
                : item,
            ),
          },
        },
        uiState: {
          ...state.uiState,
          isFocusMode: true,
          focusedTodoId: action.todoId,
          focusTimerStatus: "running",
          focusTimerRemainingSeconds: remainingSeconds,
          focusTimerStartedAt: new Date().toISOString(),
          focusTimerBaseEstimateMinutes: baseEstimateMinutes,
          isFocusTimerCompletionPromptOpen: false,
        },
      };
    }
    case "pause-focus-timer":
      if (state.uiState.focusTimerStatus !== "running") {
        return state;
      }
      return {
        ...state,
        uiState: {
          ...state.uiState,
          focusTimerStatus: "paused",
          focusTimerStartedAt: null,
        },
      };
    case "resume-focus-timer":
      if (
        state.uiState.focusTimerStatus !== "paused" ||
        !state.uiState.focusedTodoId ||
        !state.uiState.focusTimerRemainingSeconds ||
        state.uiState.focusTimerRemainingSeconds <= 0
      ) {
        return state;
      }
      return {
        ...state,
        uiState: {
          ...state.uiState,
          focusTimerStatus: "running",
          focusTimerStartedAt: new Date().toISOString(),
          isFocusTimerCompletionPromptOpen: false,
        },
      };
    case "reset-focus-timer": {
      const resetSeconds = state.uiState.focusTimerBaseEstimateMinutes
        ? state.uiState.focusTimerBaseEstimateMinutes * 60
        : null;
      return {
        ...state,
        uiState: {
          ...state.uiState,
          focusTimerStatus: "idle",
          focusTimerRemainingSeconds: resetSeconds,
          focusTimerStartedAt: null,
          isFocusTimerCompletionPromptOpen: false,
        },
      };
    }
    case "tick-focus-timer":
      if (
        state.uiState.focusTimerStatus !== "running" ||
        state.uiState.focusTimerRemainingSeconds === null
      ) {
        return state;
      }

      if (state.uiState.focusTimerRemainingSeconds <= 1) {
        return {
          ...state,
          uiState: {
            ...state.uiState,
            focusTimerStatus: "paused",
            focusTimerRemainingSeconds: 0,
            focusTimerStartedAt: null,
            isFocusTimerCompletionPromptOpen: true,
          },
        };
      }

      return {
        ...state,
        uiState: {
          ...state.uiState,
          focusTimerRemainingSeconds: state.uiState.focusTimerRemainingSeconds - 1,
        },
      };
    case "resolve-focus-timer-complete": {
      if (!state.uiState.focusedTodoId) {
        return {
          ...state,
          uiState: clearFocusTimerState(state.uiState),
        };
      }

      if (action.resolution === "keep-ongoing") {
        return {
          ...state,
          uiState: {
            ...state.uiState,
            focusTimerStatus: "idle",
            focusTimerStartedAt: null,
            isFocusTimerCompletionPromptOpen: false,
          },
        };
      }

      if (action.resolution === "add-time") {
        const extraMinutes = action.extraMinutes && action.extraMinutes > 0 ? action.extraMinutes : 5;
        return {
          ...state,
          uiState: {
            ...state.uiState,
            focusTimerStatus: "running",
            focusTimerRemainingSeconds: extraMinutes * 60,
            focusTimerStartedAt: new Date().toISOString(),
            isFocusTimerCompletionPromptOpen: false,
          },
        };
      }

      return {
        ...state,
        dailyPages: Object.fromEntries(
          Object.entries(state.dailyPages).map(([dateKey, page]) => [
            dateKey,
            {
              ...page,
              todos: page.todos.map((todo) =>
                todo.id === state.uiState.focusedTodoId ? { ...todo, status: "finished" } : todo,
              ),
            },
          ]),
        ),
        uiState: clearFocusTimerState(state.uiState, {
          isFocusMode: false,
          focusedTodoId: null,
        }),
      };
    }
    case "delete-todo": {
      const page = state.dailyPages[action.date];
      if (!page) return state;
      const nextUiState =
        state.uiState.focusedTodoId === action.todoId
          ? clearFocusTimerState(state.uiState, {
              isFocusMode: false,
              focusedTodoId: null,
            })
          : state.uiState;
      return {
        ...state,
        dailyPages: {
          ...state.dailyPages,
          [action.date]: {
            ...page,
            todos: page.todos.filter((todo) => todo.id !== action.todoId),
          },
        },
        uiState: nextUiState,
      };
    }
    case "create-note": {
      const selectedNote = state.uiState.selectedNoteId
        ? state.notesDocs[state.uiState.selectedNoteId]
        : null;
      const folderId =
        state.uiState.selectedNoteFolderId ??
        selectedNote?.folderId ??
        DEFAULT_NOTES_FOLDER_ID;
      const note = createNoteDoc(action.title, folderId);
      return {
        ...state,
        notesDocs: {
          ...state.notesDocs,
          [note.id]: note,
        },
        uiState: {
          ...state.uiState,
          selectedNoteId: note.id,
          selectedNoteFolderId: folderId,
          expandedNoteFolders: expandFolderPath(
            state.uiState.expandedNoteFolders,
            state.noteFolders,
            folderId,
          ),
          lastView: "notes",
        },
      };
    }
    case "create-note-folder": {
      const parentFolderId =
        action.parentFolderId === undefined
          ? state.uiState.selectedNoteFolderId
          : action.parentFolderId;
      const folder = createNoteFolder(action.name, parentFolderId ?? null);

      return {
        ...state,
        noteFolders: {
          ...state.noteFolders,
          [folder.id]: folder,
        },
        uiState: {
          ...state.uiState,
          selectedNoteFolderId: folder.id,
          selectedNoteId: null,
          expandedNoteFolders: expandFolderPath(
            state.uiState.expandedNoteFolders,
            {
              ...state.noteFolders,
              [folder.id]: folder,
            },
            folder.id,
          ),
          lastView: "notes",
        },
      };
    }
    case "rename-note-folder": {
      const folder = state.noteFolders[action.folderId];
      if (!folder) return state;
      if (action.folderId === DEFAULT_NOTES_FOLDER_ID) return state;

      return {
        ...state,
        noteFolders: {
          ...state.noteFolders,
          [action.folderId]: {
            ...folder,
            name: action.name.trim() || "New Folder",
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }
    case "move-note-to-folder": {
      const note = state.notesDocs[action.noteId];
      if (!note) return state;
      const nextFolderId = action.folderId ?? DEFAULT_NOTES_FOLDER_ID;
      if (!state.noteFolders[nextFolderId]) return state;

      return {
        ...state,
        notesDocs: {
          ...state.notesDocs,
          [action.noteId]: {
            ...note,
            folderId: nextFolderId,
            updatedAt: new Date().toISOString(),
          },
        },
        uiState: {
          ...state.uiState,
          selectedNoteId: action.noteId,
          selectedNoteFolderId: nextFolderId,
          expandedNoteFolders: expandFolderPath(
            state.uiState.expandedNoteFolders,
            state.noteFolders,
            nextFolderId,
          ),
          lastView: "notes",
        },
      };
    }
    case "delete-note-folder": {
      if (!state.noteFolders[action.folderId]) return state;
      if (action.folderId === DEFAULT_NOTES_FOLDER_ID) return state;

      const deletedFolderIds = collectFolderTreeIds(state.noteFolders, action.folderId);
      const nextNoteFolders = Object.fromEntries(
        Object.entries(state.noteFolders).filter(([folderId]) => !deletedFolderIds.has(folderId)),
      );
      const nextNotesDocs = Object.fromEntries(
        Object.entries(state.notesDocs).filter(
          ([, note]) => !note.folderId || !deletedFolderIds.has(note.folderId),
        ),
      );

      return {
        ...state,
        noteFolders: nextNoteFolders,
        notesDocs: nextNotesDocs,
        uiState: {
          ...state.uiState,
          selectedNoteFolderId:
            state.uiState.selectedNoteFolderId &&
            deletedFolderIds.has(state.uiState.selectedNoteFolderId)
              ? null
              : state.uiState.selectedNoteFolderId,
          selectedNoteId:
            state.uiState.selectedNoteId && nextNotesDocs[state.uiState.selectedNoteId]
              ? state.uiState.selectedNoteId
              : null,
          expandedNoteFolders: state.uiState.expandedNoteFolders.filter(
            (folderId) => !deletedFolderIds.has(folderId) && Boolean(nextNoteFolders[folderId]),
          ),
          lastView: "notes",
        },
      };
    }
    case "select-note-folder":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          selectedNoteFolderId: action.folderId,
          selectedNoteId: null,
          expandedNoteFolders: expandFolderPath(
            state.uiState.expandedNoteFolders,
            state.noteFolders,
            action.folderId,
          ),
          lastView: "notes",
        },
      };
    case "select-planner-preset":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          selectedPlannerPresetId: action.presetId,
          lastView: "planner",
        },
      };
    case "create-planner-preset": {
      const preset = createPlannerPreset(action.name);
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [preset.id]: preset,
        },
        uiState: {
          ...state.uiState,
          selectedPlannerPresetId: preset.id,
          lastView: "planner",
        },
      };
    }
    case "duplicate-planner-preset": {
      const source = state.plannerPresets[action.presetId];
      if (!source) return state;
      const preset = duplicatePlannerPreset(source);
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [preset.id]: preset,
        },
        uiState: {
          ...state.uiState,
          selectedPlannerPresetId: preset.id,
          lastView: "planner",
        },
      };
    }
    case "delete-planner-preset": {
      if (!state.plannerPresets[action.presetId]) return state;

      const remainingEntries = Object.entries(state.plannerPresets).filter(
        ([id]) => id !== action.presetId,
      );

      if (!remainingEntries.length) {
        const preset = createPlannerPreset();
        return {
          ...state,
          plannerPresets: {
            [preset.id]: preset,
          },
          uiState: {
            ...state.uiState,
            selectedPlannerPresetId: preset.id,
            lastView: "planner",
          },
        };
      }

      const nextPlannerPresets = Object.fromEntries(remainingEntries);
      const nextSelectedPresetId =
        state.uiState.selectedPlannerPresetId &&
        nextPlannerPresets[state.uiState.selectedPlannerPresetId]
          ? state.uiState.selectedPlannerPresetId
          : remainingEntries[0][0];

      return {
        ...state,
        plannerPresets: nextPlannerPresets,
        uiState: {
          ...state.uiState,
          selectedPlannerPresetId: nextSelectedPresetId,
          lastView: "planner",
        },
      };
    }
    case "rename-planner-preset": {
      const preset = state.plannerPresets[action.presetId];
      if (!preset) return state;
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [action.presetId]: {
            ...preset,
            name: action.name.trim() || "Untitled Week",
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }
    case "rename-planner-day": {
      const preset = state.plannerPresets[action.presetId];
      if (!preset) return state;
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [action.presetId]: {
            ...preset,
            updatedAt: new Date().toISOString(),
            days: {
              ...preset.days,
              [action.dayKey]: {
                ...preset.days[action.dayKey],
                title: action.title.trim() || preset.days[action.dayKey].title,
              },
            },
          },
        },
      };
    }
    case "create-planner-event": {
      const preset = state.plannerPresets[action.presetId];
      if (!preset) return state;
      const { startMinutes, endMinutes } = normalizePlannerRange(
        action.startMinutes,
        action.endMinutes,
      );
      const nextEvent = createPlannerEvent({
        dayKey: action.dayKey,
        title: action.title,
        startMinutes,
        endMinutes,
        color: action.color,
        notes: action.notes,
      });
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [action.presetId]: {
            ...preset,
            updatedAt: new Date().toISOString(),
            days: {
              ...preset.days,
              [action.dayKey]: {
                ...preset.days[action.dayKey],
                events: [...preset.days[action.dayKey].events, nextEvent].sort(
                  (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
                ),
              },
            },
          },
        },
      };
    }
    case "update-planner-event": {
      const preset = state.plannerPresets[action.presetId];
      if (!preset) return state;
      const day = preset.days[action.dayKey];
      const event = day.events.find((item) => item.id === action.eventId);
      if (!event) return state;
      const range = normalizePlannerRange(
        action.updates.startMinutes ?? event.startMinutes,
        action.updates.endMinutes ?? event.endMinutes,
      );
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [action.presetId]: {
            ...preset,
            updatedAt: new Date().toISOString(),
            days: {
              ...preset.days,
              [action.dayKey]: {
                ...day,
                events: day.events
                  .map((item) =>
                    item.id === action.eventId
                      ? {
                          ...item,
                          ...action.updates,
                          title: action.updates.title?.trim() || item.title,
                          notes: action.updates.notes ?? item.notes,
                          startMinutes: range.startMinutes,
                          endMinutes: range.endMinutes,
                        }
                      : item,
                  )
                  .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes),
              },
            },
          },
        },
      };
    }
    case "delete-planner-event": {
      const preset = state.plannerPresets[action.presetId];
      if (!preset) return state;
      return {
        ...state,
        plannerPresets: {
          ...state.plannerPresets,
          [action.presetId]: {
            ...preset,
            updatedAt: new Date().toISOString(),
            days: {
              ...preset.days,
              [action.dayKey]: {
                ...preset.days[action.dayKey],
                events: preset.days[action.dayKey].events.filter(
                  (item) => item.id !== action.eventId,
                ),
              },
            },
          },
        },
      };
    }
    case "select-note":
      if (!state.notesDocs[action.noteId]) return state;
      return {
        ...state,
        uiState: {
          ...state.uiState,
          selectedNoteId: action.noteId,
          selectedNoteFolderId: state.notesDocs[action.noteId].folderId,
          expandedNoteFolders: expandFolderPath(
            state.uiState.expandedNoteFolders,
            state.noteFolders,
            state.notesDocs[action.noteId].folderId,
          ),
          lastView: "notes",
        },
      };
    case "rename-note": {
      const note = state.notesDocs[action.noteId];
      if (!note) return state;
      return {
        ...state,
        notesDocs: {
          ...state.notesDocs,
          [action.noteId]: {
            ...note,
            title: action.title,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }
    case "delete-note": {
      const deletedNote = state.notesDocs[action.noteId];
      if (!deletedNote) return state;

      const entries = Object.entries(state.notesDocs).filter(([id]) => id !== action.noteId);
      const nextNotesDocs = Object.fromEntries(entries);
      const selectedNoteId =
        state.uiState.selectedNoteId === action.noteId
          ? null
          : nextNotesDocs[state.uiState.selectedNoteId ?? ""]
            ? state.uiState.selectedNoteId
            : null;
      const selectedNoteFolderId =
        state.uiState.selectedNoteFolderId && state.noteFolders[state.uiState.selectedNoteFolderId]
          ? state.uiState.selectedNoteFolderId
          : deletedNote.folderId;

      return {
        ...state,
        notesDocs: nextNotesDocs,
        uiState: {
          ...state.uiState,
          selectedNoteId,
          selectedNoteFolderId: selectedNoteFolderId ?? null,
        },
      };
    }
    case "update-note-markdown": {
      const note = state.notesDocs[action.noteId];
      if (!note) return state;
      return {
        ...state,
        notesDocs: {
          ...state.notesDocs,
          [action.noteId]: {
            ...note,
            markdown: action.markdown,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }
    default:
      return state;
  }
}

type AppContextValue = {
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

const AppContext = createContext<AppContextValue | null>(null);

type AppProviderProps = {
  children: ReactNode;
  repository: PersistenceRepository;
};

const WORKSPACE_REMOTE_SAVE_DEBOUNCE_MS = 3000;
const NOTE_BODY_REMOTE_SAVE_DEBOUNCE_MS = 5000;
const REMOTE_SAVE_THROTTLE_MS = 10000;

export function AppProvider({ children, repository }: AppProviderProps) {
  const { session, status: authStatus } = useAuth();
  const pathname = usePathname();
  const [state, setState] = useState<AppState | null>(null);
  const saveSnapshotRef = useRef<string | null>(null);
  const metadataRef = useRef<PersistenceMetadata>(createPersistenceMetadata());
  const dirtySnapshotRef = useRef<string | null>(null);
  const latestStateRef = useRef<AppState | null>(null);
  const lastAuthenticatedUserIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastRemoteSaveStartedAtRef = useRef<number | null>(null);
  const remoteSaveInFlightRef = useRef(false);
  const saveAfterCurrentRef = useRef(false);
  const themeMode = state?.uiState.themeMode;
  const [syncStatus, setSyncStatus] = useState<PersistenceStatus>("idle");
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [persistenceAvailable, setPersistenceAvailable] = useState(true);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSyncIssue, setHasSyncIssue] = useState(false);
  const noteBodySaveTimerRef = useRef<number | null>(null);
  const noteBodySnapshotRef = useRef<Record<string, string>>({});
  const [selectedBodyStatus, setSelectedBodyStatus] = useState<NoteBodyStatus>("idle");
  const [selectedBodyNotice, setSelectedBodyNotice] = useState<string | null>(null);
  const [selectedBodyError, setSelectedBodyError] = useState<string | null>(null);

  const isPublicAuthRoute = pathname.startsWith("/auth/reset");

  const dispatch = useMemo<Dispatch<AppAction>>(
    () => (action) => {
      setState((current) => (current ? appReducer(current, action) : current));
    },
    [],
  );

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const clearNoteBodySaveTimer = useCallback(() => {
    if (noteBodySaveTimerRef.current !== null) {
      window.clearTimeout(noteBodySaveTimerRef.current);
      noteBodySaveTimerRef.current = null;
    }
  }, []);

  const applySaveOutcome = useCallback(
    (
      result:
        | {
            status: PersistenceStatus;
            metadata: PersistenceMetadata;
            notice: string | null;
            errorMessage: string | null;
            resolvedState?: AppState;
          }
        | null,
      attemptedSnapshot: string,
    ) => {
      if (result) {
        metadataRef.current = result.metadata;
        setSyncStatus(result.status);
        setSyncNotice(result.notice);
        setSyncError(result.errorMessage);
        setPersistenceAvailable(true);

        if (result.status === "synced") {
          setHasSyncIssue(false);
          setLastSavedAt(result.metadata.lastRemoteUpdatedAt ?? result.metadata.lastLocalMutationAt);
          setLastSyncedAt(result.metadata.lastRemoteUpdatedAt);

          const successfulSnapshot = result.resolvedState
            ? serializeStateForSync(result.resolvedState)
            : attemptedSnapshot;
          saveSnapshotRef.current = successfulSnapshot;

          if (result.resolvedState && dirtySnapshotRef.current === attemptedSnapshot) {
            latestStateRef.current = result.resolvedState;
            setState(result.resolvedState);
          }

          if (dirtySnapshotRef.current === attemptedSnapshot) {
            dirtySnapshotRef.current = null;
            setHasPendingChanges(false);
            setHasUnsyncedChanges(false);
          } else {
            setHasPendingChanges(Boolean(dirtySnapshotRef.current));
            setHasUnsyncedChanges(Boolean(dirtySnapshotRef.current));
          }

          return;
        }

        setHasSyncIssue(result.status === "error");
        setLastSavedAt(result.metadata.lastRemoteUpdatedAt ?? result.metadata.lastLocalMutationAt);
        setHasPendingChanges(Boolean(dirtySnapshotRef.current));
        setHasUnsyncedChanges(
          Boolean(dirtySnapshotRef.current) || result.status === "offline",
        );
        return;
      }

      setSyncStatus("error");
      setSyncNotice("Your latest changes are still available on this device.");
      setSyncError("We couldn’t sync right now.");
      setHasSyncIssue(false);
      setHasPendingChanges(Boolean(dirtySnapshotRef.current));
      setHasUnsyncedChanges(Boolean(dirtySnapshotRef.current));
    },
    [],
  );

  const flushLatestState = useCallback(
    async ({
      forceCurrentState = false,
      bypassThrottle = false,
    }: { forceCurrentState?: boolean; bypassThrottle?: boolean } = {}) => {
      if (!session || authStatus !== "authenticated") {
        return;
      }

      const currentState = latestStateRef.current;
      if (!currentState) {
        return;
      }

      const currentSnapshot = serializeStateForSync(currentState);
      const attemptedSnapshot = dirtySnapshotRef.current ?? (forceCurrentState ? currentSnapshot : null);

      if (!attemptedSnapshot) {
        setIsSaving(false);
        return;
      }

      if (isDevelopmentWorkspaceSession(session)) {
        saveDevelopmentWorkspaceState(currentState);
        saveSnapshotRef.current = attemptedSnapshot;
        dirtySnapshotRef.current = null;
        metadataRef.current = createPersistenceMetadata({
          ...metadataRef.current,
          lastLocalMutationAt: new Date().toISOString(),
        });
        setHasPendingChanges(false);
        setHasUnsyncedChanges(false);
        setHasSyncIssue(false);
        setIsSaving(false);
        setSyncStatus("synced");
        setSyncNotice("Development workspace is active. Changes stay on this device.");
        setSyncError(null);
        setLastSavedAt(metadataRef.current.lastLocalMutationAt);
        setLastSyncedAt(null);
        return;
      }

      if (remoteSaveInFlightRef.current) {
        saveAfterCurrentRef.current = true;
        return;
      }

      if (!bypassThrottle) {
        const lastRemoteSaveStartedAt = lastRemoteSaveStartedAtRef.current;
        if (lastRemoteSaveStartedAt !== null) {
          const remainingThrottleMs =
            REMOTE_SAVE_THROTTLE_MS - (Date.now() - lastRemoteSaveStartedAt);

          if (remainingThrottleMs > 0) {
            clearSaveTimer();
            setIsSaving(true);
            saveTimerRef.current = window.setTimeout(() => {
              saveTimerRef.current = null;
              void flushLatestState();
            }, remainingThrottleMs);
            return;
          }
        }
      }

      remoteSaveInFlightRef.current = true;
      lastRemoteSaveStartedAtRef.current = Date.now();
      setIsSaving(true);
      setSyncStatus("syncing");
      setSyncNotice("Saving your latest changes to PocketBase.");
      setSyncError(null);

      try {
        const result = await repository.save({
          userId: session.userId,
          state: currentState,
          baseMetadata: metadataRef.current,
          now: new Date(),
        });

        applySaveOutcome(result, attemptedSnapshot);
      } catch {
        applySaveOutcome(null, attemptedSnapshot);
      } finally {
        remoteSaveInFlightRef.current = false;

        if (saveAfterCurrentRef.current) {
          saveAfterCurrentRef.current = false;
          void flushLatestState();
          return;
        }

        setIsSaving(false);
      }
    },
    [applySaveOutcome, authStatus, clearSaveTimer, repository, session],
  );

  const queueSave = useCallback(
    (delayMs: number) => {
      clearSaveTimer();
      setIsSaving(true);
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void flushLatestState();
      }, delayMs);
    },
    [clearSaveTimer, flushLatestState],
  );

  useEffect(() => {
    if (session?.userId) {
      lastAuthenticatedUserIdRef.current = session.userId;
    }
  }, [session?.userId]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !session) {
      if (authStatus === "anonymous" && lastAuthenticatedUserIdRef.current) {
        void repository.clearUserData({ userId: lastAuthenticatedUserIdRef.current });
        lastAuthenticatedUserIdRef.current = null;
      }

      saveSnapshotRef.current = null;
      dirtySnapshotRef.current = null;
      latestStateRef.current = null;
      clearSaveTimer();
      clearNoteBodySaveTimer();
      lastRemoteSaveStartedAtRef.current = null;
      remoteSaveInFlightRef.current = false;
      saveAfterCurrentRef.current = false;
      noteBodySnapshotRef.current = {};
      metadataRef.current = createPersistenceMetadata();
      startTransition(() => {
        setState(null);
        setSyncStatus("idle");
        setSyncNotice(null);
        setSyncError(null);
        setLastSavedAt(null);
        setLastSyncedAt(null);
        setPersistenceAvailable(true);
        setHasPendingChanges(false);
        setHasUnsyncedChanges(false);
        setIsSaving(false);
        setHasSyncIssue(false);
        setSelectedBodyStatus("idle");
        setSelectedBodyNotice(null);
        setSelectedBodyError(null);
      });
      return;
    }

    if (isDevelopmentWorkspaceSession(session)) {
      const devState = loadDevelopmentWorkspaceState();
      const snapshot = serializeStateForSync(devState);
      saveSnapshotRef.current = snapshot;
      dirtySnapshotRef.current = null;
      metadataRef.current = createPersistenceMetadata({
        lastLocalMutationAt: new Date().toISOString(),
      });
      startTransition(() => {
        setHasPendingChanges(false);
        setHasUnsyncedChanges(false);
        setIsSaving(false);
        setHasSyncIssue(false);
        setState(devState);
        setSyncStatus("synced");
        setSyncNotice("Development workspace is active. Changes stay on this device.");
        setSyncError(null);
        setLastSavedAt(metadataRef.current.lastLocalMutationAt);
        setLastSyncedAt(null);
        setPersistenceAvailable(true);
        setSelectedBodyStatus("idle");
        setSelectedBodyNotice(null);
        setSelectedBodyError(null);
      });
      return;
    }

    let mounted = true;

    const hydrate = async () => {
      try {
        setSyncStatus("loading");
        await repository.evictExpiredCachedBodies({ userId: session.userId, now: new Date() });
        const result = await repository.load({
          userId: session.userId,
          now: new Date(),
          onRemoteSync: (remoteResult) => {
            if (!mounted) {
              return;
            }

            const snapshot = serializeStateForSync(remoteResult.state);
            saveSnapshotRef.current = snapshot;
            dirtySnapshotRef.current = null;
            setHasPendingChanges(false);
            setHasUnsyncedChanges(remoteResult.status !== "synced");
            setIsSaving(false);
            setHasSyncIssue(remoteResult.status === "error");
            metadataRef.current = remoteResult.metadata;
            setState(remoteResult.state);
            setSyncStatus(remoteResult.status);
            setSyncNotice(remoteResult.notice);
            setSyncError(remoteResult.errorMessage);
            setLastSavedAt(
              remoteResult.metadata.lastRemoteUpdatedAt ?? remoteResult.metadata.lastLocalMutationAt,
            );
            setLastSyncedAt(remoteResult.metadata.lastRemoteUpdatedAt);
            setPersistenceAvailable(remoteResult.persistenceAvailable);
          },
        });
        if (!mounted) {
          return;
        }

        const snapshot = serializeStateForSync(result.state);
        saveSnapshotRef.current = snapshot;
        dirtySnapshotRef.current = null;
        setHasPendingChanges(false);
        setHasUnsyncedChanges(result.status !== "synced");
        setIsSaving(false);
        setHasSyncIssue(result.status === "error");
        metadataRef.current = result.metadata;
        setState(result.state);
        setSyncStatus(result.status);
        setSyncNotice(result.notice);
        setSyncError(result.errorMessage);
        setLastSavedAt(result.metadata.lastRemoteUpdatedAt ?? result.metadata.lastLocalMutationAt);
        setLastSyncedAt(result.metadata.lastRemoteUpdatedAt);
        setPersistenceAvailable(result.persistenceAvailable);
      } catch {
        if (!mounted) {
          return;
        }

        setState(seedAppState(new Date()));
        setSyncStatus("error");
        setSyncNotice("We couldn’t restore your last synced workspace.");
        setSyncError("We couldn’t restore your workspace.");
        setLastSavedAt(null);
        setHasSyncIssue(true);
        setHasUnsyncedChanges(false);
        setIsSaving(false);
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, [authStatus, clearNoteBodySaveTimer, clearSaveTimer, repository, session]);

  const selectedNoteId = state?.uiState.selectedNoteId ?? null;
  const selectedNote = selectedNoteId ? state?.notesDocs[selectedNoteId] ?? null : null;

  useEffect(() => {
    if (!session || authStatus !== "authenticated" || !selectedNoteId || !selectedNote) {
      setSelectedBodyStatus("idle");
      setSelectedBodyNotice(null);
      setSelectedBodyError(null);
      return;
    }

    if (typeof selectedNote.markdown === "string") {
      noteBodySnapshotRef.current[selectedNoteId] ??= selectedNote.markdown;
      setSelectedBodyStatus("ready");
      setSelectedBodyNotice(null);
      setSelectedBodyError(null);
      return;
    }

    let cancelled = false;
    setSelectedBodyStatus("loading");
    setSelectedBodyNotice(null);
    setSelectedBodyError(null);

    void repository
      .loadNoteBody({
        userId: session.userId,
        noteId: selectedNoteId,
        now: new Date(),
      })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.markdown !== null) {
          const loadedMarkdown = result.markdown;
          noteBodySnapshotRef.current[selectedNoteId] = loadedMarkdown;
          setState((current) => {
            if (!current?.notesDocs[selectedNoteId]) {
              return current;
            }

            return {
              ...current,
              notesDocs: {
                ...current.notesDocs,
                [selectedNoteId]: {
                  ...current.notesDocs[selectedNoteId],
                  markdown: loadedMarkdown,
                  updatedAt: result.updatedAtClient ?? current.notesDocs[selectedNoteId].updatedAt,
                },
              },
            };
          });
        }

        setSelectedBodyStatus(result.status === "error" ? "error" : result.status);
        setSelectedBodyNotice(result.notice);
        setSelectedBodyError(result.errorMessage);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setSelectedBodyStatus("error");
        setSelectedBodyNotice(null);
        setSelectedBodyError("We couldn’t load this note right now.");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, repository, selectedNote, selectedNoteId, session]);

  useEffect(() => {
    if (
      !session ||
      authStatus !== "authenticated" ||
      !selectedNoteId ||
      !selectedNote ||
      typeof selectedNote.markdown !== "string"
    ) {
      clearNoteBodySaveTimer();
      return;
    }

    const previousMarkdown = noteBodySnapshotRef.current[selectedNoteId];
    if (previousMarkdown === selectedNote.markdown) {
      return;
    }

    void repository.primeRecentNoteCache({
      userId: session.userId,
      noteBodies: [
        {
          noteId: selectedNoteId,
          markdown: selectedNote.markdown,
          updatedAtClient: selectedNote.updatedAt,
        },
      ],
      now: new Date(),
    });

    clearNoteBodySaveTimer();
    noteBodySaveTimerRef.current = window.setTimeout(() => {
      noteBodySaveTimerRef.current = null;
      void repository
        .saveNoteBody({
          userId: session.userId,
          noteId: selectedNoteId,
          markdown: selectedNote.markdown ?? "",
          updatedAtClient: selectedNote.updatedAt,
          now: new Date(),
        })
        .then((result) => {
          noteBodySnapshotRef.current[selectedNoteId] = result.markdown;
          setSelectedBodyStatus(result.status === "offline" ? "stale-offline" : "ready");
          setSelectedBodyNotice(result.notice);
          setSelectedBodyError(result.errorMessage);
        })
        .catch(() => {
          setSelectedBodyStatus("error");
          setSelectedBodyNotice(null);
          setSelectedBodyError("We couldn’t save this note right now.");
        });
    }, NOTE_BODY_REMOTE_SAVE_DEBOUNCE_MS);

    return clearNoteBodySaveTimer;
  }, [authStatus, clearNoteBodySaveTimer, repository, selectedNote, selectedNoteId, session]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || !state) return;

    const root = document.documentElement;
    const query = window.matchMedia("(prefers-color-scheme: dark)");

    const applyDarkState = (isDark: boolean) => {
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
    };

    if (state.uiState.themeMode === "dark") {
      applyDarkState(true);
      return;
    }

    if (state.uiState.themeMode === "light") {
      applyDarkState(false);
      return;
    }

    applyDarkState(query.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      applyDarkState(event.matches);
    };

    query.addEventListener("change", handleChange);
    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, [state, themeMode]);

  useEffect(() => {
    if (!session || !state || authStatus !== "authenticated") {
      return;
    }

    const nextSnapshot = serializeStateForSync(state);
    if (nextSnapshot === saveSnapshotRef.current) {
      dirtySnapshotRef.current = null;
      return;
    }

    if (isDevelopmentWorkspaceSession(session)) {
      dirtySnapshotRef.current = nextSnapshot;
      startTransition(() => {
        setHasPendingChanges(true);
        setHasUnsyncedChanges(true);
        setIsSaving(true);
        setHasSyncIssue(false);
      });
      queueSave(150);
      return clearSaveTimer;
    }

    dirtySnapshotRef.current = nextSnapshot;
    startTransition(() => {
      setHasPendingChanges(true);
      setHasUnsyncedChanges(true);
      setIsSaving(true);
      setHasSyncIssue(false);
      setSyncStatus("syncing");
      setSyncNotice("Saving your latest changes to PocketBase.");
      setSyncError(null);
    });

    queueSave(WORKSPACE_REMOTE_SAVE_DEBOUNCE_MS);
    return clearSaveTimer;
  }, [authStatus, clearSaveTimer, queueSave, session, state]);

  const retrySync = useCallback(async () => {
    if (!session || !state || authStatus !== "authenticated") {
      return;
    }

    dirtySnapshotRef.current ??= serializeStateForSync(state);
    setHasPendingChanges(true);
    setHasUnsyncedChanges(true);
    setHasSyncIssue(false);
    clearSaveTimer();
    await flushLatestState({ forceCurrentState: true, bypassThrottle: true });
  }, [authStatus, clearSaveTimer, flushLatestState, session, state]);

  useEffect(() => {
    if (!session || authStatus !== "authenticated") {
      return;
    }

    const flushIfNeeded = () => {
      if (!state || !dirtySnapshotRef.current) {
        return;
      }

      if (isDevelopmentWorkspaceSession(session)) {
        clearSaveTimer();
        void flushLatestState({ forceCurrentState: true });
        return;
      }

      clearSaveTimer();
      void flushLatestState({ forceCurrentState: true, bypassThrottle: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushIfNeeded();
      }
    };

    window.addEventListener("pagehide", flushIfNeeded);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushIfNeeded);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [authStatus, clearSaveTimer, flushLatestState, session, state]);

  const syncIndicator: AppContextValue["sync"]["indicator"] = hasSyncIssue
    ? "issue"
    : isSaving
      ? "saving"
      : hasUnsyncedChanges
        ? "unsynced"
        : "saved";

  const value = useMemo(
    () =>
      state
        ? {
            state,
            dispatch,
            notes: {
              selectedBodyStatus,
              selectedBodyNotice,
              selectedBodyError,
            },
            sync: {
              status: syncStatus,
              indicator: syncIndicator,
              lastSavedAt,
              lastSyncedAt,
              notice: syncNotice,
              errorMessage: syncError,
              hasPendingChanges,
              hasUnsyncedChanges,
              isSaving,
              persistenceAvailable,
            },
            retrySync,
          }
        : null,
    [
      dispatch,
      hasPendingChanges,
      hasUnsyncedChanges,
      isSaving,
      lastSavedAt,
      lastSyncedAt,
      selectedBodyError,
      selectedBodyNotice,
      selectedBodyStatus,
      persistenceAvailable,
      retrySync,
      state,
      syncIndicator,
      syncError,
      syncNotice,
      syncStatus,
    ],
  );

  if (isPublicAuthRoute) {
    return children;
  }

  if (authStatus === "loading") {
    return <AppLoadingScreen label="Restoring your workspace" />;
  }

  if (authStatus === "verification-pending") {
    return <VerificationPendingScreen />;
  }

  if (authStatus === "anonymous") {
    return <AuthGate />;
  }

  if (!state) {
    return <AppLoadingScreen label="Loading your notes and todos" />;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppState must be used within AppProvider");
  }

  const selectedDailyDate = ensureSelectedDailyDate(context.state);
  const selectedNoteId = ensureSelectedNoteId(context.state);
  const selectedNoteFolderId = ensureSelectedNoteFolderId(context.state);
  const selectedPlannerPresetId = ensureSelectedPlannerPresetId(context.state);

  if (
    context.state.uiState.selectedDailyDate !== selectedDailyDate ||
    context.state.uiState.selectedNoteId !== selectedNoteId ||
    context.state.uiState.selectedNoteFolderId !== selectedNoteFolderId ||
    context.state.uiState.selectedPlannerPresetId !== selectedPlannerPresetId
  ) {
    return {
      ...context,
      state: {
        ...context.state,
        uiState: {
          ...context.state.uiState,
          selectedDailyDate,
          selectedNoteId,
          selectedNoteFolderId,
          selectedPlannerPresetId,
        },
      },
    };
  }

  return context;
}

function AppLoadingScreen({ label }: { label: string }) {
  return (
    <main className="auth-screen">
      <section className="auth-card auth-card--loading">
        <div className="app-logo auth-card__logo" aria-hidden="true" />
        <p className="auth-card__eyebrow">DailyTodo</p>
        <h1 className="auth-card__title">{label}</h1>
      </section>
    </main>
  );
}
