"use client";

import { toISODate } from "@/lib/date";
import { getDayLabel, getMonthLabel, getYearMonth } from "@/lib/date";
import { getSortedDailyDates } from "@/lib/store";
import type { AppState } from "@/lib/types";
import type { AppAction } from "@/components/app-context";
import { useState, useEffect, type Dispatch } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CalendarDays, FileText, Plus, ChevronRight } from "lucide-react";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

export function Sidebar({ state, dispatch }: Props) {
  const sortedDates = getSortedDailyDates(state);
  const [mounted, setMounted] = useState(false);
  const todayISO = mounted ? toISODate(new Date()) : "";

  useEffect(() => {
    setMounted(true);
  }, []);

  const groupedYears = new Map<string, Map<string, string[]>>();

  for (const date of sortedDates) {
    const year = date.slice(0, 4);
    const month = getYearMonth(date);
    if (!groupedYears.has(year)) {
      groupedYears.set(year, new Map<string, string[]>());
    }
    const months = groupedYears.get(year);
    if (!months) continue;
    if (!months.has(month)) {
      months.set(month, []);
    }
    months.get(month)?.push(date);
  }

  const notes = Object.values(state.notesDocs).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  const isDailyView = !mounted || state.uiState.lastView === "daily";

  return (
    <aside className="sidebar">
      {/* Today quick-nav (daily view only) */}
      {isDailyView && mounted && (
        <button
          type="button"
          onClick={() => {
            if (todayISO) dispatch({ type: "select-daily", date: todayISO });
          }}
          className="today-btn"
        >
          <CalendarDays className="h-4 w-4" />
          <span>Today</span>
        </button>
      )}

      {/* Notes header (notes view only) */}
      {!isDailyView && mounted && (
        <div className="sidebar-section-header">
          <span className="sidebar-section-label">
            <FileText className="h-3.5 w-3.5" />
            Notes
          </span>
          <button
            type="button"
            className="sidebar-add-btn"
            onClick={() => dispatch({ type: "create-note" })}
            aria-label="New note"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <ScrollArea className="flex-1 min-h-0">
        {!mounted ? null : isDailyView ? (
          <div className="sidebar-tree">
            {Array.from(groupedYears.keys())
              .sort((a, b) => b.localeCompare(a))
              .map((year) => {
                const yearExpanded = state.uiState.expandedYears.includes(year);
                const months = groupedYears.get(year);
                return (
                  <div key={year} className="tree-group">
                    <button
                      type="button"
                      className="tree-toggle"
                      onClick={() => dispatch({ type: "toggle-year", year })}
                    >
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 tree-chevron",
                          yearExpanded && "tree-chevron--open"
                        )}
                      />
                      <span>{year}</span>
                    </button>

                    {yearExpanded && months && (
                      <div className="tree-children">
                        {Array.from(months.keys())
                          .sort((a, b) => b.localeCompare(a))
                          .map((month) => {
                            const monthExpanded = state.uiState.expandedMonths.includes(month);
                            return (
                              <div key={month} className="tree-group">
                                <button
                                  type="button"
                                  className="tree-toggle"
                                  onClick={() => dispatch({ type: "toggle-month", month })}
                                >
                                  <ChevronRight
                                    className={cn(
                                      "h-3.5 w-3.5 tree-chevron",
                                      monthExpanded && "tree-chevron--open"
                                    )}
                                  />
                                  <span>{getMonthLabel(month)}</span>
                                </button>
                                {monthExpanded && (
                                  <div className="tree-children">
                                    {(months.get(month) || [])
                                      .sort((a, b) => b.localeCompare(a))
                                      .map((date) => (
                                        <button
                                          key={date}
                                          type="button"
                                          className={cn(
                                            "tree-leaf",
                                            state.uiState.selectedDailyDate === date && "tree-leaf--active"
                                          )}
                                          onClick={() => dispatch({ type: "select-daily", date })}
                                        >
                                          {getDayLabel(date)}
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="notes-list">
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                className={cn(
                  "note-item",
                  state.uiState.selectedNoteId === note.id && "note-item--active"
                )}
                onClick={() => dispatch({ type: "select-note", noteId: note.id })}
              >
                <span className="note-item-title">{note.title || "Untitled Note"}</span>
                <span className="note-item-date">
                  {new Date(note.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
