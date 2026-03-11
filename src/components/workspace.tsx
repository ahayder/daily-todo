"use client";

import { useEffect } from "react";
import { DailyView } from "@/components/daily-view";
import { NotesView } from "@/components/notes-view";
import { Sidebar } from "@/components/sidebar";
import { useAppState } from "@/components/app-context";
import type { ViewMode } from "@/lib/types";

type Props = {
  forcedView?: ViewMode;
};

export function Workspace({ forcedView }: Props) {
  const { state, dispatch } = useAppState();
  const activeView = forcedView ?? state.uiState.lastView;

  useEffect(() => {
    if (forcedView && forcedView !== state.uiState.lastView) {
      dispatch({ type: "set-view", view: forcedView });
    }
  }, [dispatch, forcedView, state.uiState.lastView]);

  return (
    <div className="app-shell">
      <Sidebar state={{ ...state, uiState: { ...state.uiState, lastView: activeView } }} dispatch={dispatch} />
      <main className="main-panel">
        {activeView === "daily" ? (
          <DailyView state={state} dispatch={dispatch} />
        ) : (
          <NotesView state={state} dispatch={dispatch} />
        )}
      </main>
    </div>
  );
}
