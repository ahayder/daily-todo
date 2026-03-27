import { useReducer } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { appReducer } from "@/components/app-context";
import { PlannerView } from "@/components/planner-view";
import { createInitialState } from "@/lib/store";

function Harness() {
  const initial = createInitialState("2026-03-11");
  initial.uiState.lastView = "planner";
  const presetId = initial.uiState.selectedPlannerPresetId!;
  initial.plannerPresets[presetId].days.monday.events = [
    {
      id: "event-1",
      dayKey: "monday",
      title: "Deep Work",
      startMinutes: 540,
      endMinutes: 660,
      color: "teal",
      notes: "Focus mode",
    },
    {
      id: "event-2",
      dayKey: "monday",
      title: "Family Time",
      startMinutes: 600,
      endMinutes: 690,
      color: "gold",
      notes: "",
    },
  ];

  const [state, dispatch] = useReducer(appReducer, initial);
  return <PlannerView state={state} dispatch={dispatch} />;
}

describe("PlannerView", () => {
  test("renders weekday columns without date labels", () => {
    render(<Harness />);

    expect(screen.getByText("Monday")).toBeInTheDocument();
    expect(screen.getByText("Sunday")).toBeInTheDocument();
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
  });

  test("creates an event from the grid and saves title, color, and notes", async () => {
    render(<Harness />);

    const startSlot = screen.getByTestId("planner-slot-tuesday-16");
    const endSlot = screen.getByTestId("planner-slot-tuesday-19");

    fireEvent.mouseDown(startSlot);
    fireEvent.mouseEnter(endSlot);
    fireEvent.mouseUp(endSlot);

    expect(screen.getByTestId("planner-editor-popover")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Planner event title"), "Sleep");
    await userEvent.click(screen.getByRole("button", { name: "Color rose" }));
    await userEvent.type(screen.getByLabelText("Planner event notes"), "Wind down first");
    await userEvent.click(screen.getByRole("button", { name: "Save block" }));

    expect(screen.getByText("Sleep")).toBeInTheDocument();
    expect(screen.getByText("Wind down first")).toBeInTheDocument();
    expect(screen.queryByTestId("planner-editor-popover")).not.toBeInTheDocument();
  }, 15000);

  test("keeps the dragged slot range visible until cancel", async () => {
    render(<Harness />);

    const startSlot = screen.getByTestId("planner-slot-tuesday-10");
    const endSlot = screen.getByTestId("planner-slot-tuesday-12");

    fireEvent.mouseDown(startSlot);
    fireEvent.mouseEnter(endSlot);
    fireEvent.mouseUp(endSlot);

    expect(startSlot.className).toContain("planner-slot--selected");
    expect(endSlot.className).toContain("planner-slot--selected");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(startSlot.className).not.toContain("planner-slot--selected");
    expect(screen.queryByTestId("planner-editor-popover")).not.toBeInTheDocument();
  });

  test("renders overlapping events in the same day", () => {
    render(<Harness />);

    expect(screen.getByText("Deep Work")).toBeInTheDocument();
    expect(screen.getByText("Family Time")).toBeInTheDocument();
  });

  test("opens the floating editor when clicking an existing event", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: /Deep Work/i }));

    expect(screen.getByTestId("planner-editor-popover")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Deep Work")).toBeInTheDocument();
    expect(screen.queryByText("How it works")).not.toBeInTheDocument();
  });
});
