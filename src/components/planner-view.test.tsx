import { useReducer } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { appReducer } from "@/components/app/app-context";
import { PlannerView } from "@/components/planner/planner-view";
import { createInitialState } from "@/lib/store";

function Harness() {
  const initial = createInitialState("2026-03-11");
  initial.uiState.lastView = "planner";
  const presetId = initial.uiState.selectedPlannerPresetId!;
  initial.plannerPresets[presetId].days.monday.purposes = [
    {
      id: "purpose-office",
      title: "Office work",
      targetMinutes: 480,
      role: "primary",
      color: "teal",
      notes: "Protect focus time",
    },
    {
      id: "purpose-family",
      title: "Family time",
      targetMinutes: 210,
      role: "primary",
      color: "gold",
      notes: "",
    },
    {
      id: "purpose-learning",
      title: "Learning",
      targetMinutes: 90,
      role: "secondary",
      color: "lavender",
      notes: "Can overlap a commute",
    },
  ];
  initial.plannerPresets[presetId].days.monday.events = [
    {
      id: "event-office-morning",
      purposeId: "purpose-office",
      dayKey: "monday",
      title: "Deep work",
      startMinutes: 540,
      endMinutes: 720,
      color: "teal",
      notes: "Protect focus time",
    },
    {
      id: "event-family",
      purposeId: "purpose-family",
      dayKey: "monday",
      title: "Family time",
      startMinutes: 600,
      endMinutes: 690,
      color: "gold",
      notes: "",
    },
    {
      id: "event-office-afternoon",
      purposeId: "purpose-office",
      dayKey: "monday",
      title: "Afternoon build",
      startMinutes: 780,
      endMinutes: 1080,
      color: "teal",
      notes: "Protect focus time",
    },
  ];

  const [state, dispatch] = useReducer(appReducer, initial);
  return <PlannerView state={state} dispatch={dispatch} />;
}

describe("PlannerView", () => {
  test("renders a day-first radial schedule with overlap lanes", () => {
    render(<Harness />);

    expect(screen.getByRole("img", { name: "Monday radial schedule" })).toBeInTheDocument();
    expect(screen.getByText("2 overlap lanes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tuesday" })).toBeInTheDocument();
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
  });

  test("shows multiple slices for one purpose and supports exact time editing", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getAllByRole("button", { name: /^Deep work/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Afternoon build/ }).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText("Planner time block start time"), "08:45");
    expect(screen.getByLabelText("Planner time block start time")).toHaveValue("08:45");
    expect(screen.getByText("8:45 AM – 12:00 PM")).toBeInTheDocument();
  });

  test("shows child time blocks under their main focus and edits a block label", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(
      screen.getByRole("button", { name: /Deep work, .* under Office work/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Afternoon build, .* under Office work/ }),
    ).toBeInTheDocument();

    const titleInput = screen.getByLabelText("Planner time block title");
    await user.clear(titleInput);
    await user.type(titleInput, "Morning focus");
    await user.tab();

    expect(
      screen.getByRole("button", { name: /Morning focus, .* under Office work/ }),
    ).toBeInTheDocument();
  });

  test("adjusts a selected slice from the keyboard-accessible drag handle", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const startHandle = screen.getByTestId("planner-drag-handle-start");
    startHandle.focus();
    await user.keyboard("{ArrowLeft}");

    expect(screen.getByLabelText("Planner time block start time")).toHaveValue("08:45");
  });

  test("switches to a 24-hour allocation view without counting secondary purposes", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Allocate" }));

    expect(screen.getByRole("img", { name: "Monday focus allocation" })).toBeInTheDocument();
    expect(screen.getByText("12h 30m open")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Office work, 8h daily target" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Learning, 1h 30m daily target" }),
    ).not.toBeInTheDocument();
  });

  test("hides and restores the details panel so the wheel can expand", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Hide planner details" }));
    expect(screen.queryByRole("complementary", { name: "Planner details" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show planner details" }));
    expect(screen.getByRole("complementary", { name: "Planner details" })).toBeInTheDocument();
  });

  test("creates a purpose on manually selected days", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Add focus" }));
    await user.type(screen.getByLabelText("Planner main focus title"), "Recovery");
    await user.click(screen.getByLabelText("Create on Tuesday"));
    await user.click(screen.getByLabelText("Create on Wednesday"));
    await user.click(screen.getByRole("button", { name: "Create main focus" }));

    await user.click(screen.getByRole("button", { name: "Tuesday" }));
    expect(screen.getAllByText("Recovery").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Wednesday" }));
    expect(screen.getAllByText("Recovery").length).toBeGreaterThan(0);
  });
});
