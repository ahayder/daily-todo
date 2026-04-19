import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ContentPlannerView, type ContentPlannerControls } from "@/components/content-planner-view";

function createControls(
  overrides: Partial<
    Pick<
      ContentPlannerControls,
      | "layout"
      | "density"
      | "viewMode"
      | "demoState"
      | "showLlmPanel"
      | "statusFilter"
      | "pillarFilter"
      | "channelFilter"
      | "tagFilter"
    >
  > = {},
): ContentPlannerControls {
  return {
    layout: "split",
    setLayout: vi.fn(),
    density: "comfortable",
    setDensity: vi.fn(),
    viewMode: "list",
    setViewMode: vi.fn(),
    demoState: "populated",
    setDemoState: vi.fn(),
    showLlmPanel: true,
    setShowLlmPanel: vi.fn(),
    statusFilter: "all",
    setStatusFilter: vi.fn(),
    pillarFilter: "all",
    setPillarFilter: vi.fn(),
    channelFilter: "all",
    setChannelFilter: vi.fn(),
    tagFilter: "all",
    setTagFilter: vi.fn(),
    ...overrides,
  };
}

describe("ContentPlannerView", () => {
  test("renders the populated planner workspace by default", () => {
    render(<ContentPlannerView />);

    expect(screen.getByRole("heading", { name: "Content Planner" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: 'Why "shipping ugly" beats polishing for the first 90 days.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("content-planner-detail-pane")).toBeInTheDocument();
    expect(screen.getByText("Hook variations")).toBeInTheDocument();
  });

  test("switches the center workspace into kanban mode", async () => {
    render(<ContentPlannerView controls={createControls({ layout: "kanban" })} />);

    expect(screen.getByTestId("content-planner-kanban")).toBeInTheDocument();
    expect(screen.queryByTestId("content-planner-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("content-planner-detail-pane")).not.toBeInTheDocument();
  });

  test("shows the grid placeholder when grid view is selected", async () => {
    const user = userEvent.setup();

    render(<ContentPlannerView />);

    await user.click(screen.getAllByRole("button", { name: "Grid" })[0]);

    expect(screen.getByTestId("content-planner-grid-placeholder")).toBeInTheDocument();
  });

  test("updates the detail pane when a different idea is selected", async () => {
    const user = userEvent.setup();

    render(<ContentPlannerView />);

    await user.click(screen.getByRole("button", { name: /I replaced my project manager/i }));

    expect(
      screen.getByRole("heading", {
        name: "I replaced my project manager with 4 prompts and a checklist.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("workflow experiment → 2026-04-02")).toBeInTheDocument();
  });

  test("toggles the empty state and hides the detail pane", async () => {
    render(<ContentPlannerView controls={createControls({ demoState: "empty" })} />);

    expect(screen.getByTestId("content-planner-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("content-planner-detail-pane")).not.toBeInTheDocument();
  });

  test("applies compact density and keeps controls accessible", () => {
    const { container } = render(
      <ContentPlannerView controls={createControls({ density: "compact" })} />,
    );

    expect(container.firstChild).toHaveClass("content-planner--compact");
    expect(screen.getByRole("button", { name: "Bulk select" })).toBeInTheDocument();
  });
});
