"use client";

import {
  CONTENT_FONT_SCALE_DEFAULT,
  decreaseContentFontScale,
  increaseContentFontScale,
} from "@/lib/content-font-scale";
import {
  DEV_WORKSPACE_STATE_KEY,
} from "@/lib/dev-mode";
import {
  normalizeAppState,
  seedAppState,
  stripNoteBodies,
} from "@/lib/persistence";
import {
  addContentColumn,
  createContentCard,
  createPlannerEvent,
  createPlannerPreset,
  createNoteDoc,
  createNoteFolder,
  createTodo,
  deleteContentCard,
  deleteContentColumn,
  DEFAULT_NOTES_FOLDER_ID,
  duplicatePlannerPreset,
  getContentCardsForColumn,
  getSortedDailyDates,
  moveContentCard,
  renameContentColumn,
  reorderContentColumns,
  updateContentColumnSubtitle,
  updateContentCard,
} from "@/lib/store";
import type {
  AppState,
  FocusTimerStatus,
} from "@/lib/types";
import type { AppAction } from "./app-context.types";

function toggleString(list: string[], value: string): string[] {
  if (list.includes(value)) {
    return list.filter((item) => item !== value);
  }
  return [...list, value];
}

function clearFocusTimerState(
  state: AppState["uiState"],
  overrides: Partial<AppState["uiState"]> = {},
) {
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

export function ensureSelectedDailyDate(state: AppState): string {
  const existing = state.uiState.selectedDailyDate;
  if (existing && state.dailyPages[existing]) {
    return existing;
  }
  const sorted = getSortedDailyDates(state);
  return sorted[0];
}

export function ensureSelectedNoteId(state: AppState): string | null {
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

export function ensureSelectedNoteFolderId(state: AppState): string | null {
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

export function ensureSelectedPlannerPresetId(state: AppState): string {
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

export function saveDevelopmentWorkspaceState(nextState: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEV_WORKSPACE_STATE_KEY, JSON.stringify(nextState));
}

export function loadDevelopmentWorkspaceState() {
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

export function serializeStateForSync(state: AppState) {
  return JSON.stringify(stripNoteBodies(state));
}

function handleUiActions(state: AppState, action: AppAction): AppState | null {
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
    case "increase-content-font-scale":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          contentFontScale: increaseContentFontScale(state.uiState.contentFontScale),
        },
      };
    case "decrease-content-font-scale":
      return {
        ...state,
        uiState: {
          ...state.uiState,
          contentFontScale: decreaseContentFontScale(state.uiState.contentFontScale),
        },
      };
    case "reset-content-font-scale":
      if (state.uiState.contentFontScale === CONTENT_FONT_SCALE_DEFAULT) {
        return state;
      }
      return {
        ...state,
        uiState: {
          ...state.uiState,
          contentFontScale: CONTENT_FONT_SCALE_DEFAULT,
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
    default:
      return null;
  }
}

function handleContentPlannerActions(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case "add-content-column": {
      const contentBoard = addContentColumn(
        state.contentBoard,
        action.title,
        action.subtitle,
      );
      return contentBoard === state.contentBoard ? state : { ...state, contentBoard };
    }
    case "rename-content-column": {
      const contentBoard = renameContentColumn(
        state.contentBoard,
        action.columnId,
        action.title,
      );
      return contentBoard === state.contentBoard ? state : { ...state, contentBoard };
    }
    case "update-content-column-subtitle": {
      const contentBoard = updateContentColumnSubtitle(
        state.contentBoard,
        action.columnId,
        action.subtitle,
      );
      return contentBoard === state.contentBoard ? state : { ...state, contentBoard };
    }
    case "reorder-content-columns": {
      const contentBoard = reorderContentColumns(
        state.contentBoard,
        action.activeColumnId,
        action.overColumnId,
      );
      return contentBoard === state.contentBoard ? state : { ...state, contentBoard };
    }
    case "delete-content-column": {
      const contentBoard = deleteContentColumn(
        state.contentBoard,
        state.contentCards,
        action.columnId,
      );
      return contentBoard === state.contentBoard ? state : { ...state, contentBoard };
    }
    case "create-content-card": {
      if (!state.contentBoard.columns.some((column) => column.id === action.columnId)) {
        return state;
      }
      const card = createContentCard({
        columnId: action.columnId,
        title: action.title,
        notes: action.notes,
        order: getContentCardsForColumn(state.contentCards, action.columnId).length,
      });
      if (!card) {
        return state;
      }
      return {
        ...state,
        contentCards: {
          ...state.contentCards,
          [card.id]: card,
        },
      };
    }
    case "update-content-card": {
      const contentCards = updateContentCard(state.contentCards, action.cardId, {
        title: action.title,
        notes: action.notes,
      });
      return contentCards === state.contentCards ? state : { ...state, contentCards };
    }
    case "move-content-card": {
      if (!state.contentBoard.columns.some((column) => column.id === action.targetColumnId)) {
        return state;
      }
      const contentCards = moveContentCard(
        state.contentCards,
        action.cardId,
        action.targetColumnId,
        action.targetIndex,
      );
      return contentCards === state.contentCards ? state : { ...state, contentCards };
    }
    case "delete-content-card": {
      const contentCards = deleteContentCard(state.contentCards, action.cardId);
      return contentCards === state.contentCards ? state : { ...state, contentCards };
    }
    default:
      return null;
  }
}

function handleTodoActions(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case "update-daily-markdown": {
      const page = state.dailyPages[action.date];
      if (!page) {
        return state;
      }
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
      if (!page || !action.text.trim()) {
        return state;
      }
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
      if (!page) {
        return state;
      }
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
      if (!page) {
        return state;
      }

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
      if (!page || !action.text.trim()) {
        return state;
      }
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
      if (!page) {
        return state;
      }

      const todoIndex = page.todos.findIndex((todo) => todo.id === action.todoId);
      if (todoIndex === -1) {
        return state;
      }

      const todo = page.todos[todoIndex];
      const newTodos = [...page.todos];

      newTodos.splice(todoIndex, 1);

      const todosInNewPriority = newTodos.filter((item) => item.priority === action.newPriority);
      const insertAtRelative = Math.min(Math.max(0, action.newIndex), todosInNewPriority.length);

      let absoluteInsertIndex = newTodos.length;
      if (insertAtRelative < todosInNewPriority.length) {
        const targetTodoId = todosInNewPriority[insertAtRelative].id;
        absoluteInsertIndex = newTodos.findIndex((item) => item.id === targetTodoId);
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
      if (!page) {
        return state;
      }

      const todo = page.todos.find((item) => item.id === action.todoId);
      if (!todo) {
        return state;
      }

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
      if (!page) {
        return state;
      }
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
    default:
      return null;
  }
}

function handleNotesAndPlannerActions(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case "create-note": {
      const selectedNote = state.uiState.selectedNoteId
        ? state.notesDocs[state.uiState.selectedNoteId]
        : null;
      const folderId =
        state.uiState.selectedNoteFolderId ?? selectedNote?.folderId ?? DEFAULT_NOTES_FOLDER_ID;
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
      if (!folder || action.folderId === DEFAULT_NOTES_FOLDER_ID) {
        return state;
      }

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
      if (!note) {
        return state;
      }
      const nextFolderId = action.folderId ?? DEFAULT_NOTES_FOLDER_ID;
      if (!state.noteFolders[nextFolderId]) {
        return state;
      }

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
      if (!state.noteFolders[action.folderId] || action.folderId === DEFAULT_NOTES_FOLDER_ID) {
        return state;
      }

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
      if (!source) {
        return state;
      }
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
      if (!state.plannerPresets[action.presetId]) {
        return state;
      }

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
      if (!preset) {
        return state;
      }
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
      if (!preset) {
        return state;
      }
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
      if (!preset) {
        return state;
      }
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
      if (!preset) {
        return state;
      }
      const day = preset.days[action.dayKey];
      const event = day.events.find((item) => item.id === action.eventId);
      if (!event) {
        return state;
      }
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
      if (!preset) {
        return state;
      }
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
      if (!state.notesDocs[action.noteId]) {
        return state;
      }
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
      if (!note) {
        return state;
      }
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
      if (!deletedNote) {
        return state;
      }

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
      if (!note) {
        return state;
      }
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
      return null;
  }
}

export function appReducer(state: AppState, action: AppAction): AppState {
  return (
    handleUiActions(state, action) ??
    handleContentPlannerActions(state, action) ??
    handleTodoActions(state, action) ??
    handleNotesAndPlannerActions(state, action) ??
    state
  );
}
