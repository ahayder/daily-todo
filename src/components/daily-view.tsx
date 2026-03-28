"use client";

import { useMemo, useState, type Dispatch } from "react";
import { triggerCompletionConfettiFromElement } from "@/lib/confetti";
import { getDayLabel } from "@/lib/date";
import { groupTodosByPriority } from "@/lib/store";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { AppState, CategoryTheme, Priority } from "@/lib/types";
import type { AppAction } from "@/components/app-context";
import { CalendarDays, GripVertical, X, Plus, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseISO, differenceInDays } from "date-fns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

type PriorityLabels = {
  label: string;
  placeholder: string;
};

const PRIORITY_COLORS: Record<
  Priority,
  { accentVar: string; softVar: string }
> = {
  1: { accentVar: "--priority-1", softVar: "--priority-1-soft" },
  2: { accentVar: "--priority-2", softVar: "--priority-2-soft" },
  3: { accentVar: "--priority-3", softVar: "--priority-3-soft" },
};

const CATEGORY_LABELS: Record<CategoryTheme, Record<Priority, PriorityLabels>> = {
  normal: {
    1: { label: "Critical", placeholder: "Add a critical task…" },
    2: { label: "Important", placeholder: "Add an important task…" },
    3: { label: "Someday", placeholder: "Add a task for later…" },
  },
  adhd1: {
    1: { label: "Must Do (Non-negotiable)", placeholder: "Add a must-do task…" },
    2: { label: "Should Do", placeholder: "Add a should-do task…" },
    3: { label: "Could Do", placeholder: "Add a could-do task…" },
  },
  adhd2: {
    1: { label: "Today's Focus", placeholder: "Add a focus task…" },
    2: { label: "Upcoming", placeholder: "Add an upcoming task…" },
    3: { label: "Someday", placeholder: "Add a task for later…" },
  },
};

function getPriorityMeta(theme: CategoryTheme, priority: Priority) {
  return {
    ...PRIORITY_COLORS[priority],
    ...CATEGORY_LABELS[theme][priority],
  };
}

function InlineTaskInput({
  date,
  priority,
  meta,
  dispatch,
}: {
  date: string;
  priority: Priority;
  meta: ReturnType<typeof getPriorityMeta>;
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

function EditableTaskItem({
  todo,
  date,
  subtasks = [],
  dispatch,
  onCelebrate,
  dragHandleProps,
}: {
  todo: import("@/lib/types").Todo;
  date: string;
  subtasks?: import("@/lib/types").Todo[];
  dispatch: Dispatch<AppAction>;
  onCelebrate?: (target: HTMLElement) => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");

  const handleEditSubmit = () => {
    if (editText.trim() && editText !== todo.text) {
      dispatch({ type: "edit-todo", date, todoId: todo.id, text: editText.trim() });
    } else {
      setEditText(todo.text);
    }
    setIsEditing(false);
  };

  const handleAddSubtask = () => {
    if (subtaskText.trim()) {
      dispatch({
        type: "add-todo",
        date,
        text: subtaskText.trim(),
        priority: todo.priority,
        parentId: todo.id,
      });
      setSubtaskText("");
      setIsAddingSubtask(false);
    }
  };

  const isStale = useMemo(() => {
    if (!todo.createdAt || !date) return false;
    try {
        const createdDate = parseISO(todo.createdAt);
        const pageDate = parseISO(date);
        const diff = differenceInDays(pageDate, createdDate);
        return diff >= 2;
    } catch {
        return false;
    }
  }, [todo.createdAt, date]);

  return (
    <div className="flex flex-col w-full">
      <li className="task-item group">
        <Checkbox
          checked={todo.done}
          onClick={(event) => {
            if (!todo.done) {
              onCelebrate?.(event.currentTarget as HTMLElement);
            }
          }}
          onCheckedChange={() => dispatch({ type: "toggle-todo", date, todoId: todo.id })}
          className="task-checkbox"
        />

      {isEditing ? (
        <input
          type="text"
          className="flex-1 bg-transparent border-b border-[var(--brand)] outline-none text-[15px] px-1 py-0.5"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleEditSubmit();
            } else if (e.key === "Escape") {
              setEditText(todo.text);
              setIsEditing(false);
            }
          }}
          autoFocus
        />
      ) : (
        <span
          className={cn("task-text cursor-text flex items-center gap-2", todo.done && "task-text--done")}
          onDoubleClick={() => setIsEditing(true)}
        >
          {todo.text}
          {isStale && !todo.done && (
              <span 
                className="inline-flex items-center rounded-sm bg-[var(--warning-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)] tracking-wide"
                title={`Created on ${todo.createdAt.split('T')[0]}`}
              >
                  💤 Stale
              </span>
          )}
        </span>
      )}

      <div
        className="cursor-grab hover:text-[var(--ink-900)] text-[var(--ink-700)] opacity-0 group-hover:opacity-30 transition-opacity duration-150 flex outline-none"
        {...dragHandleProps}
      >
        <GripVertical className="h-3.5 w-3.5 flex-shrink-0" />
      </div>
      <button
        type="button"
        className="task-delete-btn mr-1 text-[var(--ink-500)] hover:text-[var(--brand)] opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => dispatch({ type: "set-focus-mode", isFocus: true, todoId: todo.id })}
        aria-label="Focus on this task"
      >
        <Target className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="task-delete-btn"
        onClick={() => dispatch({ type: "delete-todo", date, todoId: todo.id })}
        aria-label="Delete task"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>

      {/* Sub-tasks rendering */}
      {subtasks.length > 0 && (
        <ul className="pl-6 mt-1 flex flex-col gap-1 w-full border-l border-[var(--ink-200)] ml-3 mb-2">
          {subtasks.map((subtodo) => (
            <EditableTaskItem
              key={subtodo.id}
              todo={subtodo}
              date={date}
              dispatch={dispatch}
              onCelebrate={onCelebrate}
            />
          ))}
        </ul>
      )}

      {/* Inline Sub-task Input */}
      {isAddingSubtask ? (
        <div className="pl-6 mt-1 flex items-center gap-2 mb-2 w-full">
            <div className="w-4 h-4 rounded-sm border border-[var(--ink-300)] flex-shrink-0" />
            <input
              type="text"
              className="flex-1 bg-transparent border-b border-[var(--brand)] outline-none text-[14px] px-1 py-0.5"
              placeholder="Add a sub-task..."
              value={subtaskText}
              onChange={(e) => setSubtaskText(e.target.value)}
              onBlur={() => {
                  if (!subtaskText.trim()) {
                      setIsAddingSubtask(false);
                  } else {
                      handleAddSubtask();
                  }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSubtask();
                } else if (e.key === "Escape") {
                  setIsAddingSubtask(false);
                  setSubtaskText("");
                }
              }}
              autoFocus
            />
        </div>
      ) : (
        !todo.parentId && (
        <div className="pl-6 flex mb-2 w-full">
            <button
                type="button"
                className="text-xs text-[var(--ink-500)] hover:text-[var(--brand)] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setIsAddingSubtask(true)}
            >
                <Plus className="h-3 w-3" /> Add sub-task
            </button>
        </div>
        )
      )}
    </div>
  );
}

