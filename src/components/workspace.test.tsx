import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Workspace } from "@/components/workspace";
import { createInitialState } from "@/lib/store";

const mockUseAppState = vi.fn();

vi.mock("@/components/app-context", () => ({
  useAppState: () => mockUseAppState(),
}));

vi.mock("@/components/todos-view", () => ({
  TodosView: () => <div data-testid="todos-view" />,
}));

vi.mock("@/components/notes-view", () => ({
  NotesView: () => <div data-testid="notes-view" />,
}));

vi.mock("@/components/planner-view", () => ({
  PlannerView: () => <div data-testid="planner-view" />,
}));

vi.mock("@/components/sidebar", () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));

vi.mock("@/components/top-navbar", () => ({
  TopNavbar: () => <header data-testid="top-navbar" />,
}));

describe("Workspace", () => {
  test("hides the top navbar and sidebar in focus mode", () => {
    const state = createInitialState("2026-03-11");
    state.uiState.isFocusMode = true;
    state.uiState.lastView = "todos";
    const dispatch = vi.fn();

    mockUseAppState.mockReturnValue({
      state,
      dispatch,
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
});
