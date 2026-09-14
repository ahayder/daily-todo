import { useReducer } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { appReducer } from "@/components/app/app-context";
import { PlannerView } from "@/components/planner/planner-view";
import { createInitialState } from "@/lib/store";
import type { PlannerEvent } from "@/lib/types";

// Pin "now" to Monday 10:00 (weekday template, inside the Deep work block) so the
// NOW screen is deterministic without fake timers (which deadlock userEvent here).
vi.mock("@/lib/planner-now", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/planner-now")>();
  return { ...actual, dayKeyForDate: () => "monday", minutesOfDay: () => 600 };
});

function ev(id: string, title: string, start: number, end: number): PlannerEvent {
  return {
    id,
    title,
    startMinutes: start,
    endMinutes: end,
    dayKey: "monday",
    purposeId: null,
    color: "teal",
    notes: "",
  };
}

function Harness() {
  const initial = createInitialState("2026-09-14");
  initial.uiState.lastView = "planner";
  const presetId = initial.uiState.selectedPlannerPresetId!;
  // Deterministic weekday template: morning, deep work (covers 10:00), gym.
  initial.plannerPresets[presetId].days.monday.events = [
    ev("morning", "Morning routine", 360, 540), // 6:00–9:00
    ev("deep", "Deep work", 540, 750), // 9:00–12:30
    ev("gym", "Gym", 1050, 1110), // 17:30–18:30
  ];
  const [state, dispatch] = useReducer(appReducer, initial);
  return <PlannerView state={state} dispatch={dispatch} />;
}

function setup() {
  const user = userEvent.setup();
  render(<Harness />);
  return user;
}

describe("PlannerView (NOW + Setup)", () => {
  test("NOW shows the current block, time left, and the next block", () => {
    setup();

    expect(screen.getByText(/^Now ·/)).toBeInTheDocument();
    expect(screen.getByText("Deep work")).toBeInTheDocument();
    expect(screen.getByText(/left$/)).toBeInTheDocument(); // "2h 30m left" progress readout
    expect(screen.getByText(/Gym/)).toBeInTheDocument();
    expect(screen.getByText(/· next/)).toBeInTheDocument();
  });

  test("the clock icon reveals the read-only bird's-eye pie", async () => {
    const user = setup();

    expect(screen.queryByRole("img", { name: /24-hour clock/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show whole-day clock" }));
    expect(screen.getByRole("img", { name: /24-hour clock/ })).toBeInTheDocument();
  });

  test("Set up exposes the three day templates and the day's blocks", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Set up" }));

    expect(screen.getByRole("button", { name: "Weekday" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saturday" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sunday" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Deep work")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Block name")).toHaveLength(3);
  });

  test("Add block appends a new row", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Set up" }));
    expect(screen.getAllByLabelText("Block name")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Add block" }));
    expect(screen.getAllByLabelText("Block name")).toHaveLength(4);
  });

  test("editing a block name saves on blur", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Set up" }));
    const input = screen.getByDisplayValue("Deep work");
    await user.clear(input);
    await user.type(input, "Focus sprint");
    await user.tab();

    expect(screen.getByDisplayValue("Focus sprint")).toBeInTheDocument();
  });

  test("removing a block asks for confirmation, then deletes it", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Set up" }));
    expect(screen.getAllByLabelText("Block name")).toHaveLength(3);

    await user.click(screen.getAllByRole("button", { name: "Remove block" })[1]);
    expect(screen.getByRole("alertdialog", { name: "Remove this block?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getAllByLabelText("Block name")).toHaveLength(2);
    expect(screen.queryByDisplayValue("Deep work")).not.toBeInTheDocument();
  });
});
