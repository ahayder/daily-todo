import { useReducer } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import confetti from "canvas-confetti";
import {
  TodosView,
  getDropIndicatorPosition,
  getDropInsertionIndex,
} from "@/components/todos-view";
import { appReducer } from "@/components/app-context";
import { createInitialState } from "@/lib/store";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/components/markdown-editor", () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor" />,
}));

function Harness({
  todos = [
    {
      id: "todo-1",
      text: "Task one",
      priority: 1,
      status: "pending",
      estimatedMinutes: null,
      createdAt: "2026-03-11T10:00:00.000Z",
    },
  ],
}: {
  todos?: Array<{
    id: string;
    text: string;
    priority: 1 | 2 | 3;
    status: "pending" | "ongoing" | "finished";
    estimatedMinutes: number | null;
    createdAt: string;
    parentId?: string;
  }>;
}) {
  const initial = createInitialState("2026-03-11");
  initial.dailyPages["2026-03-11"].todos = todos;

  const [state, dispatch] = useReducer(appReducer, initial);
  return <TodosView state={state} dispatch={dispatch} />;
}

describe("TodosView", () => {
  test("detects whether a drop indicator should render before or after a hovered task", () => {
    expect(
      getDropIndicatorPosition({
        activeTop: 10,
        activeHeight: 20,
        overTop: 0,
        overHeight: 40,
      }),
    ).toBe("before");

    expect(
      getDropIndicatorPosition({
        activeTop: 35,
        activeHeight: 20,
        overTop: 0,
        overHeight: 40,
      }),
    ).toBe("after");
  });

  test("computes insertion indexes that match before and after drop lines", () => {
    const siblingIds = ["todo-1", "todo-2", "todo-3", "todo-4"];

    expect(
      getDropInsertionIndex({
        siblingIds,
        activeId: "todo-2",
        overId: "todo-3",
        position: "after",
      }),
    ).toBe(2);

    expect(
      getDropInsertionIndex({
        siblingIds,
        activeId: "todo-4",
        overId: "todo-2",
        position: "before",
      }),
    ).toBe(1);
  });

  test("applies strikethrough when status is advanced to finished", async () => {
    render(<Harness />);

    const statusButton = screen.getByRole("button", { name: "Status for Task one" });
    await userEvent.click(statusButton);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await userEvent.click(statusButton);
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    const taskText = screen.getByText("Task one");
    expect(taskText).toHaveClass("task-text--done");
    expect(confetti).toHaveBeenCalled();
  });

  test("uses enter to add without an Add button", async () => {
    render(<Harness />);

    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText("Add a critical task…");
    await userEvent.type(input, "Task two{enter}");

    expect(screen.getByText("Task two")).toBeInTheDocument();
  });

  test("shows semantic priority headings and empty states", () => {
    render(<Harness />);

    expect(screen.getByRole("heading", { name: "Critical" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Important" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Someday" })).toBeInTheDocument();

    const emptyStates = screen.getAllByText("No tasks yet");
    expect(emptyStates).toHaveLength(2);
  });

  test("renders task pane top bar actions and cycles the category theme", async () => {
    render(<Harness />);

    const taskHeading = screen.getByRole("heading", { name: "Tasks" });
    expect(taskHeading).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Focus Mode" })).toBeInTheDocument();
    const scrollArea = screen.getByTestId("task-pane-scroll");
    expect(scrollArea).toBeInTheDocument();
    expect(scrollArea).not.toContainElement(taskHeading);

    const categoryButton = screen.getByRole("button", { name: "Category labels: normal" });
    await userEvent.click(categoryButton);

    expect(screen.getByRole("button", { name: "Category labels: adhd1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Must Do (Non-negotiable)" })).toBeInTheDocument();
  });

  test("shows the resize indicator on hover", () => {
    render(<Harness />);

    const resizer = screen.getByTestId("task-pane-resizer");
    expect(resizer).not.toHaveClass("daily-resize-rail--hovered");

    fireEvent.mouseEnter(resizer);
    expect(resizer).toHaveClass("daily-resize-rail--hovered");

    fireEvent.mouseLeave(resizer);
    expect(resizer).not.toHaveClass("daily-resize-rail--hovered");
  });

  test("lets the task pane width be adjusted by dragging the divider", () => {
    render(<Harness />);

    const layout = screen.getByTestId("task-pane-resizer").closest(".daily-layout") as HTMLElement;
    vi.spyOn(layout, "getBoundingClientRect").mockReturnValue({
      width: 1200,
      height: 800,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const resizer = screen.getByTestId("task-pane-resizer");

    fireEvent.pointerDown(resizer, { clientX: 800 });
    fireEvent.pointerMove(window, { clientX: 740 });

    expect(layout).toHaveStyle({
      gridTemplateColumns: "minmax(0, 1fr) 6px minmax(320px, clamp(320px, 560px, calc(100% - 480px - 6px)))",
    });

    fireEvent.pointerUp(window);
    expect(resizer).not.toHaveClass("daily-resize-rail--dragging");
  });

  test("reveals the add-subtask action on hover and opens the composer on click", async () => {
    render(<Harness />);

    expect(screen.queryByPlaceholderText("Add a subtask")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add subtask" })).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByText("Task one"));

    const addSubtaskButton = await screen.findByRole("button", { name: "Add subtask" });
    await userEvent.click(addSubtaskButton);
    expect(screen.getByPlaceholderText("Add a subtask")).toBeInTheDocument();
  });

  test("uses the task body as the drag surface while keeping action buttons separate", () => {
    render(<Harness />);

    const taskText = screen.getByText("Task one");
    const dragSurface = taskText.closest(".task-drag-surface");

    expect(dragSurface).not.toBeNull();
    expect(dragSurface).toContainElement(taskText);
    expect(dragSurface?.closest(".task-item")?.querySelector(".task-row-actions")).not.toBeNull();
    expect(dragSurface?.closest(".task-item")?.querySelector(".task-row-action-grip")).toBeNull();
  });

  test("opens inline editing from the edit button and saves on enter", async () => {
    render(<Harness />);

    fireEvent.mouseEnter(screen.getByText("Task one"));
    await userEvent.click(await screen.findByRole("button", { name: "Edit task" }));

    const input = screen.getByDisplayValue("Task one");
    await userEvent.clear(input);
    await userEvent.type(input, "Updated task{enter}");

    expect(screen.getByText("Updated task")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Task one")).not.toBeInTheDocument();
  });

  test("opens inline editing when the task text is clicked", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByText("Task one"));

    expect(await screen.findByDisplayValue("Task one")).toBeInTheDocument();
  });

  test("opens focus mode when the task text is double clicked", async () => {
    render(<Harness />);

    fireEvent.doubleClick(screen.getByText("Task one"));

    expect(await screen.findByText("Remaining Time")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByDisplayValue("Task one")).not.toBeInTheDocument();
    });
  });

  test("opens estimate presets and saves a quick estimate", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Set estimate for Task one" }));
    expect(screen.getByText("Task time")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "20m" }));

    expect(screen.queryByText("Task time")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set estimate for Task one" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit estimate for Task one" })).toHaveTextContent("20m");
  });

  test("closes the subtask composer on escape", async () => {
    render(<Harness />);

    fireEvent.mouseEnter(screen.getByText("Task one"));
    await userEvent.click(await screen.findByRole("button", { name: "Add subtask" }));

    const input = screen.getByPlaceholderText("Add a subtask");
    await userEvent.type(input, "{Escape}");

    expect(screen.queryByPlaceholderText("Add a subtask")).not.toBeInTheDocument();
  });

  test("submits a subtask under the correct parent", async () => {
    render(<Harness />);

    fireEvent.mouseEnter(screen.getByText("Task one"));
    await userEvent.click(await screen.findByRole("button", { name: "Add subtask" }));
    await userEvent.type(screen.getByPlaceholderText("Add a subtask"), "Nested task{enter}");

    expect(screen.getByText("Nested task")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Add a subtask")).not.toBeInTheDocument();
  });

  test("lets a parent task collapse and expand its subtasks", async () => {
    render(
      <Harness
        todos={[
          {
            id: "todo-1",
            text: "Task one",
            priority: 1,
            status: "pending",
            estimatedMinutes: null,
            createdAt: "2026-03-11T10:00:00.000Z",
          },
          {
            id: "todo-2",
            text: "Nested task",
            priority: 1,
            status: "pending",
            estimatedMinutes: null,
            createdAt: "2026-03-11T10:05:00.000Z",
            parentId: "todo-1",
          },
        ]}
      />,
    );

    expect(screen.getByText("Nested task")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Collapse subtasks" }));
    expect(screen.queryByText("Nested task")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Expand subtasks" }));
    expect(screen.getByText("Nested task")).toBeInTheDocument();
  });

  test("does not show time or focus controls for subtasks", async () => {
    render(
      <Harness
        todos={[
          {
            id: "todo-1",
            text: "Task one",
            priority: 1,
            status: "pending",
            estimatedMinutes: null,
            createdAt: "2026-03-11T10:00:00.000Z",
          },
          {
            id: "todo-2",
            text: "Nested task",
            priority: 1,
            status: "pending",
            estimatedMinutes: 20,
            createdAt: "2026-03-11T10:05:00.000Z",
            parentId: "todo-1",
          },
        ]}
      />,
    );

    fireEvent.mouseEnter(screen.getByText("Nested task"));

    expect(screen.queryByRole("button", { name: "Set estimate for Nested task" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit estimate for Nested task" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Focus on this task" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Focus on this task" })).toHaveLength(1);
  });

  test("does not enter focus mode when a subtask is double clicked", async () => {
    render(
      <Harness
        todos={[
          {
            id: "todo-1",
            text: "Task one",
            priority: 1,
            status: "pending",
            estimatedMinutes: null,
            createdAt: "2026-03-11T10:00:00.000Z",
          },
          {
            id: "todo-2",
            text: "Nested task",
            priority: 1,
            status: "pending",
            estimatedMinutes: null,
            createdAt: "2026-03-11T10:05:00.000Z",
            parentId: "todo-1",
          },
        ]}
      />,
    );

    fireEvent.doubleClick(screen.getByText("Nested task"));

    await waitFor(() => {
      expect(screen.queryByText("Remaining Time")).not.toBeInTheDocument();
    });
  });

  test("closes the subtask composer on blur when empty", async () => {
    render(<Harness />);

    fireEvent.mouseEnter(screen.getByText("Task one"));
    await userEvent.click(await screen.findByRole("button", { name: "Add subtask" }));

    const input = screen.getByPlaceholderText("Add a subtask");
    fireEvent.blur(input, { relatedTarget: null });

    expect(screen.queryByPlaceholderText("Add a subtask")).not.toBeInTheDocument();
  });

  test("shows the main add-task input at the top for empty groups", () => {
    render(<Harness todos={[]} />);

    const criticalHeading = screen.getByRole("heading", { name: "Critical" });
    const criticalGroup = criticalHeading.closest(".priority-group");
    expect(criticalGroup).not.toBeNull();

    const firstTextbox = criticalGroup?.querySelector("input");
    expect(firstTextbox).toHaveAttribute("placeholder", "Add a critical task…");
  });
});
