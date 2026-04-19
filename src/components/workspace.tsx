"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { useAppState } from "@/components/app-context";
import {
  ContentPlannerView,
  type ContentPlannerControls,
} from "@/components/content-planner-view";
import { NotesView } from "@/components/notes-view";
import { PlannerView } from "@/components/planner-view";
import { Sidebar } from "@/components/sidebar";
import { TodosView } from "@/components/todos-view";
import { TopNavbar } from "@/components/top-navbar";
import { CONTENT_FONT_SCALE_DEFAULT } from "@/lib/content-font-scale";
import {
  draftOutline,
  generateHookVariants,
  generateIdeasFromPrompt,
  repurposeIdea,
  suggestTags,
} from "@/lib/content-planner-ai";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ViewMode } from "@/lib/types";

type Props = {
  forcedView?: ViewMode;
};

export function Workspace({ forcedView }: Props) {
  const { state, dispatch, notes, sync, retrySync } = useAppState();
  const activeView = forcedView ?? state.uiState.lastView;
  const isFocusMode = state.uiState.isFocusMode;
  const contentFontScale = state.uiState.contentFontScale ?? CONTENT_FONT_SCALE_DEFAULT;
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [activeAiIdeaId, setActiveAiIdeaId] = useState<string | null>(null);
  const shellStyle = {
    "--content-font-scale": String(contentFontScale),
    "--content-font-size-editor": "calc(18px * var(--content-font-scale))",
    "--content-font-size-task": "calc(17px * var(--content-font-scale))",
    "--content-font-size-task-input": "calc(14.5px * var(--content-font-scale))",
    "--content-font-size-sidebar-tree": "calc(13px * var(--content-font-scale))",
    "--content-font-size-sidebar-folder": "calc(13px * var(--content-font-scale))",
    "--content-font-size-sidebar-note-title": "calc(12.5px * var(--content-font-scale))",
    "--content-font-size-sidebar-note-meta": "calc(10.5px * var(--content-font-scale))",
  } as CSSProperties;
  const updatePlannerUiField = <T,>(
    key: keyof typeof state.uiState.contentPlanner,
    nextValue: T | ((current: T) => T),
  ) => {
    const resolvedValue =
      typeof nextValue === "function"
        ? (nextValue as (current: T) => T)(state.uiState.contentPlanner[key] as T)
        : nextValue;

    dispatch({
      type: "update-content-planner-ui",
      updates: {
        [key]: resolvedValue,
      },
    });
  };
  const contentPlannerControls: ContentPlannerControls = {
    layout: state.uiState.contentPlanner.layout,
    setLayout: (value) => updatePlannerUiField("layout", value),
    density: state.uiState.contentPlanner.density,
    setDensity: (value) => updatePlannerUiField("density", value),
    viewMode: state.uiState.contentPlanner.viewMode,
    setViewMode: (value) => updatePlannerUiField("viewMode", value),
    showLlmPanel: state.uiState.contentPlanner.showLlmPanel,
    setShowLlmPanel: (value) => updatePlannerUiField("showLlmPanel", value),
    statusFilter: state.uiState.contentPlanner.statusFilter,
    setStatusFilter: (value) => updatePlannerUiField("statusFilter", value),
    pillarFilter: state.uiState.contentPlanner.pillarFilter,
    setPillarFilter: (value) => updatePlannerUiField("pillarFilter", value),
    channelFilter: state.uiState.contentPlanner.channelFilter,
    setChannelFilter: (value) => updatePlannerUiField("channelFilter", value),
    tagFilter: state.uiState.contentPlanner.tagFilter,
    setTagFilter: (value) => updatePlannerUiField("tagFilter", value),
    searchQuery: state.uiState.contentPlanner.searchQuery,
    setSearchQuery: (value) => updatePlannerUiField("searchQuery", value),
  };
  const plannerIdeas = Object.values(state.contentIdeas);

  useEffect(() => {
    if (forcedView && forcedView !== state.uiState.lastView) {
      dispatch({ type: "set-view", view: forcedView });
    }
  }, [dispatch, forcedView, state.uiState.lastView]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        dispatch({ type: "increase-content-font-scale" });
        return;
      }

      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        dispatch({ type: "decrease-content-font-scale" });
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        dispatch({ type: "reset-content-font-scale" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dispatch]);

  const handleGenerateIdeas = async (prompt: string) => {
    try {
      setIsGeneratingIdeas(true);
      const ideas = await generateIdeasFromPrompt({ prompt });
      dispatch({ type: "create-content-ideas", ideas });
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const handleRunAiAction = async (ideaId: string, action: string) => {
    const idea = state.contentIdeas[ideaId];
    if (!idea) return;

    try {
      setActiveAiIdeaId(ideaId);

      if (action === "generate-hooks") {
        const hooks = await generateHookVariants({ idea });
        dispatch({ type: "apply-content-idea-ai-result", ideaId, result: { hooks } });
        return;
      }

      if (action === "outline-script" || action === "Outline script") {
        const scriptSteps = await draftOutline({ idea });
        dispatch({ type: "apply-content-idea-ai-result", ideaId, result: { scriptSteps } });
        dispatch({ type: "set-content-idea-status", ideaId, status: "outlined" });
        return;
      }

      if (action === "Suggest tags") {
        const tags = await suggestTags({ idea });
        dispatch({ type: "apply-content-idea-ai-result", ideaId, result: { tags } });
        return;
      }

      if (action === "Repurpose for LinkedIn") {
        const repurposed = await repurposeIdea({ idea, channel: "LinkedIn" });
        dispatch({
          type: "update-content-idea",
          ideaId,
          updates: {
            premise: repurposed.premise,
            channels: repurposed.channels,
            score: repurposed.score,
          },
        });
        return;
      }

      if (action.startsWith("refine-step:")) {
        const stepId = action.replace("refine-step:", "");
        const step = idea.scriptSteps.find((candidate) => candidate.id === stepId);
        if (!step) return;
        dispatch({
          type: "update-content-idea-script-step",
          ideaId,
          stepId,
          updates: {
            body: `${step.body} Tighten the proof, then land the takeaway.`,
          },
        });
        return;
      }
    } finally {
      setActiveAiIdeaId(null);
    }
  };

  return (
    <div className="app-shell" style={shellStyle}>
      {isFocusMode ? (
        <div className="focus-mode-close">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => dispatch({ type: "set-focus-mode", isFocus: false })}
                aria-label="Close Focus Mode"
                className="focus-mode-close-btn"
              >
                <X className="h-6 w-6" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              Close Focus Mode
            </TooltipContent>
          </Tooltip>
        </div>
      ) : null}
      {!isFocusMode ? (
        <TopNavbar
          state={{ ...state, uiState: { ...state.uiState, lastView: activeView } }}
          dispatch={dispatch}
          sync={sync}
          retrySync={retrySync}
        />
      ) : null}
      <div
        className={state.uiState.isSidebarCollapsed ? "app-body app-body--sidebar-collapsed" : "app-body"}
      >
        {!isFocusMode && (
          <Sidebar
            state={{ ...state, uiState: { ...state.uiState, lastView: activeView } }}
            dispatch={dispatch}
            sync={sync}
            retrySync={retrySync}
            contentPlannerControls={contentPlannerControls}
          />
        )}
        <main className="main-panel">
          {activeView === "todos" ? (
            <TodosView state={state} dispatch={dispatch} />
          ) : activeView === "planner" ? (
            <PlannerView state={state} dispatch={dispatch} />
          ) : activeView === "content-planner" ? (
            <ContentPlannerView
              ideas={plannerIdeas}
              savedPillars={state.contentPlannerOptions.pillars}
              savedPlatforms={state.contentPlannerOptions.platforms}
              selectedIdeaId={state.uiState.selectedContentIdeaId}
              controls={contentPlannerControls}
              isGenerating={isGeneratingIdeas}
              activeAiIdeaId={activeAiIdeaId}
              onSelectIdea={(ideaId) => dispatch({ type: "select-content-idea", ideaId })}
              onGenerateIdeas={handleGenerateIdeas}
              onUpdateIdea={(ideaId, updates) =>
                dispatch({
                  type: "update-content-idea",
                  ideaId,
                  updates: {
                    hook: updates.hook,
                    premise: updates.premise,
                    pillar: updates.pillar,
                    channels: updates.channels,
                    score: updates.score,
                    scoreBreakdown: updates.scoreBreakdown,
                  },
                })
              }
              onSetIdeaStatus={(ideaId, status) =>
                dispatch({ type: "set-content-idea-status", ideaId, status })
              }
              onAddPillarOption={(value) =>
                dispatch({ type: "add-content-planner-pillar-option", value })
              }
              onRemovePillarOption={(value) =>
                dispatch({ type: "remove-content-planner-pillar-option", value })
              }
              onAddPlatformOption={(value) =>
                dispatch({ type: "add-content-planner-platform-option", value })
              }
              onRemovePlatformOption={(value) =>
                dispatch({ type: "remove-content-planner-platform-option", value })
              }
              onAddTag={(ideaId, tag) => dispatch({ type: "add-content-idea-tag", ideaId, tag })}
              onRemoveTag={(ideaId, tag) =>
                dispatch({ type: "remove-content-idea-tag", ideaId, tag })
              }
              onRunAiAction={handleRunAiAction}
              onSetActiveHook={(ideaId, hookId) =>
                dispatch({ type: "set-content-idea-active-hook", ideaId, hookId })
              }
              onRemoveHook={(ideaId, hookId) =>
                dispatch({ type: "remove-content-idea-hook", ideaId, hookId })
              }
              onAddScriptStep={(ideaId, step) =>
                dispatch({ type: "add-content-idea-script-step", ideaId, step })
              }
              onMoveScriptStep={(ideaId, stepId, targetIndex) =>
                dispatch({ type: "reorder-content-idea-script-step", ideaId, stepId, targetIndex })
              }
            />
          ) : (
            <NotesView state={state} dispatch={dispatch} notes={notes} />
          )}
        </main>
      </div>
    </div>
  );
}
