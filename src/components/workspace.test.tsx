import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Workspace } from "@/components/workspace/workspace";
import { createInitialState } from "@/lib/store";

const mockUseAppState = vi.fn();
const mockContentPlannerView = vi.fn();

vi.mock("@/components/app/app-context", () => ({
  useAppState: () => mockUseAppState(),
}));

vi.mock("@/components/todos/todos-view", () => ({
  TodosView: () => <div data-testid="todos-view" />,
}));

vi.mock("@/components/notes/notes-view", () => ({
  NotesView: () => <div data-testid="notes-view" />,
}));

vi.mock("@/components/planner/planner-view", () => ({
  PlannerView: () => <div data-testid="planner-view" />,
}));

vi.mock("@/components/content-planner-view", () => ({
  ContentPlannerView: (props: unknown) => {
    mockContentPlannerView(props);
    return <div data-testid="content-planner-view" />;
  },
}));

vi.mock("@/components/workspace/sidebar", () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));

vi.mock("@/components/workspace/top-navbar", () => ({
  TopNavbar: () => <header data-testid="top-navbar" />,
}));

describe("Workspace", () => {
  beforeEach(() => {
    mockUseAppState.mockReset();
    mockContentPlannerView.mockReset();
  });

  test("passes the board model and board actions to the content planner", () => {
    const state = createInitialState("2026-03-11");
    state.uiState.lastView = "content-planner";
    state.uiState.selectedNoteId = Object.keys(state.notesDocs)[0] ?? null;
    const dispatch = vi.fn();

    mockUseAppState.mockReturnValue({
      state,
      dispatch,
      notes: {
        selectedBodyStatus: "ready",
        selectedBodyNotice: null,
        selectedBodyError: null,
      },
      sync: {
        status: "idle",
        indicator: "saved",
        lastSavedAt: null,
        lastSyncedAt: null,
        notice: null,
        errorMessage: null,
        hasPendingChanges: false,
        hasUnsyncedChanges: false,
        isSaving: false,
        persistenceAvailable: true,
      },
      retrySync: vi.fn(),
    });

    render(<Workspace forcedView="content-planner" />);

    const props = mockContentPlannerView.mock.calls.at(-1)?.[0] as Record<string, unknown>;

    expect(props.board).toBe(state.contentBoard);
    expect(props.cards).toBe(state.contentCards);
    expect(typeof props.onAddColumn).toBe("function");
    expect(typeof props.onMoveCard).toBe("function");
  });

  test("hides the top navbar and sidebar in focus mode", () => {
    const state = createInitialState("2026-03-11");
    state.uiState.isFocusMode = true;
    state.uiState.lastView = "todos";
    const dispatch = vi.fn();

    mockUseAppState.mockReturnValue({
      state,
      dispatch,
      notes: {
        selectedBodyStatus: "ready",
        selectedBodyNotice: null,
        selectedBodyError: null,
      },
      sync: {
        status: "idle",
        indicator: "saved",
        lastSavedAt: null,
        lastSyncedAt: null,
        notice: null,
        errorMessage: null,
        hasPendingChanges: false,
        hasUnsyncedChanges: false,
        isSaving: false,
        persistenceAvailable: true,
      },
      retrySync: vi.fn(),
    });

    render(<Workspace />);

    expect(screen.queryByTestId("top-navbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(screen.getByTestId("todos-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close Focus Mode" })).toBeInTheDocument();
  });

  test("renders the content planner view when forced", () => {
    const state = createInitialState("2026-03-11");
    const dispatch = vi.fn();

    mockUseAppState.mockReturnValue({
      state,
      dispatch,
      notes: {
        selectedBodyStatus: "ready",
        selectedBodyNotice: null,
        selectedBodyError: null,
      },
      sync: {
        status: "idle",
        indicator: "saved",
        lastSavedAt: null,
        lastSyncedAt: null,
        notice: null,
        errorMessage: null,
        hasPendingChanges: false,
        hasUnsyncedChanges: false,
        isSaving: false,
        persistenceAvailable: true,
      },
      retrySync: vi.fn(),
    });

    render(<Workspace forcedView="content-planner" />);

    expect(screen.getByTestId("content-planner-view")).toBeInTheDocument();
    expect(screen.getByTestId("top-navbar")).toBeInTheDocument();
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("content-planner-view").closest("[data-content-planner-full-width='true']"),
    ).not.toBeNull();
  });

  test("sets shared content font CSS variables on the shell", () => {
    const state = createInitialState("2026-03-11");
    state.uiState.contentFontScale = 1.15;
    const dispatch = vi.fn();

    mockUseAppState.mockReturnValue({
      state,
      dispatch,
      notes: {
        selectedBodyStatus: "ready",
        selectedBodyNotice: null,
        selectedBodyError: null,
      },
      sync: {
        status: "idle",
        indicator: "saved",
        lastSavedAt: null,
        lastSyncedAt: null,
        notice: null,
        errorMessage: null,
        hasPendingChanges: false,
        hasUnsyncedChanges: false,
        isSaving: false,
        persistenceAvailable: true,
      },
      retrySync: vi.fn(),
    });

    const { container } = render(<Workspace />);
    const shell = container.querySelector(".app-shell");

    expect(shell).not.toBeNull();
    expect(shell).toHaveStyle({
      "--content-font-scale": "1.15",
      "--content-font-size-editor": "calc(18px * var(--content-font-scale))",
    });
  });

  test("handles shared content font keyboard shortcuts", () => {
    const state = createInitialState("2026-03-11");
    const dispatch = vi.fn();

    mockUseAppState.mockReturnValue({
      state,
      dispatch,
      notes: {
        selectedBodyStatus: "ready",
        selectedBodyNotice: null,
        selectedBodyError: null,
      },
      sync: {
        status: "idle",
        indicator: "saved",
        lastSavedAt: null,
        lastSyncedAt: null,
        notice: null,
        errorMessage: null,
        hasPendingChanges: false,
        hasUnsyncedChanges: false,
        isSaving: false,
        persistenceAvailable: true,
      },
      retrySync: vi.fn(),
    });

    render(<Workspace />);

    const increaseEvent = new KeyboardEvent("keydown", {
      key: "=",
      metaKey: true,
      cancelable: true,
    });
    window.dispatchEvent(increaseEvent);

    const decreaseEvent = new KeyboardEvent("keydown", {
      key: "-",
      ctrlKey: true,
      cancelable: true,
    });
    window.dispatchEvent(decreaseEvent);

    const resetEvent = new KeyboardEvent("keydown", {
      key: "0",
      metaKey: true,
      cancelable: true,
    });
    window.dispatchEvent(resetEvent);

    expect(increaseEvent.defaultPrevented).toBe(true);
    expect(decreaseEvent.defaultPrevented).toBe(true);
    expect(resetEvent.defaultPrevented).toBe(true);
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: "increase-content-font-scale" });
    expect(dispatch).toHaveBeenNthCalledWith(2, { type: "decrease-content-font-scale" });
    expect(dispatch).toHaveBeenNthCalledWith(3, { type: "reset-content-font-scale" });
  });
});
