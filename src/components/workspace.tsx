"use client";

import { useEffect } from "react";
import { DailyView } from "@/components/daily-view";
import { NotesView } from "@/components/notes-view";
import { PlannerView } from "@/components/planner-view";
import { Sidebar } from "@/components/sidebar";
import { TopNavbar } from "@/components/top-navbar";
import { useAppState } from "@/components/app-context";
import type { ViewMode } from "@/lib/types";

type Props = {
  forcedView?: ViewMode;
};

export function Workspace({ forcedView }: Props) {
  const { state, dispatch, sync, retrySync } = useAppState();
  const activeView = forcedView ?? state.uiState.lastView;

  useEffect(() => {
    if (forcedView && forcedView !== state.uiState.lastView) {
      dispatch({ type: "set-view", view: forcedView });
    }
  }, [dispatch, forcedView, state.uiState.lastView]);

  return (
    <div className="app-shell">
      <TopNavbar
        state={{ ...state, uiState: { ...state.uiState, lastView: activeView } }}
        dispatch={dispatch}
        sync={sync}
        retrySync={retrySync}
      />
      <div
        className={state.uiState.isSidebarCollapsed ? "app-body app-body--sidebar-collapsed" : "app-body"}
      >
        {!state.uiState.isFocusMode && (
          <Sidebar
            state={{ ...state, uiState: { ...state.uiState, lastView: activeView } }}
            dispatch={dispatch}
          />
        )}
        <main className="main-panel">
          {activeView === "daily" ? (
            <DailyView state={state} dispatch={dispatch} />
          ) : activeView === "planner" ? (
            <PlannerView state={state} dispatch={dispatch} />
          ) : (
            <NotesView state={state} dispatch={dispatch} />
          )}
        </main>
      </div>
    </div>
  );
}
