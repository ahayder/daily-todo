import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "@/components/auth/auth-context";
import { AppProvider, appReducer, useAppState } from "@/components/app/app-context";
import {
  CONTENT_FONT_SCALE_DEFAULT,
  CONTENT_FONT_SCALE_MAX,
  CONTENT_FONT_SCALE_MIN,
} from "@/lib/content-font-scale";
import { createPersistenceMetadata } from "@/lib/persistence";
import { createInitialState, renameContentColumn } from "@/lib/store";
import { createMockAuthRepository, createMockPersistenceRepository } from "@/test/repositories";

vi.mock("next/navigation", () => ({
  usePathname: () => "/todos",
}));

type MatchMediaController = {
  setMatches: (value: boolean) => void;
};

function installMatchMedia(initialMatches: boolean): MatchMediaController {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      get matches() {
        return matches;
      },
      media: "(prefers-color-scheme: dark)",
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      },
    })),
  });

  return {
    setMatches(value: boolean) {
      matches = value;
      const event = { matches } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function Harness() {
  const { state, dispatch, sync, retrySync } = useAppState();
  const noteId = state.uiState.selectedNoteId!;
  return (
    <div>
      <p data-testid="theme-mode">{state.uiState.themeMode}</p>
      <p data-testid="sync-indicator">{sync.indicator}</p>
      <button type="button" onClick={() => dispatch({ type: "set-theme-mode", themeMode: "light" })}>
        light
      </button>
      <button type="button" onClick={() => dispatch({ type: "set-theme-mode", themeMode: "dark" })}>
        dark
      </button>
      <button type="button" onClick={() => dispatch({ type: "set-theme-mode", themeMode: "system" })}>
        system
      </button>
      <button type="button" onClick={() => void retrySync()}>
        retry sync
      </button>
      <input
        aria-label="Note title"
        value={state.notesDocs[noteId]?.title ?? ""}
        onChange={(event) =>
          dispatch({
            type: "rename-note",
            noteId,
            title: event.target.value,
          })
        }
      />
      <textarea
        aria-label="Note markdown"
        value={state.notesDocs[noteId]?.markdown ?? ""}
        onChange={(event) =>
          dispatch({
            type: "update-note-markdown",
            noteId,
            markdown: event.target.value,
          })
        }
      />
    </div>
  );
}

function ContentPlannerSyncHarness() {
  const { state, dispatch } = useAppState();
  const card = Object.values(state.contentCards)[0];
  const targetColumn = state.contentBoard.columns[1];

  return (
    <div>
      <p data-testid="hydrated-column-title">{state.contentBoard.columns[0].title}</p>
      <p data-testid="dragged-card-column">{card?.columnId ?? "missing"}</p>
      <button
        type="button"
        disabled={!card || !targetColumn}
        onClick={() => {
          if (!card || !targetColumn) return;
          dispatch({
            type: "move-content-card",
            cardId: card.id,
            targetColumnId: targetColumn.id,
            targetIndex: 0,
          });
        }}
      >
        move planner card
      </button>
    </div>
  );
}

function renderWithProviders() {
  const auth = createMockAuthRepository({
    userId: "user_1",
    email: "test@example.com",
    isVerified: true,
    accessToken: "token_1",
  });
  const persistence = createMockPersistenceRepository(createInitialState("2026-03-11"));

  return {
    auth,
    persistence,
    ...render(
      <AuthProvider repository={auth.repository}>
        <AppProvider repository={persistence.repository}>
          <Harness />
        </AppProvider>
      </AuthProvider>,
    ),
  };
}

describe("appReducer theme mode", () => {
  test("updates themeMode with set-theme-mode action", () => {
    const initial = createInitialState("2026-03-11");
    const next = appReducer(initial, { type: "set-theme-mode", themeMode: "dark" });
    expect(next.uiState.themeMode).toBe("dark");
  });

  test("toggles shared sidebar collapsed state", () => {
    const initial = createInitialState("2026-03-11");

    const collapsed = appReducer(initial, { type: "toggle-sidebar-collapsed" });
    expect(collapsed.uiState.isSidebarCollapsed).toBe(true);

    const reopened = appReducer(collapsed, { type: "set-sidebar-collapsed", isCollapsed: false });
    expect(reopened.uiState.isSidebarCollapsed).toBe(false);
  });

  test("increases, decreases, resets, and clamps the shared content font scale", () => {
    const initial = createInitialState("2026-03-11");

    const increased = appReducer(initial, { type: "increase-content-font-scale" });
    expect(increased.uiState.contentFontScale).toBe(1.05);

    const decreased = appReducer(increased, { type: "decrease-content-font-scale" });
    expect(decreased.uiState.contentFontScale).toBe(CONTENT_FONT_SCALE_DEFAULT);

    const reset = appReducer(
      {
        ...initial,
        uiState: { ...initial.uiState, contentFontScale: 1.15 },
      },
      { type: "reset-content-font-scale" },
    );
    expect(reset.uiState.contentFontScale).toBe(CONTENT_FONT_SCALE_DEFAULT);

    const maxed = appReducer(
      {
        ...initial,
        uiState: { ...initial.uiState, contentFontScale: CONTENT_FONT_SCALE_MAX },
      },
      { type: "increase-content-font-scale" },
    );
    expect(maxed.uiState.contentFontScale).toBe(CONTENT_FONT_SCALE_MAX);

    const mined = appReducer(
      {
        ...initial,
        uiState: { ...initial.uiState, contentFontScale: CONTENT_FONT_SCALE_MIN },
      },
      { type: "decrease-content-font-scale" },
    );
    expect(mined.uiState.contentFontScale).toBe(CONTENT_FONT_SCALE_MIN);
  });

  test("toggles note folder expansion state", () => {
    const initial = createInitialState("2026-03-11");
    initial.noteFolders = {
      folder_1: {
        id: "folder_1",
        name: "Projects",
        parentId: null,
        updatedAt: "2026-03-11T08:00:00.000Z",
      },
    };
    initial.uiState.expandedNoteFolders = ["folder_1"];

    const collapsed = appReducer(initial, { type: "toggle-note-folder", folderId: "folder_1" });
    expect(collapsed.uiState.expandedNoteFolders).toEqual([]);

    const reopened = appReducer(collapsed, { type: "toggle-note-folder", folderId: "folder_1" });
    expect(reopened.uiState.expandedNoteFolders).toEqual(["folder_1"]);
  });

  test("creates and updates planner events", () => {
    const initial = createInitialState("2026-03-11");
    const presetId = initial.uiState.selectedPlannerPresetId!;

    const created = appReducer(initial, {
      type: "create-planner-event",
      presetId,
      eventId: "event-new-deep-work",
      dayKey: "monday",
      title: "Deep Work",
      startMinutes: 480,
      endMinutes: 600,
      color: "teal",
      notes: "Phone off",
    });

    const event = created.plannerPresets[presetId].days.monday.events.find(
      (candidate) => candidate.id === "event-new-deep-work",
    )!;
    expect(event.title).toBe("Deep Work");

    const updated = appReducer(created, {
      type: "update-planner-event",
      presetId,
      dayKey: "monday",
      eventId: event.id,
      updates: {
        title: "Deep Work Sprint",
        color: "gold",
      },
    });

    const updatedEvent = updated.plannerPresets[presetId].days.monday.events.find(
      (candidate) => candidate.id === event.id,
    )!;
    expect(updatedEvent.title).toBe("Deep Work Sprint");
    expect(updatedEvent.color).toBe("gold");
  });

  test("manages content board columns", () => {
    const initial = createInitialState("2026-03-11");
    const added = appReducer(initial, {
      type: "add-content-column",
      title: "Review",
      subtitle: "Waiting for approval",
    });
    const column = added.contentBoard.columns.at(-1)!;

    expect(column.title).toBe("Review");
    expect(column.subtitle).toBe("Waiting for approval");

    const renamed = appReducer(added, {
      type: "rename-content-column",
      columnId: column.id,
      title: "Final Review",
    });
    expect(renamed.contentBoard.columns.at(-1)?.title).toBe("Final Review");

    const withUpdatedSubtitle = appReducer(renamed, {
      type: "update-content-column-subtitle",
      columnId: column.id,
      subtitle: "Approved and ready",
    });
    expect(withUpdatedSubtitle.contentBoard.columns.at(-1)?.subtitle).toBe(
      "Approved and ready",
    );

    const reordered = appReducer(withUpdatedSubtitle, {
      type: "reorder-content-columns",
      activeColumnId: column.id,
      overColumnId: withUpdatedSubtitle.contentBoard.columns[0].id,
    });
    expect(reordered.contentBoard.columns[0].id).toBe(column.id);

    const deleted = appReducer(reordered, {
      type: "delete-content-column",
      columnId: column.id,
    });
    expect(deleted.contentBoard.columns.some((item) => item.id === column.id)).toBe(false);
  });

  test("creates, edits, moves, and deletes content cards", () => {
    const initial = createInitialState("2026-03-11");
    const [ideas, planned] = initial.contentBoard.columns;
    const created = appReducer(initial, {
      type: "create-content-card",
      columnId: ideas.id,
      title: "  Launch note  ",
      notes: "  Supporting detail  ",
    });
    const card = Object.values(created.contentCards)[0];

    expect(card).toMatchObject({
      columnId: ideas.id,
      title: "Launch note",
      notes: "Supporting detail",
      order: 0,
    });

    const updated = appReducer(created, {
      type: "update-content-card",
      cardId: card.id,
      title: "Launch story",
      notes: "Updated notes.",
    });
    expect(updated.contentCards[card.id].title).toBe("Launch story");

    const moved = appReducer(updated, {
      type: "move-content-card",
      cardId: card.id,
      targetColumnId: planned.id,
      targetIndex: 0,
    });
    expect(moved.contentCards[card.id]).toMatchObject({ columnId: planned.id, order: 0 });

    const deleted = appReducer(moved, { type: "delete-content-card", cardId: card.id });
    expect(deleted.contentCards[card.id]).toBeUndefined();
  });

  test("keeps non-empty and final columns when deletion is requested", () => {
    const initial = createInitialState("2026-03-11");
    const column = initial.contentBoard.columns[0];
    const withCard = appReducer(initial, {
      type: "create-content-card",
      columnId: column.id,
      title: "Keep me",
    });

    expect(
      appReducer(withCard, {
        type: "delete-content-column",
        columnId: column.id,
      }).contentBoard.columns,
    ).toHaveLength(5);

    const singleColumn = {
      ...initial,
      contentBoard: { ...initial.contentBoard, columns: [column] },
    };
    expect(
      appReducer(singleColumn, {
        type: "delete-content-column",
        columnId: column.id,
      }).contentBoard.columns,
    ).toHaveLength(1);
  });

  test("deletes planner presets and keeps planner selectable", () => {
    const initial = createInitialState("2026-03-11");
    const firstPresetId = initial.uiState.selectedPlannerPresetId!;
    const withSecondPreset = appReducer(initial, { type: "create-planner-preset", name: "Alt Week" });
    const secondPresetId = withSecondPreset.uiState.selectedPlannerPresetId!;

    const deletedSelected = appReducer(withSecondPreset, {
      type: "delete-planner-preset",
      presetId: secondPresetId,
    });

    expect(deletedSelected.plannerPresets[firstPresetId]).toBeDefined();
    expect(deletedSelected.uiState.selectedPlannerPresetId).toBe(firstPresetId);

    const recreated = appReducer(
      {
        ...initial,
        uiState: { ...initial.uiState, lastView: "planner" },
      },
      {
        type: "delete-planner-preset",
        presetId: firstPresetId,
      },
    );

    expect(Object.keys(recreated.plannerPresets)).toHaveLength(1);
    expect(recreated.uiState.selectedPlannerPresetId).toBeTruthy();
    expect(recreated.uiState.lastView).toBe("planner");
  });

  test("allows clearing a note title while editing", () => {
    const initial = createInitialState("2026-03-11");
    const noteId = initial.uiState.selectedNoteId!;

    const renamed = appReducer(initial, {
      type: "rename-note",
      noteId,
      title: "",
    });

    expect(renamed.notesDocs[noteId].title).toBe("");
  });

  test("deletes the last note and clears the selection", () => {
    const initial = createInitialState("2026-03-11");
    const noteId = initial.uiState.selectedNoteId!;

    const deleted = appReducer(initial, {
      type: "delete-note",
      noteId,
    });

    expect(deleted.notesDocs).toEqual({});
    expect(deleted.uiState.selectedNoteId).toBeNull();
  });

  test("starts a focus timer and moves a pending task into ongoing", () => {
    const initial = createInitialState("2026-03-11");
    initial.dailyPages["2026-03-11"].todos = [
      {
        id: "todo_1",
        text: "Focus task",
        priority: 1,
        status: "pending",
        estimatedMinutes: 25,
        createdAt: "2026-03-11T08:00:00.000Z",
      },
    ];

    const started = appReducer(initial, {
      type: "start-focus-timer",
      date: "2026-03-11",
      todoId: "todo_1",
      estimateMinutes: 25,
    });

    expect(started.dailyPages["2026-03-11"].todos[0].status).toBe("ongoing");
    expect(started.uiState.focusedTodoId).toBe("todo_1");
    expect(started.uiState.focusTimerStatus).toBe("running");
    expect(started.uiState.focusTimerRemainingSeconds).toBe(1500);
  });

  test("makes a main todo a subtask and clears its active focus timer", () => {
    const initial = createInitialState("2026-03-11");
    initial.dailyPages["2026-03-11"].todos = [
      {
        id: "todo_parent",
        text: "Parent task",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-11T08:00:00.000Z",
      },
      {
        id: "todo_moving",
        text: "Moving task",
        priority: 2,
        status: "ongoing",
        estimatedMinutes: 25,
        createdAt: "2026-03-11T08:05:00.000Z",
      },
    ];
    initial.uiState.isFocusMode = true;
    initial.uiState.focusedTodoId = "todo_moving";
    initial.uiState.focusTimerStatus = "running";
    initial.uiState.focusTimerRemainingSeconds = 1200;

    const nested = appReducer(initial, {
      type: "make-todo-subtask",
      date: "2026-03-11",
      todoId: "todo_moving",
      parentId: "todo_parent",
    });

    expect(nested.dailyPages["2026-03-11"].todos[1]).toMatchObject({
      id: "todo_moving",
      parentId: "todo_parent",
      priority: 1,
    });
    expect(nested.uiState.focusedTodoId).toBeNull();
    expect(nested.uiState.focusTimerStatus).toBe("idle");
  });

  test("opens the completion prompt at zero and can resolve by finishing the task", () => {
    const initial = createInitialState("2026-03-11");
    initial.dailyPages["2026-03-11"].todos = [
      {
        id: "todo_1",
        text: "Focus task",
        priority: 1,
        status: "ongoing",
        estimatedMinutes: 1,
        createdAt: "2026-03-11T08:00:00.000Z",
      },
    ];
    initial.uiState.isFocusMode = true;
    initial.uiState.focusedTodoId = "todo_1";
    initial.uiState.focusTimerStatus = "running";
    initial.uiState.focusTimerRemainingSeconds = 1;
    initial.uiState.focusTimerBaseEstimateMinutes = 1;

    const zeroed = appReducer(initial, { type: "tick-focus-timer" });
    expect(zeroed.uiState.isFocusTimerCompletionPromptOpen).toBe(true);
    expect(zeroed.uiState.focusTimerRemainingSeconds).toBe(0);

    const finished = appReducer(zeroed, {
      type: "resolve-focus-timer-complete",
      resolution: "finish",
    });

    expect(finished.dailyPages["2026-03-11"].todos[0].status).toBe("finished");
    expect(finished.uiState.focusedTodoId).toBeNull();
    expect(finished.uiState.isFocusMode).toBe(false);
  });

  test("deletes a note folder recursively with its nested notes", () => {
    const initial = createInitialState("2026-03-11");
    initial.noteFolders = {
      folder_1: {
        id: "folder_1",
        name: "Projects",
        parentId: null,
        updatedAt: "2026-03-11T08:00:00.000Z",
      },
      folder_2: {
        id: "folder_2",
        name: "Sprint",
        parentId: "folder_1",
        updatedAt: "2026-03-11T08:05:00.000Z",
      },
    };
    initial.notesDocs = {
      note_1: {
        id: "note_1",
        title: "Inside root",
        folderId: "folder_1",
        markdown: "",
        updatedAt: "2026-03-11T09:00:00.000Z",
      },
      note_2: {
        id: "note_2",
        title: "Inside child",
        folderId: "folder_2",
        markdown: "",
        updatedAt: "2026-03-11T09:05:00.000Z",
      },
    };
    initial.uiState.selectedNoteFolderId = "folder_1";
    initial.uiState.selectedNoteId = "note_2";

    const deleted = appReducer(initial, {
      type: "delete-note-folder",
      folderId: "folder_1",
    });

    expect(deleted.noteFolders).toEqual({});
    expect(deleted.notesDocs).toEqual({});
    expect(deleted.uiState.selectedNoteFolderId).toBeNull();
    expect(deleted.uiState.selectedNoteId).toBeNull();
  });

  test("renames a note folder", () => {
    const initial = createInitialState("2026-03-11");
    initial.noteFolders = {
      folder_1: {
        id: "folder_1",
        name: "Projects",
        parentId: null,
        updatedAt: "2026-03-11T08:00:00.000Z",
      },
    };

    const renamed = appReducer(initial, {
      type: "rename-note-folder",
      folderId: "folder_1",
      name: "Work",
    });

    expect(renamed.noteFolders.folder_1.name).toBe("Work");
  });

  test("moves a note into a folder", () => {
    const initial = createInitialState("2026-03-11");
    initial.noteFolders = {
      folder_1: {
        id: "folder_1",
        name: "Projects",
        parentId: null,
        updatedAt: "2026-03-11T08:00:00.000Z",
      },
    };
    initial.notesDocs = {
      note_1: {
        id: "note_1",
        title: "Launch Plan",
        folderId: null,
        markdown: "",
        updatedAt: "2026-03-11T09:00:00.000Z",
      },
    };

    const moved = appReducer(initial, {
      type: "move-note-to-folder",
      noteId: "note_1",
      folderId: "folder_1",
    });

    expect(moved.notesDocs.note_1.folderId).toBe("folder_1");
    expect(moved.uiState.selectedNoteId).toBe("note_1");
    expect(moved.uiState.selectedNoteFolderId).toBe("folder_1");
    expect(moved.uiState.expandedNoteFolders).toContain("folder_1");
  });
});

describe("AppProvider theme class behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  test("applies dark class for explicit dark and removes for light", async () => {
    installMatchMedia(false);
    renderWithProviders();
    expect(await screen.findByTestId("theme-mode")).toHaveTextContent("dark");

    await userEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  test("system mode follows matchMedia and updates on preference change", async () => {
    const media = installMatchMedia(false);
    renderWithProviders();
    expect(await screen.findByTestId("theme-mode")).toHaveTextContent("dark");

    await userEvent.click(screen.getByRole("button", { name: "system" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => {
      media.setMatches(true);
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  test("renders auth gate until the user signs in", async () => {
    const auth = createMockAuthRepository(null);
    const persistence = createMockPersistenceRepository(createInitialState("2026-03-11"));

    render(
      <AuthProvider repository={auth.repository}>
        <AppProvider repository={persistence.repository}>
          <Harness />
        </AppProvider>
      </AuthProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Sign in to your DailyTodo workspace" }),
    ).toBeInTheDocument();
    expect(persistence.repository.load).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Email"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getAllByRole("button", { name: "Sign in" })[1]);

    expect(await screen.findByTestId("theme-mode")).toHaveTextContent("dark");
    expect(persistence.repository.load).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        now: expect.any(Date),
        onRemoteSync: expect.any(Function),
      }),
    );
  });

  test("keeps editing available when persistence save fails", async () => {
    installMatchMedia(false);
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const persistence = createMockPersistenceRepository(createInitialState("2026-03-11"));
    persistence.repository.save = vi.fn(async () => {
      throw new Error("network down");
    });

    render(
      <AuthProvider repository={auth.repository}>
        <AppProvider repository={persistence.repository}>
          <Harness />
        </AppProvider>
      </AuthProvider>,
    );

    expect(await screen.findByTestId("theme-mode")).toHaveTextContent("dark");

    await userEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(screen.getByTestId("theme-mode")).toHaveTextContent("dark");
  });
});

describe("AppProvider save queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    installMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("shows unsynced when a save fails without blocking editing", async () => {
    const { persistence } = renderWithProviders();

    persistence.repository.save = vi.fn(async () => {
      throw new Error("network down");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("sync-indicator")).toHaveTextContent("saved");

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Welcome note!" },
    });

    expect(screen.getByTestId("sync-indicator")).toHaveTextContent("saving");

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(screen.getByTestId("sync-indicator")).toHaveTextContent("unsynced");
    expect(screen.getByLabelText("Note title")).toHaveValue("Welcome note!");
  });

  test("debounces note title saves and avoids per-character requests", async () => {
    const { persistence } = renderWithProviders();
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("sync-indicator")).toHaveTextContent("saved");

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "S" },
    });
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Sp" },
    });
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "Sprint notes" },
    });

    expect(screen.getByTestId("sync-indicator")).toHaveTextContent("saving");
    expect(persistence.repository.save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2999);
    });
    expect(persistence.repository.save).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("sync-indicator")).toHaveTextContent("saved");
  });

  test("debounces note body remote saves for 5 seconds", async () => {
    const { persistence } = renderWithProviders();
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText("Note markdown"), {
      target: { value: "Draft" },
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(persistence.repository.saveNoteBody).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(4999);
    });
    expect(persistence.repository.saveNoteBody).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(persistence.repository.saveNoteBody).toHaveBeenCalledTimes(1);
  });

  test("throttles remote workspace saves to at most once every 10 seconds", async () => {
    const { persistence } = renderWithProviders();
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "A" },
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "AB" },
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(6999);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(2);
  });

  test("queues one follow-up save when edits happen during an in-flight save", async () => {
    const persistence = createMockPersistenceRepository(createInitialState("2026-03-11"));
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    let saveCallCount = 0;
    let resolveFirstSave!: () => void;
    const firstSavePromise = new Promise<void>((resolve) => {
      resolveFirstSave = resolve;
    });

    persistence.repository.save = vi.fn(async () => {
      saveCallCount += 1;

      if (saveCallCount === 1) {
        await firstSavePromise;
      }

      return {
        status: "synced" as const,
        metadata: createPersistenceMetadata({
          lastLocalMutationAt: "2026-03-11T08:10:00.000Z",
          lastRemoteUpdatedAt: "2026-03-11T08:10:01.000Z",
          lastRemoteUpdatedAtClient: "2026-03-11T08:10:00.000Z",
        }),
        conflictResolution: "none" as const,
        notice: null,
        errorMessage: null,
      };
    });

    render(
      <AuthProvider repository={auth.repository}>
        <AppProvider repository={persistence.repository}>
          <Harness />
        </AppProvider>
      </AuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("sync-indicator")).toHaveTextContent("saved");

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "A" },
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("sync-indicator")).toHaveTextContent("saving");

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "AB" },
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("sync-indicator")).toHaveTextContent("saving");

    resolveFirstSave();

    await act(async () => {
      await firstSavePromise;
      await Promise.resolve();
    });

    expect(persistence.repository.save).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(6999);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("sync-indicator")).toHaveTextContent("saved");
  });

  test("manual retry bypasses debounce and throttle", async () => {
    const { persistence } = renderWithProviders();
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "A" },
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "AB" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "retry sync" }));
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(2);
  });

  test("pagehide flush bypasses debounce and throttle", async () => {
    const { persistence } = renderWithProviders();
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "A" },
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "AB" },
    });

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(2);
  });

  test("hidden tab flush bypasses debounce and throttle", async () => {
    const { persistence } = renderWithProviders();
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "A" },
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: "AB" },
    });

    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(persistence.repository.save).toHaveBeenCalledTimes(2);
  });
});

