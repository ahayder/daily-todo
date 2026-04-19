"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { useAppState } from "@/components/app-context";
import {
  ContentPlannerView,
  type ContentPlannerControls,
  type ContentPlannerDemoState,
  type ContentPlannerDensity,
  type ContentPlannerLayout,
  type ContentPlannerViewMode,
} from "@/components/content-planner-view";
import { NotesView } from "@/components/notes-view";
import { PlannerView } from "@/components/planner-view";
import { Sidebar } from "@/components/sidebar";
import { TodosView } from "@/components/todos-view";
import { TopNavbar } from "@/components/top-navbar";
import { CONTENT_FONT_SCALE_DEFAULT } from "@/lib/content-font-scale";
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
  const [contentPlannerLayout, setContentPlannerLayout] = useState<ContentPlannerLayout>("split");
  const [contentPlannerDensity, setContentPlannerDensity] =
    useState<ContentPlannerDensity>("comfortable");
  const [contentPlannerViewMode, setContentPlannerViewMode] =
    useState<ContentPlannerViewMode>("list");
  const [contentPlannerDemoState, setContentPlannerDemoState] =
    useState<ContentPlannerDemoState>("populated");
  const [contentPlannerShowLlmPanel, setContentPlannerShowLlmPanel] = useState(true);
  const [contentPlannerStatusFilter, setContentPlannerStatusFilter] = useState("all");
  const [contentPlannerPillarFilter, setContentPlannerPillarFilter] = useState("all");
  const [contentPlannerChannelFilter, setContentPlannerChannelFilter] = useState("all");
  const [contentPlannerTagFilter, setContentPlannerTagFilter] = useState("all");
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
  const contentPlannerControls: ContentPlannerControls = {
    layout: contentPlannerLayout,
    setLayout: setContentPlannerLayout,
    density: contentPlannerDensity,
    setDensity: setContentPlannerDensity,
    viewMode: contentPlannerViewMode,
    setViewMode: setContentPlannerViewMode,
    demoState: contentPlannerDemoState,
    setDemoState: setContentPlannerDemoState,
    showLlmPanel: contentPlannerShowLlmPanel,
    setShowLlmPanel: setContentPlannerShowLlmPanel,
    statusFilter: contentPlannerStatusFilter,
    setStatusFilter: setContentPlannerStatusFilter,
    pillarFilter: contentPlannerPillarFilter,
    setPillarFilter: setContentPlannerPillarFilter,
    channelFilter: contentPlannerChannelFilter,
    setChannelFilter: setContentPlannerChannelFilter,
    tagFilter: contentPlannerTagFilter,
    setTagFilter: setContentPlannerTagFilter,
  };

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
            <ContentPlannerView controls={contentPlannerControls} />
          ) : (
            <NotesView state={state} dispatch={dispatch} notes={notes} />
          )}
        </main>
      </div>
    </div>
  );
}
