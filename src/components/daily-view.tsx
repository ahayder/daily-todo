"use client";

import { useMemo, useState, type Dispatch } from "react";
import { getDayLabel } from "@/lib/date";
import { groupTodosByPriority } from "@/lib/store";
import { MarkdownEditor } from "@/components/markdown-editor";
import { DrawingOverlay } from "@/components/drawing-overlay";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { AppState, Priority } from "@/lib/types";
import type { AppAction } from "@/components/app-context";
import { CalendarDays, GripVertical, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

const PRIORITY_META: Record<
  Priority,
  {
    label: string;
    accentVar: string;
    softVar: string;
    placeholder: string;
  }
> = {
  1: {
    label: "Critical",
    accentVar: "--priority-1",
    softVar: "--priority-1-soft",
    placeholder: "Add a critical task…",
  },
  2: {
    label: "Important",
    accentVar: "--priority-2",
    softVar: "--priority-2-soft",
    placeholder: "Add an important task…",
  },
  3: {
    label: "Someday",
    accentVar: "--priority-3",
    softVar: "--priority-3-soft",
    placeholder: "Add a task for later…",
  },
};

function InlineTaskInput({
  date,
  priority,
  meta,
  dispatch,
}: {
  date: string;
  priority: Priority;
  meta: (typeof PRIORITY_META)[Priority];
  dispatch: Dispatch<AppAction>;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSubmit = () => {
    if (text.trim()) {
      dispatch({ type: "add-todo", date, text: text.trim(), priority });
      setText("");
    }
  };

  return (
    <div
      className={cn(
        "inline-task-input",
        focused && "inline-task-input--focused"
      )}
    >
      <Plus
        className="h-3.5 w-3.5 flex-shrink-0"
        style={{ color: `var(${meta.accentVar})`, opacity: focused ? 1 : 0.4 }}
      />
      <input
        type="text"
        className="inline-task-field"
        placeholder={meta.placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
    </div>
  );
}

export function DailyView({ state, dispatch }: Props) {
  const date = state.uiState.selectedDailyDate;
  const page = date ? state.dailyPages[date] : null;

  const grouped = useMemo(
    () => groupTodosByPriority(page?.todos ?? []),
    [page?.todos]
  );

  if (!page || !date) {
    return (
      <section className="empty-view-container">
        <div className="empty-view">
          <CalendarDays className="h-8 w-8 text-[var(--ink-700)] opacity-30 mb-3" />
          <p className="text-sm text-[var(--ink-700)]">Select a date to get started</p>
        </div>
      </section>
    );
  }

  return (
    <section className="daily-layout">
      {/* Note Pane */}
      <div className="note-pane">
        <div className="note-header">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 text-[var(--brand)]" />
            <h2 className="text-lg font-semibold text-[var(--ink-900)] tracking-tight">
              {getDayLabel(date)}
            </h2>
          </div>
        </div>
        <div className="editor-layer">
          <MarkdownEditor
            value={page.markdown}
            onChange={(markdown) =>
              dispatch({ type: "update-daily-markdown", date, markdown })
            }
          />
          <DrawingOverlay
            strokes={page.drawingStrokes}
            onChange={(drawingStrokes) =>
              dispatch({ type: "set-daily-drawing", date, drawingStrokes })
            }
          />
        </div>
      </div>

      {/* Todo Pane */}
      <div className="todo-pane">
        <div className="priority-groups">
          {([1, 2, 3] as const).map((priorityLevel) => {
            const todos = grouped[priorityLevel];
            const meta = PRIORITY_META[priorityLevel];

            return (
              <div key={priorityLevel} className="priority-group">
                {/* Group header */}
                <div
                  className="priority-group-header"
                  style={{
                    borderLeftColor: `var(${meta.accentVar})`,
                    backgroundColor: `var(${meta.softVar})`,
                  }}
                >
                  <h3 className="text-[13px] font-semibold text-[var(--ink-900)]">
                    {meta.label}
                  </h3>
                  {todos.length > 0 && (
                    <Badge
                      className="priority-count-badge"
                      style={{
                        backgroundColor: `var(${meta.softVar})`,
                        color: `var(${meta.accentVar})`,
                        borderColor: `color-mix(in srgb, var(${meta.accentVar}) 30%, transparent)`,
                      }}
                    >
                      {todos.length}
                    </Badge>
                  )}
                </div>

                {/* Task items */}
                <ul className="task-list">
                  {todos.map((todo) => (
                    <li key={todo.id} className="task-item group">
                      <Checkbox
                        checked={todo.done}
                        onCheckedChange={() =>
                          dispatch({
                            type: "toggle-todo",
                            date,
                            todoId: todo.id,
                          })
                        }
                        className="task-checkbox"
                      />
                      <span
                        className={cn(
                          "task-text",
                          todo.done && "task-text--done"
                        )}
                      >
                        {todo.text}
                      </span>
                      <GripVertical className="h-3.5 w-3.5 text-[var(--ink-700)] opacity-0 group-hover:opacity-30 cursor-grab flex-shrink-0 transition-opacity duration-150" />
                      <button
                        type="button"
                        className="task-delete-btn"
                        onClick={() =>
                          dispatch({
                            type: "delete-todo",
                            date,
                            todoId: todo.id,
                          })
                        }
                        aria-label="Delete task"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}

                  {todos.length === 0 && (
                    <li className="task-empty">No tasks yet</li>
                  )}
                </ul>

                {/* Inline add task */}
                <InlineTaskInput
                  date={date}
                  priority={priorityLevel}
                  meta={meta}
                  dispatch={dispatch}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