describe("AppProvider cache-first hydration", () => {
  test("keeps a local card drag when a later remote hydration finishes", async () => {
    installMatchMedia(false);
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const cachedState = appReducer(createInitialState("2026-03-11"), {
      type: "create-content-card",
      columnId: "content-column-ideas",
      title: "Move this card",
    });
    const persistence = createMockPersistenceRepository(cachedState);
    let finishRemoteHydration:
      | NonNullable<Parameters<typeof persistence.repository.load>[0]["onRemoteSync"]>
      | undefined;

    persistence.repository.load = vi.fn(async ({ onRemoteSync }) => {
      finishRemoteHydration = onRemoteSync;
      return {
        state: cachedState,
        source: "local" as const,
        status: "syncing" as const,
        metadata: createPersistenceMetadata({
          lastRemoteUpdatedAt: "2026-03-11T08:00:00.000Z",
          lastRemoteUpdatedAtClient: "2026-03-11T08:00:00.000Z",
        }),
        conflictResolution: "none" as const,
        notice: null,
        errorMessage: null,
        persistenceAvailable: true,
      };
    });

    render(
      <AuthProvider repository={auth.repository}>
        <AppProvider repository={persistence.repository}>
          <ContentPlannerSyncHarness />
        </AppProvider>
      </AuthProvider>,
    );

    expect(await screen.findByTestId("dragged-card-column")).toHaveTextContent(
      "content-column-ideas",
    );
    await userEvent.click(screen.getByRole("button", { name: "move planner card" }));
    expect(screen.getByTestId("dragged-card-column")).toHaveTextContent(
      "content-column-planned",
    );

    const remoteState = {
      ...cachedState,
      contentBoard: renameContentColumn(
        cachedState.contentBoard,
        "content-column-ideas",
        "Inbox",
      ),
    };
    await act(async () => {
      finishRemoteHydration?.({
        state: remoteState,
        source: "remote",
        status: "synced",
        metadata: createPersistenceMetadata({
          lastRemoteUpdatedAt: "2026-03-11T08:01:00.000Z",
          lastRemoteUpdatedAtClient: "2026-03-11T08:01:00.000Z",
        }),
        conflictResolution: "remote-overwrote-local",
        notice: "Newer changes from another device were loaded.",
        errorMessage: null,
        persistenceAvailable: true,
      });
      await Promise.resolve();
    });

    expect(screen.getByTestId("hydrated-column-title")).toHaveTextContent("Inbox");
    expect(screen.getByTestId("dragged-card-column")).toHaveTextContent(
      "content-column-planned",
    );
  });

  test("refreshes a clean workspace from PocketBase when the window regains focus", async () => {
    installMatchMedia(false);
    const auth = createMockAuthRepository({
      userId: "user_1",
      email: "test@example.com",
      isVerified: true,
      accessToken: "token_1",
    });
    const initialState = createInitialState("2026-03-11");
    const refreshedState = {
      ...initialState,
      contentBoard: renameContentColumn(
        initialState.contentBoard,
        "content-column-ideas",
        "Inbox",
      ),
    };
    const persistence = createMockPersistenceRepository(initialState);
    const metadata = createPersistenceMetadata({
      lastRemoteUpdatedAt: "2026-03-11T08:00:00.000Z",
      lastRemoteUpdatedAtClient: "2026-03-11T08:00:00.000Z",
    });
    const loadResult = {
      state: initialState,
      source: "remote" as const,
      status: "synced" as const,
      metadata,
      conflictResolution: "none" as const,
      notice: null,
      errorMessage: null,
      persistenceAvailable: true,
    };

    persistence.repository.load = vi
      .fn()
      .mockResolvedValueOnce(loadResult)
      .mockResolvedValueOnce({
        ...loadResult,
        state: refreshedState,
        metadata: createPersistenceMetadata({
          lastRemoteUpdatedAt: "2026-03-11T08:02:00.000Z",
          lastRemoteUpdatedAtClient: "2026-03-11T08:02:00.000Z",
        }),
      });

    render(
      <AuthProvider repository={auth.repository}>
        <AppProvider repository={persistence.repository}>
          <ContentPlannerSyncHarness />
        </AppProvider>
      </AuthProvider>,
    );

    expect(await screen.findByTestId("hydrated-column-title")).toHaveTextContent(
      "Ideas",
    );

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(persistence.repository.load).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("hydrated-column-title")).toHaveTextContent("Inbox");
  });
});
