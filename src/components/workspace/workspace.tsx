"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";

import { useAppState } from "@/components/app/app-context";
import { ChangeRequestDialog } from "@/components/change-requests/change-request-dialog";
import { ContentPlannerView } from "@/components/content-planner-view";
import { NotesView } from "@/components/notes/notes-view";
import { PlannerView } from "@/components/planner/planner-view";
import { MemoryView } from "@/components/memory/memory-view";
import { ProjectView } from "@/components/memory/project-view";
import { StandupView } from "@/components/memory/standup-view";
import { HistoryView } from "@/components/today/history-view";
import { PingScheduler } from "@/components/today/ping-scheduler";
import { TodayView } from "@/components/today/today-view";
import { TodosView } from "@/components/todos/todos-view";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/workspace/sidebar";
import { TopNavbar } from "@/components/workspace/top-navbar";
import { CONTENT_FONT_SCALE_DEFAULT } from "@/lib/content-font-scale";
import type { ViewMode } from "@/lib/types";

type Props = {
  forcedView?: ViewMode;
};

export function Workspace({ forcedView }: Props) {
  const { state, dispatch, notes, sync, retrySync } = useAppState();
  const activeView = forcedView ?? state.uiState.lastView;
  const isFocusMode = state.uiState.isFocusMode;
  const isContentPlanner = activeView === "content-planner";
  const isPlanner = activeView === "planner";
  // Today and History are full-width pages without the Todos/Notes sidebar.
  const isFullWidth =
    isContentPlanner || isPlanner || ["today", "history", "memory", "project", "standup"].includes(activeView);
  const contentFontScale = state.uiState.contentFontScale ?? CONTENT_FONT_SCALE_DEFAULT;
  const previousViewRef = useRef<ViewMode | null>(null);
  const [isChangeRequestsOpen, setIsChangeRequestsOpen] = useState(false);
  // What the user was working in, so closing the note dialog puts them back.
  const changeRequestsReturnFocusRef = useRef<HTMLElement | null>(null);
  const openChangeRequests = () => {
    changeRequestsReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsChangeRequestsOpen(true);
  };
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

  useEffect(() => {
    if (forcedView && forcedView !== state.uiState.lastView) {
      dispatch({ type: "set-view", view: forcedView });
    }
  }, [dispatch, forcedView, state.uiState.lastView]);

  useEffect(() => {
    if (activeView === "planner" && previousViewRef.current !== "planner") {
      dispatch({ type: "set-sidebar-collapsed", isCollapsed: true });
    }
    previousViewRef.current = activeView;
  }, [activeView, dispatch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }

      // Cmd/Ctrl+Shift+I: change request, from anywhere (also in focus mode).
      if (event.shiftKey && event.key.toLowerCase() === "i") {
        event.preventDefault();
        openChangeRequests();
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

  const workspaceState = {
    ...state,
    uiState: {
      ...state.uiState,
      lastView: activeView,
    },
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
            <TooltipContent side="left" className="text-[0.8125rem]">
              Close Focus Mode
            </TooltipContent>
          </Tooltip>
        </div>
      ) : null}

      {!isFocusMode ? (
        <TopNavbar
          state={workspaceState}
          dispatch={dispatch}
          sync={sync}
          retrySync={retrySync}
          onOpenChangeRequests={openChangeRequests}
        />
      ) : null}

      <PingScheduler />

      <ChangeRequestDialog
        open={isChangeRequestsOpen}
        onOpenChange={setIsChangeRequestsOpen}
        notes={state.changeRequests}
        dispatch={dispatch}
        screen={activeView}
        isReadOnly={sync.isReadOnly}
        returnFocusRef={changeRequestsReturnFocusRef}
      />

      <div
        className={
          state.uiState.isSidebarCollapsed || isFullWidth
            ? "app-body app-body--sidebar-collapsed"
            : "app-body"
        }
        data-content-planner-full-width={isContentPlanner ? "true" : undefined}
      >
        {!isFocusMode && !isFullWidth ? (
          <Sidebar
            state={workspaceState}
            dispatch={dispatch}
            sync={sync}
            retrySync={retrySync}
          />
        ) : null}

        <main className="main-panel">
          {activeView === "today" ? (
            <TodayView />
          ) : activeView === "history" ? (
            <HistoryView />
          ) : activeView === "memory" ? (
            <MemoryView />
          ) : activeView === "project" ? (
            <ProjectView />
          ) : activeView === "standup" ? (
            <StandupView />
          ) : activeView === "todos" ? (
            <TodosView state={state} dispatch={dispatch} />
          ) : activeView === "planner" ? (
            <PlannerView state={state} dispatch={dispatch} fontScale={contentFontScale} />
          ) : isContentPlanner ? (
            <ContentPlannerView
              board={state.contentBoard}
              cards={state.contentCards}
              fontScale={contentFontScale}
              onDecreaseFontScale={() =>
                dispatch({ type: "decrease-content-font-scale" })
              }
              onIncreaseFontScale={() =>
                dispatch({ type: "increase-content-font-scale" })
              }
              onAddCard={(columnId, title, cardNotes, options) =>
                dispatch({
                  type: "create-content-card",
                  columnId,
                  title,
                  notes: cardNotes,
                  atTop: options?.atTop,
                  seriesId: options?.seriesId,
                })
              }
              onUpdateCard={(cardId, title, cardNotes) =>
                dispatch({
                  type: "update-content-card",
                  cardId,
                  title,
                  notes: cardNotes,
                })
              }
              onUpdatePublishInfo={(cardId, links, transcript) =>
                dispatch({ type: "update-content-card-publish-info", cardId, links, transcript })
              }
              onMoveCard={(cardId, targetColumnId, targetIndex) =>
                dispatch({
                  type: "move-content-card",
                  cardId,
                  targetColumnId,
                  targetIndex,
                })
              }
              onDeleteCard={(cardId) => dispatch({ type: "delete-content-card", cardId })}
              onRestoreCard={(card, index) =>
                dispatch({ type: "restore-content-card", card, index })
              }
              onCreateSeries={(seriesId, title, cardId) =>
                dispatch({ type: "create-content-series", seriesId, title, cardId })
              }
              onUpdateSeries={(seriesId, title, about) =>
                dispatch({ type: "update-content-series", seriesId, title, about })
              }
              onDeleteSeries={(seriesId) => dispatch({ type: "delete-content-series", seriesId })}
              onSetCardSeries={(cardId, seriesId) =>
                dispatch({ type: "set-content-card-series", cardId, seriesId })
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
