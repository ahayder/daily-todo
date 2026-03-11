import { useReducer } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DailyView } from "@/components/daily-view";
import { appReducer } from "@/components/app-context";
import { createInitialState } from "@/lib/store";

vi.mock("@/components/markdown-editor", () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor" />,
}));

vi.mock("@/components/drawing-overlay", () => ({
  DrawingOverlay: () => <div data-testid="drawing-overlay" />,
}));

function Harness() {
  const initial = createInitialState("2026-03-11");
  initial.dailyPages["2026-03-11"].todos = [
    {
      id: "todo-1",
      text: "Task one",
      priority: 1,
      done: false,
      createdAt: "2026-03-11T10:00:00.000Z",
    },
  ];

  const [state, dispatch] = useReducer(appReducer, initial);
  return <DailyView state={state} dispatch={dispatch} />;
}

describe("DailyView", () => {
  test("applies strikethrough when checkbox is toggled", async () => {
    render(<Harness />);

    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);

    const taskText = screen.getByText("Task one");
    expect(taskText).toHaveClass("done");
  });
});
