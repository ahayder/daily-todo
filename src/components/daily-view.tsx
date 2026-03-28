"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DOMAttributes,
  type HTMLAttributes,
} from "react";
import { triggerCompletionConfettiFromElement } from "@/lib/confetti";
import { getDayLabel } from "@/lib/date";
import { groupTodosByPriority } from "@/lib/store";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AppState, CategoryTheme, Priority } from "@/lib/types";
import type { AppAction } from "@/components/app-context";
import { Brain, CalendarDays, GripVertical, Pencil, X, Plus, Target } from "lucide-react";
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
  type DragOverEvent,
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

type DropIndicatorPosition = "before" | "after";

type DropIndicator = {
  overId: string;
  priority: Priority;
  position: DropIndicatorPosition;
  isGroup?: boolean;
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

const CATEGORY_CYCLE: CategoryTheme[] = ["normal", "adhd1", "adhd2"];
const CATEGORY_TOOLTIP: Record<CategoryTheme, string> = {
  normal: "Labels: Normal",
  adhd1: "Labels: ADHD 1",
  adhd2: "Labels: ADHD 2",
};
const DAILY_TASK_PANE_DEFAULT_WIDTH = 500;
const DAILY_TASK_PANE_MIN_WIDTH = 320;
const DAILY_NOTE_PANE_MIN_WIDTH = 480;
const DAILY_RESIZER_WIDTH = 6;

export function getDropIndicatorPosition({
  activeTop,
  activeHeight,
  overTop,
  overHeight,
}: {
  activeTop: number;
  activeHeight: number;
  overTop: number;
  overHeight: number;
}): DropIndicatorPosition {
  const activeCenterY = activeTop + activeHeight / 2;
  const overCenterY = overTop + overHeight / 2;
  return activeCenterY > overCenterY ? "after" : "before";
}

export function getDropInsertionIndex({
  siblingIds,
  activeId,
  overId,
  position,
}: {
  siblingIds: string[];
  activeId: string;
  overId: string;
  position: DropIndicatorPosition;
}) {
  const overIndex = siblingIds.indexOf(overId);
  if (overIndex === -1) {
    return siblingIds.length;
  }

  const activeIndex = siblingIds.indexOf(activeId);

  if (position === "before") {
    if (activeIndex !== -1 && activeIndex < overIndex) {
      return overIndex - 1;
    }
    return overIndex;
  }

  if (activeIndex !== -1 && activeIndex > overIndex) {
    return overIndex + 1;
  }

  if (activeIndex !== -1 && activeIndex < overIndex) {
    return overIndex;
  }

  return overIndex + 1;
}

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
  className,
}: {
  date: string;
  priority: Priority;
  meta: ReturnType<typeof getPriorityMeta>;
  dispatch: Dispatch<AppAction>;
  className?: string;
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
        focused && "inline-task-input--focused",
        className
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
  dragSurfaceProps,
  dropIndicatorPosition,
}: {
  todo: import("@/lib/types").Todo;
  date: string;
  subtasks?: import("@/lib/types").Todo[];
  dispatch: Dispatch<AppAction>;
  onCelebrate?: (target: HTMLElement) => void;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
  dragSurfaceProps?: DOMAttributes<HTMLDivElement>;
  dropIndicatorPosition?: DropIndicatorPosition | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isTaskActive, setIsTaskActive] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [subtaskText, setSubtaskText] = useState("");
  const [isSubtaskComposerVisible, setIsSubtaskComposerVisible] = useState(false);
  const [isSubtaskFocused, setIsSubtaskFocused] = useState(false);

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
      setIsSubtaskComposerVisible(false);
      setIsSubtaskFocused(false);
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

  const showSubtaskComposer =
    !todo.parentId && (isSubtaskComposerVisible || isSubtaskFocused);
  const showSubtaskAction = !todo.parentId && !isEditing && (isTaskActive || showSubtaskComposer);

  return (
    <div
      className={cn(
        "task-entry flex flex-col w-full",
        dropIndicatorPosition === "before" && "task-entry--drop-before",
        dropIndicatorPosition === "after" && "task-entry--drop-after",
      )}
      onMouseEnter={() => {
        setIsTaskActive(true);
      }}
      onMouseLeave={() => {
        setIsTaskActive(false);
      }}
      onFocusCapture={() => {
        setIsTaskActive(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsTaskActive(false);
        }
      }}
    >
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
          <div
            className="task-drag-surface"
            {...dragSurfaceProps}
          >
            <span
              className={cn("task-text flex items-center gap-2", todo.done && "task-text--done")}
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
          </div>
        )}

        <div className="task-row-actions">
          <div
            className="task-row-action-grip"
            {...dragHandleProps}
          >
            <GripVertical className="h-3.5 w-3.5 flex-shrink-0" />
          </div>

          {!isEditing ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="task-row-action-btn task-row-action-btn--edit"
                  onClick={() => setIsEditing(true)}
                  aria-label="Edit task"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Edit task
              </TooltipContent>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="task-row-action-btn task-row-action-btn--focus"
                onClick={() => dispatch({ type: "set-focus-mode", isFocus: true, todoId: todo.id })}
                aria-label="Focus on this task"
              >
                <Target className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Focus on this task
            </TooltipContent>
          </Tooltip>

          {showSubtaskAction ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="task-row-action-btn task-row-action-btn--subtask"
                  onClick={() => {
                    setIsSubtaskComposerVisible(true);
                  }}
                  aria-label="Add subtask"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Add subtask
              </TooltipContent>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="task-row-action-btn task-row-action-btn--delete"
                onClick={() => dispatch({ type: "delete-todo", date, todoId: todo.id })}
                aria-label="Delete task"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Delete task
            </TooltipContent>
          </Tooltip>
        </div>
      </li>

      {/* Sub-tasks rendering */}
      {subtasks.length > 0 && (
        <ul className="subtask-list">
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
      {showSubtaskComposer ? (
        <div className="subtask-composer">
            <div className="subtask-composer-checkbox" />
            <input
              type="text"
              className="subtask-composer-input"
              placeholder="Add a subtask"
              value={subtaskText}
              onChange={(e) => setSubtaskText(e.target.value)}
              onFocus={() => {
                setIsSubtaskComposerVisible(true);
                setIsSubtaskFocused(true);
              }}
              onBlur={() => {
                  setIsSubtaskFocused(false);

                  if (!subtaskText.trim()) {
                      setIsSubtaskComposerVisible(false);
                  } else {
                      handleAddSubtask();
                  }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSubtask();
                } else if (e.key === "Escape") {
                  setIsSubtaskComposerVisible(false);
                  setIsSubtaskFocused(false);
                  setSubtaskText("");
                }
              }}
              autoFocus
            />
        </div>
      ) : null}
    </div>
  );
}

function SortableTaskItem({
  todo,
  date,
  subtasks,
  dispatch,
  onCelebrate,
  dropIndicatorPosition,
}: {
  todo: import("@/lib/types").Todo;
  date: string;
  subtasks: import("@/lib/types").Todo[];
  dispatch: Dispatch<AppAction>;
  onCelebrate?: (target: HTMLElement) => void;
  dropIndicatorPosition?: DropIndicatorPosition | null;
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
        dragSurfaceProps={listeners}
        dropIndicatorPosition={dropIndicatorPosition}
      />
    </div>
  );
}

export function DailyView({ state, dispatch }: Props) {
  const date = state.uiState.selectedDailyDate;
  const page = date ? state.dailyPages[date] : null;
  const isFocusMode = state.uiState.isFocusMode;
  const focusedTodoId = state.uiState.focusedTodoId;
  const layoutRef = useRef<HTMLElement | null>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

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
  const categoryTheme = state.uiState.categoryTheme;
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const [isResizeHandleHovered, setIsResizeHandleHovered] = useState(false);
  const [isResizingTaskPane, setIsResizingTaskPane] = useState(false);

  const clampTaskPaneWidth = (proposedWidth: number) => {
    const layoutWidth = layoutRef.current?.getBoundingClientRect().width ?? 0;
    const maxWidth =
      layoutWidth > 0
        ? Math.max(
            DAILY_TASK_PANE_MIN_WIDTH,
            layoutWidth - DAILY_NOTE_PANE_MIN_WIDTH - DAILY_RESIZER_WIDTH,
          )
        : proposedWidth;

    return Math.min(maxWidth, Math.max(DAILY_TASK_PANE_MIN_WIDTH, proposedWidth));
  };

  const taskPaneWidth = Math.max(
    DAILY_TASK_PANE_MIN_WIDTH,
    state.uiState.dailyTaskPaneWidth ?? DAILY_TASK_PANE_DEFAULT_WIDTH,
  );

  const clearDropIndicator = () => {
    setDropIndicator(null);
  };

  useEffect(() => {
    if (!isResizingTaskPane) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const deltaX = event.clientX - resizeState.startX;
      dispatch({
        type: "set-daily-task-pane-width",
        width: clampTaskPaneWidth(resizeState.startWidth - deltaX),
      });
    };

    const stopResizing = () => {
      resizeStateRef.current = null;
      setIsResizingTaskPane(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dispatch, isResizingTaskPane]);

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      clearDropIndicator();
      return;
    }

    const overId = String(over.id);

    if (overId.startsWith("priority-group-")) {
      const priority = Number.parseInt(overId.replace("priority-group-", ""), 10) as Priority;
      setDropIndicator({
        overId,
        priority,
        position: "before",
        isGroup: true,
      });
      return;
    }

    const priority = over.data.current?.priority as Priority | undefined;
    if (!priority) {
      clearDropIndicator();
      return;
    }

    const translatedRect = active.rect.current.translated;
    const position = translatedRect
      ? getDropIndicatorPosition({
          activeTop: translatedRect.top,
          activeHeight: translatedRect.height,
          overTop: over.rect.top,
          overHeight: over.rect.height,
        })
      : "before";

    setDropIndicator({
      overId,
      priority,
      position,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !date) {
      clearDropIndicator();
      return;
    }

    const activeId = active.id as string;
    const activePriority = active.data.current?.priority as Priority;
    const indicator = dropIndicator;
    clearDropIndicator();

    if (indicator && !indicator.isGroup && activeId !== indicator.overId) {
      const targetPriority = indicator.priority;
      const targetList = grouped[targetPriority].filter((todo) => !todo.parentId);
      const newIndex = getDropInsertionIndex({
        siblingIds: targetList.map((todo) => todo.id),
        activeId,
        overId: indicator.overId,
        position: indicator.position,
      });

      dispatch({
        type: "move-todo-priority",
        date,
        todoId: activeId,
        newPriority: targetPriority,
        newIndex,
      });
    } else if (indicator?.isGroup) {
      const targetPriority = indicator.priority;
      if (activePriority !== targetPriority) {
        dispatch({
          type: "move-todo-priority",
          date,
          todoId: activeId,
          newPriority: targetPriority,
          newIndex: grouped[targetPriority].filter((todo) => !todo.parentId).length,
        });
      }
    }
  };

  const handleDragCancel = () => {
    clearDropIndicator();
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
                    className="text-[15px] px-3 py-1"
                    style={{
                    backgroundColor: `var(${meta.softVar})`,
                    color: `var(${meta.accentVar})`,
                    borderColor: `color-mix(in srgb, var(${meta.accentVar}) 30%, transparent)`,
                    marginBottom: '1rem'
                    }}
                >
                    {meta.label}
                </Badge>
                
                <h1 className="text-5xl font-bold text-[var(--ink-900)] tracking-tight mb-5 leading-[1.08]">
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
                            "px-7 py-3 rounded-full font-medium text-[16px] flex items-center gap-2.5 transition-all shadow-sm",
                            focusedTodo.done 
                                ? "bg-[var(--brand)] text-[var(--paper)] border border-[var(--brand)]" 
                                : "bg-[var(--paper-strong)] border border-[var(--line)] text-[var(--ink-900)] hover:border-[var(--brand)] hover:text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                        )}
                    >
                        <Checkbox
                          checked={focusedTodo.done}
                          className={cn("task-checkbox pointer-events-none", focusedTodo.done && "border-current")}
                        />
                        {focusedTodo.done ? "Completed" : "Mark Complete"}
                    </button>
                </div>
            </div>

            <div className="w-full bg-[var(--paper-strong)] rounded-xl border border-[var(--line)] shadow-sm p-6">
                <h3 className="text-[15px] font-semibold text-[var(--ink-900)] uppercase tracking-[0.12em] mb-4">
                    Sub-tasks
                </h3>
                <ul className="flex flex-col gap-2 w-full">
                    {subtasks.length === 0 ? (
                         <li className="text-[var(--ink-700)] text-[15px] italic">No sub-tasks.</li>
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
    <section
      ref={layoutRef}
      className="daily-layout"
      style={{
        gridTemplateColumns: `minmax(0, 1fr) ${DAILY_RESIZER_WIDTH}px minmax(${DAILY_TASK_PANE_MIN_WIDTH}px, clamp(${DAILY_TASK_PANE_MIN_WIDTH}px, ${taskPaneWidth}px, calc(100% - ${DAILY_NOTE_PANE_MIN_WIDTH}px - ${DAILY_RESIZER_WIDTH}px)))`,
      }}
    >
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

      <button
        type="button"
        aria-label="Resize task pane"
        data-testid="task-pane-resizer"
        className={cn(
          "daily-resize-rail",
          isResizeHandleHovered && "daily-resize-rail--hovered",
          isResizingTaskPane && "daily-resize-rail--dragging",
        )}
        onMouseEnter={() => setIsResizeHandleHovered(true)}
        onMouseLeave={() => setIsResizeHandleHovered(false)}
        onFocus={() => setIsResizeHandleHovered(true)}
        onBlur={() => setIsResizeHandleHovered(false)}
        onPointerDown={(event) => {
          event.preventDefault();
          resizeStateRef.current = {
            startX: event.clientX,
            startWidth: taskPaneWidth,
          };
          setIsResizingTaskPane(true);
        }}
      >
        <span className="daily-resize-handle" aria-hidden="true" />
      </button>

      {/* Todo Pane */}
      <div className="todo-pane">
        <div className="todo-pane-header">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-[17px] font-semibold text-[var(--ink-900)] leading-[1.35]">Tasks</h2>
            <p className="text-xs text-[var(--ink-700)]">Plan the day from here.</p>
          </div>

          <div className="todo-pane-actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: "set-focus-mode", isFocus: !state.uiState.isFocusMode });
                  }}
                  aria-label="Toggle Focus Mode"
                  className={cn(
                    "todo-pane-action-btn",
                    state.uiState.isFocusMode && "todo-pane-action-btn--active"
                  )}
                >
                  <Target className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {state.uiState.isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    const currentIndex = CATEGORY_CYCLE.indexOf(categoryTheme);
                    const next = CATEGORY_CYCLE[(currentIndex + 1) % CATEGORY_CYCLE.length];
                    dispatch({ type: "set-category-theme", theme: next });
                  }}
                  aria-label={`Category labels: ${categoryTheme}`}
                  className="todo-pane-action-btn"
                >
                  <Brain className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {CATEGORY_TOOLTIP[categoryTheme]}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <ScrollArea className="todo-pane-scroll" data-testid="task-pane-scroll">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={handleDragOver}
            onDragCancel={handleDragCancel}
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
                      backgroundColor: `color-mix(in srgb, var(${meta.softVar}) 72%, var(--paper-strong))`,
                    }}
                  >
                    <div className="priority-group-header-content">
                      <div className="priority-group-header-title-row">
                        <h3 className="text-[15px] font-semibold leading-[1.3] text-[var(--ink-900)]">
                          {meta.label}
                        </h3>
                        {parentTodos.length > 0 && (
                          <Badge
                            className="priority-count-badge"
                            style={{
                              backgroundColor: `color-mix(in srgb, var(${meta.softVar}) 48%, var(--paper-strong))`,
                              color: `var(${meta.accentVar})`,
                              borderColor: `color-mix(in srgb, var(${meta.accentVar}) 24%, var(--paper-strong))`,
                            }}
                          >
                            {parentTodos.length}
                          </Badge>
                        )}
                      </div>
                      <span
                        className="priority-group-header-accent"
                        aria-hidden="true"
                        style={{ backgroundColor: `var(${meta.accentVar})` }}
                      />
                    </div>
                  </div>

                  {/* Task items */}
                  <SortableContext
                    id={`priority-group-${priorityLevel}`}
                    items={parentTodos.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul
                      className={cn(
                        "task-list flex-1 min-h-[30px]",
                        dropIndicator?.isGroup &&
                          dropIndicator.priority === priorityLevel &&
                          "task-list--drop-target",
                      )}
                    >
                      {parentTodos.length === 0 && (
                        <li>
                          <InlineTaskInput
                            date={date}
                            priority={priorityLevel}
                            meta={meta}
                            dispatch={dispatch}
                            className="inline-task-input--in-list inline-task-input--at-top"
                          />
                        </li>
                      )}

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
                            dropIndicatorPosition={
                              dropIndicator?.overId === parentTodo.id
                                ? dropIndicator.position
                                : null
                            }
                          />
                        );
                      })}

                      {parentTodos.length > 0 && (
                        <li>
                          <InlineTaskInput
                            date={date}
                            priority={priorityLevel}
                            meta={meta}
                            dispatch={dispatch}
                            className="inline-task-input--in-list inline-task-input--at-bottom"
                          />
                        </li>
                      )}

                      {parentTodos.length === 0 && (
                        <li className="task-empty">No tasks yet</li>
                      )}
                    </ul>
                  </SortableContext>
                </div>
              );
            })}
            </div>
          </DndContext>
        </ScrollArea>
      </div>
    </section>
  );
}
