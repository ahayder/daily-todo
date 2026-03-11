"use client";

import Link from "next/link";
import { getDayLabel, getMonthLabel, getYearMonth } from "@/lib/date";
import { getSortedDailyDates } from "@/lib/store";
import type { AppState } from "@/lib/types";
import type { AppAction } from "@/components/app-context";
import type { Dispatch } from "react";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

export function Sidebar({ state, dispatch }: Props) {
  const sortedDates = getSortedDailyDates(state);
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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>DailyTodoApp</h1>
      </div>

      <div className="sidebar-nav">
        <Link
          href="/daily"
          className={state.uiState.lastView === "daily" ? "is-active" : ""}
          onClick={() => dispatch({ type: "set-view", view: "daily" })}
        >
          DailyTodo
        </Link>
        <Link
          href="/notes"
          className={state.uiState.lastView === "notes" ? "is-active" : ""}
          onClick={() => dispatch({ type: "set-view", view: "notes" })}
        >
          Notes
        </Link>
      </div>

      {state.uiState.lastView === "daily" ? (
        <div className="sidebar-tree">
          {Array.from(groupedYears.keys())
            .sort((a, b) => b.localeCompare(a))
            .map((year) => {
              const yearExpanded = state.uiState.expandedYears.includes(year);
              const months = groupedYears.get(year);
              return (
                <div key={year} className="tree-year">
                  <button
                    type="button"
                    className="tree-toggle"
                    onClick={() => dispatch({ type: "toggle-year", year })}
                  >
                    <span>{yearExpanded ? "▾" : "▸"}</span>
                    <span>{year}</span>
                  </button>

                  {yearExpanded && months
                    ? Array.from(months.keys())
                        .sort((a, b) => b.localeCompare(a))
                        .map((month) => {
                          const monthExpanded = state.uiState.expandedMonths.includes(month);
                          return (
                            <div key={month} className="tree-month">
                              <button
                                type="button"
                                className="tree-toggle"
                                onClick={() => dispatch({ type: "toggle-month", month })}
                              >
                                <span>{monthExpanded ? "▾" : "▸"}</span>
                                <span>{getMonthLabel(month)}</span>
                              </button>
                              {monthExpanded ? (
                                <ul>
                                  {months.get(month)?.map((date) => (
                                    <li key={date}>
                                      <button
                                        type="button"
                                        className={
                                          state.uiState.selectedDailyDate === date
                                            ? "day-button is-active"
                                            : "day-button"
                                        }
                                        onClick={() => dispatch({ type: "select-daily", date })}
                                      >
                                        {getDayLabel(date)}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          );
                        })
                    : null}
                </div>
              );
            })}
        </div>
      ) : (
        <div className="notes-list">
          <button type="button" onClick={() => dispatch({ type: "create-note" })}>
            + New Note
          </button>
          <ul>
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className={state.uiState.selectedNoteId === note.id ? "is-active" : ""}
                  onClick={() => dispatch({ type: "select-note", noteId: note.id })}
                >
                  {note.title || "Untitled Note"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
