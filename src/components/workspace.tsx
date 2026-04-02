"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { TodosView } from "@/components/todos-view";
import { NotesView } from "@/components/notes-view";
import { PlannerView } from "@/components/planner-view";
import { Sidebar } from "@/components/sidebar";
import { TopNavbar } from "@/components/top-navbar";
import { useAppState } from "@/components/app-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ViewMode } from "@/lib/types";

type Props = {
  forcedView?: ViewMode;
};

export function Workspace({ forcedView }: Props) {
  const { state, dispatch, notes, sync, retrySync } = useAppState();
  const activeView = forcedView ?? state.uiState.lastView;
  const isFocusMode = state.uiState.isFocusMode;

  useEffect(() => {
    if (forcedView && forcedView !== state.uiState.lastView) {
      dispatch({ type: "set-view", view: forcedView });
    }
  }, [dispatch, forcedView, state.uiState.lastView]);

  return (
    <div className="app-shell">
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
          />
        )}
        <main className="main-panel">
          {activeView === "todos" ? (
            <TodosView state={state} dispatch={dispatch} />
          ) : activeView === "planner" ? (
            <PlannerView state={state} dispatch={dispatch} />
          ) : (
            <NotesView state={state} dispatch={dispatch} notes={notes} />
          )}
        </main>
      </div>
    </div>
  );
}
