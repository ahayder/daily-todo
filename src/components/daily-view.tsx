"use client";

import { useMemo, useState, type Dispatch } from "react";
import { getDayLabel } from "@/lib/date";
import { groupTodosByPriority } from "@/lib/store";
import { MarkdownEditor } from "@/components/markdown-editor";
import { DrawingOverlay } from "@/components/drawing-overlay";
import { Badge } from "@/components/ui/badge";
import type { AppState, Priority } from "@/lib/types";
import type { AppAction } from "@/components/app-context";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

const PRIORITY_META: Record<
  Priority,
  {
    label: string;
    groupClassName: string;
    badgeClassName: string;
  }
> = {
  1: {
    label: "Critical",
    groupClassName: "priority-group priority-group-1",
    badgeClassName:
      "priority-count-badge border-[var(--priority-1)]/30 bg-[var(--priority-1-soft)] text-[var(--priority-1)]",
  },
  2: {
    label: "Important",
    groupClassName: "priority-group priority-group-2",
    badgeClassName:
      "priority-count-badge border-[var(--priority-2)]/30 bg-[var(--priority-2-soft)] text-[var(--priority-2)]",
  },
  3: {
    label: "Someday",
    groupClassName: "priority-group priority-group-3",
    badgeClassName:
      "priority-count-badge border-[var(--priority-3)]/30 bg-[var(--priority-3-soft)] text-[var(--priority-3)]",
  },
};

export function DailyView({ state, dispatch }: Props) {
  const date = state.uiState.selectedDailyDate;
  const page = date ? state.dailyPages[date] : null;

  const [todoText, setTodoText] = useState("");
  const [priority, setPriority] = useState<Priority>(2);

  const grouped = useMemo(() => groupTodosByPriority(page?.todos ?? []), [page?.todos]);

  if (!page || !date) {
    return <section className="empty-view">No daily page selected.</section>;
  }

  return (
    <section className="daily-layout">
      <div className="note-pane dotted-grid">
        <div className="note-header">
          <h2>{getDayLabel(date)}</h2>
        </div>
        <div className="editor-layer">
          <MarkdownEditor
            value={page.markdown}
            onChange={(markdown) => dispatch({ type: "update-daily-markdown", date, markdown })}
          />
          <DrawingOverlay
            strokes={page.drawingStrokes}
            onChange={(drawingStrokes) => dispatch({ type: "set-daily-drawing", date, drawingStrokes })}
          />
        </div>
      </div>

      <div className="todo-pane">
        <div className="todo-header">
          <div className="todo-title-row">
            <h2>Todo List</h2>
          </div>
          <div className="todo-form">
            <input
              type="text"
              value={todoText}
              onChange={(event) => setTodoText(event.target.value)}
              placeholder="Add a task"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  dispatch({ type: "add-todo", date, text: todoText, priority });
                  setTodoText("");
                }
              }}
            />
            <select
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value) as Priority)}
            >
              <option value={1}>Priority 1</option>
              <option value={2}>Priority 2</option>
              <option value={3}>Priority 3</option>
            </select>
          </div>
          <p className="todo-hint" aria-live="polite">
            Press <kbd>↵</kbd> to add
          </p>
        </div>

        <div className="priority-groups">
          {([1, 2, 3] as const).map((priorityLevel) => {
            const todos = grouped[priorityLevel];
            const { label, groupClassName, badgeClassName } = PRIORITY_META[priorityLevel];

            return (
            <div key={priorityLevel} className={groupClassName}>
              <div className="priority-group-header">
                <h3>{label}</h3>
                {todos.length > 0 ? (
                  <Badge className={badgeClassName} aria-label={`${label} task count`}>
                    {todos.length}
                  </Badge>
                ) : null}
              </div>
              <ul>
                {todos.map((todo) => (
                  <li key={todo.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => dispatch({ type: "toggle-todo", date, todoId: todo.id })}
                      />
                      <span className={todo.done ? "done" : ""}>{todo.text}</span>
                    </label>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => dispatch({ type: "delete-todo", date, todoId: todo.id })}
                    >
                      ×
                    </button>
                  </li>
                ))}
                {todos.length === 0 ? (
                  <li className="priority-empty">No tasks yet</li>
                ) : null}
              </ul>
            </div>
          )})}
        </div>
      </div>
    </section>
  );
}
