import { useReducer } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { appReducer } from "@/components/app/app-context";
import { PlannerView } from "@/components/planner/planner-view";
import { createInitialState } from "@/lib/store";

function Harness({ hasSeenTour = true }: { hasSeenTour?: boolean } = {}) {
  const initial = createInitialState("2026-03-11");
  initial.uiState.lastView = "planner";
  initial.uiState.hasSeenPlannerTour = hasSeenTour;
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
  test("renders a static planner with a creation date and weekday variations", () => {
    render(<Harness />);

    expect(screen.getByRole("img", { name: "Monday radial schedule" })).toBeInTheDocument();
    expect(screen.getByText("2 overlap lanes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tuesday" })).toBeInTheDocument();
    expect(screen.getByText(/Created .* 2026/)).toBeInTheDocument();
  });

  test("edits the planner title and subtitle directly from the header", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Planner title. Click to edit" }));
    const titleInput = screen.getByLabelText("Planner title");
    await user.clear(titleInput);
    await user.type(titleInput, "My steady rhythm{Enter}");
    expect(
      screen.getByRole("button", { name: "Planner title. Click to edit" }),
    ).toHaveTextContent("My steady rhythm");

    await user.click(screen.getByRole("button", { name: "Planner subtitle. Click to edit" }));
    const subtitleInput = screen.getByLabelText("Planner subtitle");
    await user.clear(subtitleInput);
    await user.type(subtitleInput, "A plan that stays put{Enter}");
    expect(
      screen.getByRole("button", { name: "Planner subtitle. Click to edit" }),
    ).toHaveTextContent("A plan that stays put");
  });

  test("shows the guided tour once and keeps it available from the Guide button", async () => {
    const user = userEvent.setup();
    render(<Harness hasSeenTour={false} />);

    expect(screen.getByRole("dialog", { name: "Daily Planner guided tour" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close planner guide" }));
    expect(
      screen.queryByRole("dialog", { name: "Daily Planner guided tour" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guide" }));
    expect(screen.getByRole("dialog", { name: "Daily Planner guided tour" })).toBeInTheDocument();
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

  test("calculates 24-hour target budget without counting secondary purposes", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // In unified view, the 24-hour budget summary shows 12h 30m open (8h Office Work + 3h 30m Family Time = 11h 30m, Leaving 12h 30m open)
    expect(screen.getByText("12h 30m open")).toBeInTheDocument();
    expect(screen.getAllByText("Office work").length).toBeGreaterThan(0);
  });

  test("hides and restores the details panel so the clock can expand", async () => {
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
  }, 15000);

  test("edits focus name, target time with steppers, role, and adds a child block directly", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Direct rename via UnifiedFocusCard
    await user.click(screen.getByRole("button", { name: "Office work, click to edit title" }));
    const titleInput = screen.getByLabelText("Edit title for Office work");
    await user.clear(titleInput);
    await user.type(titleInput, "Deep Work Hub{Enter}");

    expect(screen.getAllByText("Deep Work Hub").length).toBeGreaterThan(0);

    // Adjust target duration using +15m stepper on the focus card
    await user.click(screen.getByRole("button", { name: "Increase Deep Work Hub target by 15 minutes" }));
    expect(screen.getByText("12h 15m open")).toBeInTheDocument();
    expect(screen.getAllByText("8h 15m").length).toBeGreaterThan(0);

    // Toggle role from Primary to Secondary on focus card
    await user.click(screen.getByRole("button", { name: /Toggle role for Deep Work Hub/ }));
    // When Deep Work Hub is secondary, only Family time (3h 30m) is primary
    expect(screen.getByText("20h 30m open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Toggle role for Deep Work Hub, currently secondary/ })).toBeInTheDocument();

    // Add a new child time block under Deep Work Hub
    await user.click(screen.getByRole("button", { name: "Add time block to Deep Work Hub" }));
    expect(screen.getAllByText(/Deep Work Hub 3/i).length).toBeGreaterThan(0);
  });
});
