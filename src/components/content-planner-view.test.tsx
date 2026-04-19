import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  ContentPlannerSidebarPanels,
  ContentPlannerView,
  type ContentPlannerControls,
} from "@/components/content-planner-view";
import {
  createContentIdea,
  createContentIdeaHookVariant,
  createContentIdeaScriptStep,
} from "@/lib/store";
import type { ContentIdea } from "@/lib/types";

function createIdeas(): ContentIdea[] {
  const firstHook = createContentIdeaHookVariant('Why "shipping ugly" beats polishing.');
  const secondHook = createContentIdeaHookVariant(
    "I replaced my project manager with 4 prompts and a checklist.",
  );

  return [
    createContentIdea({
      hook: 'Why "shipping ugly" beats polishing for the first 90 days.',
      premise: "Three concrete examples from founders who launched rough and learned faster.",
      status: "inbox",
      pillar: "Teach",
      channels: ["YouTube long", "LinkedIn excerpt"],
      tags: ["launch", "mindset"],
      score: 8.4,
      scoreBreakdown: {
        hook: 9,
        proof: 7,
        fit: 9,
      },
      sourceLabel: "inbox reply → 2026-04-14",
      sourceType: "ai",
      hooks: [firstHook],
      activeHookId: firstHook.id,
      scriptSteps: [
        createContentIdeaScriptStep({
          label: "Hook",
          body: "Cold open on the ugly screenshot.",
          actionLabel: "rewrite",
        }),
      ],
    }),
    createContentIdea({
      hook: "I replaced my project manager with 4 prompts and a checklist.",
      premise: "Full script done. Needs thumbnail variants and a proof screenshot.",
      status: "scripted",
      pillar: "Teach",
      channels: ["YouTube long"],
      tags: ["prompts", "systems"],
      score: 9.1,
      scoreBreakdown: {
        hook: 9,
        proof: 8,
        fit: 10,
      },
      sourceLabel: "workflow experiment → 2026-04-02",
      sourceType: "human",
      hooks: [secondHook],
      activeHookId: secondHook.id,
      scriptSteps: [
        createContentIdeaScriptStep({
          label: "Intro",
          body: "Open with the stack diagram, then peel it back.",
          actionLabel: "rewrite",
        }),
      ],
    }),
  ];
}

function createControls(
  overrides: Partial<ContentPlannerControls> = {},
): ContentPlannerControls {
  return {
    layout: "split",
    setLayout: vi.fn(),
    density: "comfortable",
    setDensity: vi.fn(),
    viewMode: "list",
    setViewMode: vi.fn(),
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
    searchQuery: "",
    setSearchQuery: vi.fn(),
    ...overrides,
  };
}

