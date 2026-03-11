"use client";

import { useMemo, useState, type Dispatch } from "react";
import { getDayLabel } from "@/lib/date";
import { groupTodosByPriority } from "@/lib/store";
import { MarkdownEditor } from "@/components/markdown-editor";
import { DrawingOverlay } from "@/components/drawing-overlay";
import type { AppState, Priority } from "@/lib/types";
import type { AppAction } from "@/components/app-context";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
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
          <h2>Todo List</h2>
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
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "add-todo", date, text: todoText, priority });
                setTodoText("");
              }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="priority-groups">
          {[1, 2, 3].map((priorityLevel) => (
            <div key={priorityLevel} className="priority-group">
              <h3>{`Priority ${priorityLevel}`}</h3>
              <ul>
                {grouped[priorityLevel as Priority].map((todo) => (
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
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