function SortableTaskItem({
  todo,
  date,
  subtasks,
  dispatch,
  onCelebrate,
}: {
  todo: import("@/lib/types").Todo;
  date: string;
  subtasks: import("@/lib/types").Todo[];
  dispatch: Dispatch<AppAction>;
  onCelebrate?: (target: HTMLElement) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: todo.id,
    data: { priority: todo.priority },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <EditableTaskItem
        todo={todo}
        date={date}
        subtasks={subtasks}
        dispatch={dispatch}
        onCelebrate={onCelebrate}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export function DailyView({ state, dispatch }: Props) {
  const date = state.uiState.selectedDailyDate;
  const page = date ? state.dailyPages[date] : null;
  const isFocusMode = state.uiState.isFocusMode;
  const focusedTodoId = state.uiState.focusedTodoId;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const grouped = useMemo(
    () => groupTodosByPriority(page?.todos ?? []),
    [page?.todos]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !date) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activePriority = active.data.current?.priority as Priority;

    // Dropping on another task
    if (activeId !== overId && over.data.current) {
      const targetPriority = over.data.current.priority as Priority;
      const targetList = grouped[targetPriority];
      const newIndex = targetList.findIndex((t) => t.id === overId);

      dispatch({
        type: "move-todo-priority",
        date,
        todoId: activeId,
        newPriority: targetPriority,
        newIndex,
      });
    } else if (overId.startsWith("priority-group-")) {
      // Dropping on an empty group container
      const targetPriority = parseInt(overId.replace("priority-group-", ""), 10) as Priority;
      if (activePriority !== targetPriority) {
          dispatch({
              type: "move-todo-priority",
              date,
              todoId: activeId,
              newPriority: targetPriority,
              newIndex: grouped[targetPriority].length, 
            });
      }
    }
  };

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

  if (isFocusMode) {
    const focusedTodo = page.todos.find((t) => t.id === focusedTodoId) || page.todos[0];
    
    if (!focusedTodo) {
        return (
          <section className="flex flex-col items-center justify-center h-full w-full bg-[var(--surface)] text-center p-8">
             <Target className="h-12 w-12 text-[var(--brand)] opacity-50 mb-4" />
             <h2 className="text-xl font-semibold text-[var(--ink-900)] mb-2">Focus Mode</h2>
             <p className="text-[var(--ink-600)] mb-6 max-w-md">You have no tasks to focus on today. Add some tasks first.</p>
             <button 
                 type="button"
                 onClick={() => dispatch({ type: "set-focus-mode", isFocus: false })}
                 className="px-4 py-2 bg-[var(--brand)] text-white rounded-md font-medium text-sm hover:opacity-90 transition-opacity"
             >
                 Exit Focus Mode
             </button>
          </section>
        )
    }

    const subtasks = page.todos.filter((t) => t.parentId === focusedTodo.id);
    const meta = getPriorityMeta(state.uiState.categoryTheme, focusedTodo.priority);

    return (
      <section className="flex flex-col items-center justify-center h-full w-full bg-[var(--surface)] overflow-y-auto">
        <div className="w-full max-w-2xl px-8 py-12 flex flex-col items-center">
            
            <div className="mb-12 flex flex-col items-center text-center">
                <Badge
                    style={{
                    backgroundColor: `var(${meta.softVar})`,
                    color: `var(${meta.accentVar})`,
                    borderColor: `color-mix(in srgb, var(${meta.accentVar}) 30%, transparent)`,
                    marginBottom: '1rem'
                    }}
                >
                    {meta.label}
                </Badge>
                
                <h1 className="text-4xl font-bold text-[var(--ink-900)] tracking-tight mb-4 leading-tight">
                    {focusedTodo.text}
                </h1>
                
                <div className="flex items-center gap-4">
                    <button 
                        type="button"
                        onClick={(event) => {
                          if (!focusedTodo.done) {
                            triggerCompletionConfettiFromElement(event.currentTarget);
                          }

                          dispatch({ type: "toggle-todo", date, todoId: focusedTodo.id });
                        }}
                        className={cn(
                            "px-6 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 transition-all shadow-sm",
                            focusedTodo.done 
                                ? "bg-[var(--brand)] text-[var(--paper)] border border-[var(--brand)]" 
                                : "bg-[var(--paper-strong)] border border-[var(--line)] text-[var(--ink-900)] hover:border-[var(--brand)] hover:text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                        )}
                    >
                        <Checkbox checked={focusedTodo.done} className="pointer-events-none" />
                        {focusedTodo.done ? "Completed" : "Mark Complete"}
                    </button>
                </div>
            </div>

            <div className="w-full bg-[var(--paper-strong)] rounded-xl border border-[var(--line)] shadow-sm p-6">
                <h3 className="text-sm font-semibold text-[var(--ink-900)] uppercase tracking-wider mb-4">
                    Sub-tasks
                </h3>
                <ul className="flex flex-col gap-2 w-full">
                    {subtasks.length === 0 ? (
                         <li className="text-[var(--ink-700)] text-sm italic">No sub-tasks.</li>
                    ) : (
                        subtasks.map((subtodo) => (
                            <EditableTaskItem
                            key={subtodo.id}
                            todo={subtodo}
                            date={date}
                            dispatch={dispatch}
                            onCelebrate={triggerCompletionConfettiFromElement}
                            />
                        ))
                    )}
                </ul>
                
                {/* Inline Add sub-task for focus mode */}
                <div className="mt-4 pt-4 border-t border-[var(--line)]">
                    <InlineTaskInput
                        date={date}
                        priority={focusedTodo.priority}
                        meta={{ ...meta, placeholder: "Add a sub-task..." }}
                        dispatch={(action) => {
                            if (action.type === 'add-todo') {
                                dispatch({ ...action, parentId: focusedTodo.id });
                            } else {
                                dispatch(action);
                            }
                        }}
                    />
                </div>
            </div>
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
        </div>
      </div>

      {/* Todo Pane */}
      <div className="todo-pane">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="priority-groups">
            {([1, 2, 3] as const).map((priorityLevel) => {
              const todosInPriority = grouped[priorityLevel];
              const parentTodos = todosInPriority.filter((t) => !t.parentId);
              const meta = getPriorityMeta(state.uiState.categoryTheme, priorityLevel);

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
                  {parentTodos.length > 0 && (
                    <Badge
                      className="priority-count-badge"
                      style={{
                        backgroundColor: `var(${meta.softVar})`,
                        color: `var(${meta.accentVar})`,
                        borderColor: `color-mix(in srgb, var(${meta.accentVar}) 30%, transparent)`,
                      }}
                    >
                      {parentTodos.length}
                    </Badge>
                  )}
                </div>

                {/* Task items */}
                <SortableContext
                  id={`priority-group-${priorityLevel}`}
                  items={parentTodos.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="task-list flex-1 min-h-[30px]">
                    {parentTodos.map((parentTodo) => {
                      const subtasks = todosInPriority.filter(
                        (t) => t.parentId === parentTodo.id
                      );
                      return (
                        <SortableTaskItem
                          key={parentTodo.id}
                          todo={parentTodo}
                          date={date}
                          subtasks={subtasks}
                          dispatch={dispatch}
                          onCelebrate={triggerCompletionConfettiFromElement}
                        />
                      );
                    })}

                    {parentTodos.length === 0 && (
                      <li className="task-empty">No tasks yet</li>
                    )}
                  </ul>
                </SortableContext>

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
        </DndContext>
      </div>
    </section>
  );
}