describe("ContentPlannerView", () => {
  test("renders empty state when no ideas exist", () => {
    render(
      <ContentPlannerView
        ideas={[]}
        controls={createControls()}
        selectedIdeaId={null}
      />,
    );

    expect(screen.getByTestId("content-planner-empty-state")).toBeInTheDocument();
    expect(screen.queryByTestId("content-planner-detail-pane")).not.toBeInTheDocument();
  });

  test("renders the planner workspace with real idea data", () => {
    const ideas = createIdeas();

    render(
      <ContentPlannerView
        ideas={ideas}
        controls={createControls()}
        selectedIdeaId={ideas[0].id}
      />,
    );

    expect(screen.getByRole("heading", { name: "Content Planner" })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Why "shipping ugly" beats polishing for the first 90 days.')).toBeInTheDocument();
    expect(screen.getByText("Hook variations")).toBeInTheDocument();
    expect(screen.getByTestId("content-planner-detail-pane")).toBeInTheDocument();
    expect(screen.queryByLabelText("Include current note context")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find related in my notes" })).not.toBeInTheDocument();
  });

  test("switches the center workspace into kanban mode", () => {
    render(
      <ContentPlannerView
        ideas={createIdeas()}
        controls={createControls({ layout: "kanban" })}
        selectedIdeaId={null}
      />,
    );

    expect(screen.getByTestId("content-planner-kanban")).toBeInTheDocument();
    expect(screen.queryByTestId("content-planner-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("content-planner-detail-pane")).not.toBeInTheDocument();
  });

  test("shows real grid cards when grid view is selected", () => {
    const ideas = createIdeas();

    render(
      <ContentPlannerView
        ideas={ideas}
        controls={createControls({ viewMode: "grid" })}
        selectedIdeaId={ideas[0].id}
      />,
    );

    expect(screen.getByTestId("content-planner-grid")).toBeInTheDocument();
    expect(screen.getAllByText(/YouTube long/i).length).toBeGreaterThan(0);
  });

  test("selects a different idea from the list", async () => {
    const user = userEvent.setup();
    const ideas = createIdeas();
    const onSelectIdea = vi.fn();

    render(
      <ContentPlannerView
        ideas={ideas}
        controls={createControls()}
        selectedIdeaId={ideas[0].id}
        onSelectIdea={onSelectIdea}
      />,
    );

    await user.click(screen.getByRole("button", { name: /I replaced my project manager/i }));

    expect(onSelectIdea).toHaveBeenCalledWith(ideas[1].id);
  });

  test("filters visible ideas by search query", () => {
    const ideas = createIdeas();

    render(
      <ContentPlannerView
        ideas={ideas}
        controls={createControls({ searchQuery: "project manager" })}
        selectedIdeaId={ideas[1].id}
      />,
    );

    expect(screen.getByDisplayValue("I replaced my project manager with 4 prompts and a checklist.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /shipping ugly/i })).not.toBeInTheDocument();
  });

  test("keeps compact density and hides bulk select until implemented", () => {
    const { container } = render(
      <ContentPlannerView
        ideas={createIdeas()}
        controls={createControls({ density: "compact" })}
        selectedIdeaId={null}
      />,
    );

    expect(container.firstChild).toHaveClass("content-planner--compact");
    expect(screen.queryByRole("button", { name: "Bulk select" })).not.toBeInTheDocument();
  });

  test("generates ideas with prompt-only input", async () => {
    const user = userEvent.setup();
    const onGenerateIdeas = vi.fn();

    render(
      <ContentPlannerView
        ideas={createIdeas()}
        controls={createControls()}
        selectedIdeaId={null}
        onGenerateIdeas={onGenerateIdeas}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Generate →" }));

    expect(onGenerateIdeas).toHaveBeenCalledWith(
      "Brainstorm 10 ideas about indie hackers shipping AI tools",
    );
  });
});

describe("ContentPlannerSidebarPanels", () => {
  test("renders filter sections from real ideas", () => {
    render(<ContentPlannerSidebarPanels controls={createControls()} ideas={createIdeas()} />);

    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Pillars")).toBeInTheDocument();
    expect(screen.getByText("Channel")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  test("shows saved pillar and platform filters even before ideas use them heavily", () => {
    render(
      <ContentPlannerSidebarPanels
        controls={createControls()}
        ideas={createIdeas()}
        savedPillars={["Teach", "Proof"]}
        savedPlatforms={["YouTube long", "Podcast"]}
      />,
    );

    expect(screen.getAllByRole("button", { name: /Proof/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Podcast/i }).length).toBeGreaterThan(0);
  });

  test("adds a saved platform from the detail panel token input", async () => {
    const user = userEvent.setup();
    const ideas = createIdeas();
    const onUpdateIdea = vi.fn();

    render(
      <ContentPlannerView
        ideas={ideas}
        selectedIdeaId={ideas[0].id}
        controls={createControls()}
        savedPillars={["Teach", "Proof"]}
        savedPlatforms={["YouTube long", "LinkedIn excerpt", "Podcast"]}
        onUpdateIdea={onUpdateIdea}
      />,
    );

    await user.click(screen.getByRole("button", { name: /\+ Podcast/i }));

    expect(onUpdateIdea).toHaveBeenCalledWith(
      ideas[0].id,
      expect.objectContaining({
        channels: ["YouTube long", "LinkedIn excerpt", "Podcast"],
      }),
    );
  });

  test("prevents removing an in-use saved option from the sidebar manager", () => {
    const onRemovePillarOption = vi.fn();

    render(
      <ContentPlannerSidebarPanels
        controls={createControls()}
        ideas={createIdeas()}
        savedPillars={["Teach", "Proof"]}
        onRemovePillarOption={onRemovePillarOption}
      />,
    );

    expect(screen.getByRole("button", { name: /Teach • in use/i })).toBeDisabled();
    expect(onRemovePillarOption).not.toHaveBeenCalled();
  });
});
