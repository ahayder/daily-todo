import { useReducer, type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { Sidebar } from "@/components/sidebar";
import { appReducer } from "@/components/app-context";
import { createInitialState } from "@/lib/store";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

function Harness() {
  const initial = createInitialState("2026-03-10");
  initial.dailyPages["2026-03-11"] = {
    date: "2026-03-11",
    markdown: "",
    todos: [],
  };

  const [state, dispatch] = useReducer(appReducer, initial);
  return <Sidebar state={state} dispatch={dispatch} />;
}

describe("Sidebar", () => {
  test("renders tree structure and today button", async () => {
    render(<Harness />);

    const todayButton = screen.getByRole("button", { name: /today/i });
    expect(todayButton).toBeInTheDocument();

    const yearButtons = screen.getAllByRole("button", { name: /2026/i });
    expect(yearButtons.length).toBeGreaterThan(0);

    const currentDayButton = screen.getByRole("button", { name: /Mar 10, 2026/i });
    expect(currentDayButton).toBeInTheDocument();
  });

  test("renders planner preset list in planner view", async () => {
    function PlannerHarness() {
      const initial = createInitialState("2026-03-10");
      initial.uiState.lastView = "planner";
      const presetId = initial.uiState.selectedPlannerPresetId!;
      initial.plannerPresets[presetId].name = "Balanced Week";

      const [state, dispatch] = useReducer(appReducer, initial);
      return <Sidebar state={state} dispatch={dispatch} />;
    }

    render(<PlannerHarness />);

    expect(screen.getByText("Planner Presets")).toBeInTheDocument();
    expect(screen.getByText("Balanced Week")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New preset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Balanced Week" })).toBeInTheDocument();
  });

  test("does not render when sidebar is collapsed", () => {
    function CollapsedHarness() {
      const initial = createInitialState("2026-03-10");
      initial.uiState.isSidebarCollapsed = true;

      const [state, dispatch] = useReducer(appReducer, initial);
      return <Sidebar state={state} dispatch={dispatch} />;
    }

    const { container } = render(<CollapsedHarness />);
    expect(container).toBeEmptyDOMElement();
  });
});
