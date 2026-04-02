"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type HTMLAttributes,
} from "react";
import { triggerCompletionConfettiFromElement } from "@/lib/confetti";
import { getDayLabel } from "@/lib/date";
import { groupTodosByPriority } from "@/lib/store";
import { MarkdownEditor } from "@/components/markdown-editor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AppState, CategoryTheme, Priority, TaskStatus } from "@/lib/types";
import type { AppAction } from "@/components/app-context";
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Target,
  X,
  Pause,
} from "lucide-react";
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
const ESTIMATE_PRESETS = [5, 10, 20, 30, 60] as const;

const STATUS_META: Record<
  TaskStatus,
  { label: string; shortLabel: string; className: string }
> = {
  pending: {
    label: "Pending",
    shortLabel: "Pending",
    className:
      "border-[color-mix(in_srgb,var(--priority-2)_52%,var(--line))] bg-[color-mix(in_srgb,var(--priority-2-soft)_88%,var(--paper-strong))] text-[color-mix(in_srgb,var(--priority-2)_72%,black_24%)] hover:border-[color-mix(in_srgb,var(--priority-2)_78%,black_10%)] hover:text-[color-mix(in_srgb,var(--priority-2)_84%,black_18%)]",
  },
  ongoing: {
    label: "Ongoing",
    shortLabel: "In Progress",
    className:
      "border-[color-mix(in_srgb,#5d87b8_68%,var(--line))] bg-[color-mix(in_srgb,#dce9f7_88%,var(--paper-strong))] text-[color-mix(in_srgb,#3f6997_82%,black_12%)] hover:border-[color-mix(in_srgb,#4f79a8_84%,black_6%)] hover:text-[color-mix(in_srgb,#355d86_88%,black_10%)]",
  },
  finished: {
    label: "Done",
    shortLabel: "Done",
    className:
      "border-[color-mix(in_srgb,var(--priority-3)_62%,var(--line))] bg-[color-mix(in_srgb,var(--priority-3-soft)_92%,var(--paper-strong))] text-[color-mix(in_srgb,var(--priority-3)_78%,black_18%)] hover:border-[color-mix(in_srgb,var(--priority-3)_84%,black_8%)]",
  },
};

function formatTimer(totalSeconds: number | null): string {
  const safeSeconds = Math.max(0, totalSeconds ?? 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatEstimate(minutes: number | null): string {
  return minutes ? `${minutes}m` : "Set time";
}

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
  onRequestFocus,
  dragSurfaceProps,
  dropIndicatorPosition,
}: {
  todo: import("@/lib/types").Todo;
  date: string;
  subtasks?: import("@/lib/types").Todo[];
  dispatch: Dispatch<AppAction>;
  onCelebrate?: (target: HTMLElement) => void;
  onRequestFocus?: (todoId: string) => void;
  dragSurfaceProps?: HTMLAttributes<HTMLDivElement>;
  dropIndicatorPosition?: DropIndicatorPosition | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isTaskActive, setIsTaskActive] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const [isEstimateEditorOpen, setIsEstimateEditorOpen] = useState(false);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const [customEstimate, setCustomEstimate] = useState(
    todo.estimatedMinutes ? String(todo.estimatedMinutes) : "",
  );
  const textClickTimeoutRef = useRef<number | null>(null);
  const [isSubtasksCollapsed, setIsSubtasksCollapsed] = useState(false);
  const [subtaskText, setSubtaskText] = useState("");
  const [isSubtaskComposerVisible, setIsSubtaskComposerVisible] = useState(false);
  const [isSubtaskFocused, setIsSubtaskFocused] = useState(false);

  const [prevTodoText, setPrevTodoText] = useState(todo.text);
  const [prevTodoEstimate, setPrevTodoEstimate] = useState(todo.estimatedMinutes);

  if (todo.text !== prevTodoText || todo.estimatedMinutes !== prevTodoEstimate) {
    setPrevTodoText(todo.text);
    setPrevTodoEstimate(todo.estimatedMinutes);
    setEditText(todo.text);
    setCustomEstimate(todo.estimatedMinutes ? String(todo.estimatedMinutes) : "");
  }

  useEffect(() => {
    return () => {
      if (textClickTimeoutRef.current !== null) {
        window.clearTimeout(textClickTimeoutRef.current);
      }
    };
  }, []);

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

  const handleStatusChange = (status: TaskStatus, target?: HTMLElement) => {
    if (status === "finished" && todo.status !== "finished" && target) {
      onCelebrate?.(target);
    }

    dispatch({
      type: "set-todo-status",
      date,
      todoId: todo.id,
      status: todo.status === "finished" && status !== "finished" ? "pending" : status,
    });
  };

  const handleEstimateSubmit = () => {
    const parsed = Number.parseInt(customEstimate, 10);
    dispatch({
      type: "set-todo-estimated-minutes",
      date,
      todoId: todo.id,
      estimatedMinutes: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
    });
    setIsEstimateEditorOpen(false);
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
  const isSubtask = Boolean(todo.parentId);
  const showSubtaskAction = !isSubtask && !isEditing && (isTaskActive || showSubtaskComposer);
  const canCollapseSubtasks = !isSubtask && subtasks.length > 0;
  const statusMeta = STATUS_META[todo.status];
  const nextStatus =
    todo.status === "pending"
      ? "ongoing"
      : todo.status === "ongoing"
        ? "finished"
        : "pending";
  const pendingStatusMeta = pendingStatus ? STATUS_META[pendingStatus] : null;

  const handleTaskTextClick = () => {
    if (textClickTimeoutRef.current !== null) {
      window.clearTimeout(textClickTimeoutRef.current);
    }

    textClickTimeoutRef.current = window.setTimeout(() => {
      setIsEditing(true);
      textClickTimeoutRef.current = null;
    }, 180);
  };

  const handleTaskTextDoubleClick = () => {
    if (isSubtask) {
      return;
    }

    if (textClickTimeoutRef.current !== null) {
      window.clearTimeout(textClickTimeoutRef.current);
      textClickTimeoutRef.current = null;
    }

    onRequestFocus?.(todo.id);
  };

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
      <Popover open={isEstimateEditorOpen} onOpenChange={setIsEstimateEditorOpen}>
        <li className="task-item group">
          {canCollapseSubtasks ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="task-collapse-btn"
                  aria-label={isSubtasksCollapsed ? "Expand subtasks" : "Collapse subtasks"}
                  onClick={() => {
                    if (!isSubtasksCollapsed) {
                      setIsSubtaskComposerVisible(false);
                      setIsSubtaskFocused(false);
                      setSubtaskText("");
                    }
                    setIsSubtasksCollapsed((value) => !value);
                  }}
                >
                  {isSubtasksCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isSubtasksCollapsed ? "Expand subtasks" : "Collapse subtasks"}
              </TooltipContent>
            </Tooltip>
          ) : null}

          <button
            type="button"
            aria-label={`Status for ${todo.text}`}
            onClick={() => {
              setPendingStatus(nextStatus);
              setIsStatusConfirmOpen(true);
          }}
          className={cn(
            "inline-flex h-5.5 min-w-[72px] items-center justify-center rounded-full border px-1.5 text-[9px] font-semibold tracking-[0.08em] uppercase transition-colors",
            statusMeta.className,
          )}
        >
            {statusMeta.shortLabel}
          </button>

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
              <div className="flex flex-1 flex-col gap-1">
                <span
                  className={cn(
                    "task-text flex items-center gap-2",
                    todo.status === "finished" && "task-text--done",
                  )}
                  onClick={handleTaskTextClick}
                  onDoubleClick={handleTaskTextDoubleClick}
                >
                  {todo.text}
                  {!isSubtask && todo.estimatedMinutes !== null ? (
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="task-estimate-chip"
                        aria-label={`Edit estimate for ${todo.text}`}
                      >
                        {formatEstimate(todo.estimatedMinutes)}
                      </button>
                    </PopoverTrigger>
                  ) : null}
                  {todo.status === "ongoing" ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--brand)]">
                      Active
                    </span>
                  ) : null}
                  {isStale && todo.status !== "finished" && (
                    <span
                      className="inline-flex items-center rounded-sm bg-[var(--warning-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--warning)] tracking-wide"
                      title={`Created on ${todo.createdAt.split("T")[0]}`}
                    >
                      Stale
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="task-row-actions">
            {!isSubtask && todo.estimatedMinutes === null ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="task-row-action-btn task-row-action-btn--time"
                      aria-label={`Set estimate for ${todo.text}`}
                    >
                      <Clock3 className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Set time
                </TooltipContent>
              </Tooltip>
            ) : null}

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

            {!isSubtask ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="task-row-action-btn task-row-action-btn--focus"
                    onClick={() => onRequestFocus?.(todo.id)}
                    aria-label="Focus on this task"
                  >
                    <Target className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Focus on this task
                </TooltipContent>
              </Tooltip>
            ) : null}

            {showSubtaskAction ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="task-row-action-btn task-row-action-btn--subtask"
                    onClick={() => {
                      setIsSubtasksCollapsed(false);
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

          <PopoverContent className="task-time-popover">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink-900)]">Task time</p>
                  <p className="text-xs text-[var(--ink-700)]">
                    {todo.estimatedMinutes !== null
                      ? `Current estimate: ${formatEstimate(todo.estimatedMinutes)}`
                      : "Choose a quick estimate or enter custom minutes."}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {ESTIMATE_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => {
                      dispatch({
                        type: "set-todo-estimated-minutes",
                        date,
                        todoId: todo.id,
                        estimatedMinutes: minutes,
                      });
                      setCustomEstimate(String(minutes));
                      setIsEstimateEditorOpen(false);
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      todo.estimatedMinutes === minutes
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                        : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink-700)] hover:border-[var(--brand)] hover:text-[var(--brand)]",
                    )}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={customEstimate}
                  onChange={(event) => setCustomEstimate(event.target.value)}
                  placeholder="Custom minutes"
                  className="h-8 bg-[var(--paper)] text-sm"
                />
                <Button type="button" size="sm" variant="outline" onClick={handleEstimateSubmit}>
                  Save
                </Button>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCustomEstimate("");
                    dispatch({
                      type: "set-todo-estimated-minutes",
                      date,
                      todoId: todo.id,
                      estimatedMinutes: null,
                    });
                    setIsEstimateEditorOpen(false);
                  }}
                >
                  Clear
                </Button>
              </div>
          </PopoverContent>
        </li>
      </Popover>

      <AlertDialog open={isStatusConfirmOpen} onOpenChange={setIsStatusConfirmOpen}>
        <AlertDialogContent className="alert-dialog-content">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold text-[var(--ink-900)]">
              Change task status?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--ink-700)]">
              {pendingStatusMeta
                ? `This will update "${todo.text}" to ${pendingStatusMeta.label.toLowerCase()}.`
                : "Confirm the next status for this task."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="alert-dialog-cancel"
              onClick={() => setPendingStatus(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                if (pendingStatus) {
                  handleStatusChange(pendingStatus, event.currentTarget);
                }
                setPendingStatus(null);
                setIsStatusConfirmOpen(false);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sub-tasks rendering */}
      {subtasks.length > 0 && !isSubtasksCollapsed && (
        <ul className="subtask-list">
          {subtasks.map((subtodo) => (
            <EditableTaskItem
              key={subtodo.id}
              todo={subtodo}
              date={date}
              dispatch={dispatch}
              onCelebrate={onCelebrate}
              onRequestFocus={onRequestFocus}
            />
          ))}
        </ul>
      )}

      {/* Inline Sub-task Input */}
      {showSubtaskComposer && !isSubtasksCollapsed ? (
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
  onRequestFocus,
  dropIndicatorPosition,
}: {
  todo: import("@/lib/types").Todo;
  date: string;
  subtasks: import("@/lib/types").Todo[];
  dispatch: Dispatch<AppAction>;
  onCelebrate?: (target: HTMLElement) => void;
  onRequestFocus?: (todoId: string) => void;
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
        onRequestFocus={onRequestFocus}
        dragSurfaceProps={{ ...attributes, ...listeners }}
        dropIndicatorPosition={dropIndicatorPosition}
      />
    </div>
  );
}

export function TodosView({ state, dispatch }: Props) {
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
  const [renderDate, setRenderDate] = useState(date);
  const [isLoadingDate, setIsLoadingDate] = useState(false);

  if (date !== renderDate) {
    setRenderDate(date);
    setIsLoadingDate(true);
  }

  useEffect(() => {
    if (isLoadingDate) {
      const timer = setTimeout(() => setIsLoadingDate(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isLoadingDate]);

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

  useEffect(() => {
    if (state.uiState.focusTimerStatus !== "running") {
      return;
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: "tick-focus-timer" });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dispatch, state.uiState.focusTimerStatus]);

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

  const requestFocusForTodo = (todoId: string) => {
    if (
      state.uiState.focusTimerStatus === "running" &&
      state.uiState.focusedTodoId &&
      state.uiState.focusedTodoId !== todoId &&
      typeof window !== "undefined" &&
      !window.confirm("A timer is already running. Switch focus and leave the current countdown?")
    ) {
      return;
    }

    dispatch({ type: "set-focus-mode", isFocus: true, todoId });
  };

  const enterFocusMode = () => {
    const fallbackTodo =
      page?.todos.find((todo) => !todo.parentId && todo.status !== "finished") ??
      page?.todos.find((todo) => !todo.parentId) ??
      null;

    dispatch({
      type: "set-focus-mode",
      isFocus: !state.uiState.isFocusMode,
      todoId: state.uiState.isFocusMode
        ? null
        : state.uiState.focusedTodoId ?? fallbackTodo?.id ?? null,
    });
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
    const focusedTodo =
      page.todos.find((t) => t.id === focusedTodoId) ??
      page.todos.find((t) => !t.parentId && t.status !== "finished") ??
      page.todos.find((t) => !t.parentId) ??
      null;

    if (!focusedTodo) {
      return (
        <section className="flex h-full w-full flex-col items-center justify-center bg-[var(--paper)] p-8 text-center">
          <Target className="mb-4 h-12 w-12 text-[var(--brand)] opacity-50" />
          <h2 className="mb-2 text-xl font-semibold text-[var(--ink-900)]">Focus Mode</h2>
          <p className="mb-6 max-w-md text-[var(--ink-700)]">
            You have no tasks to focus on today. Add some tasks first.
          </p>
          <Button
            type="button"
            onClick={() => dispatch({ type: "set-focus-mode", isFocus: false })}
          >
            Exit Focus Mode
          </Button>
        </section>
      );
    }

    const subtasks = page.todos.filter((t) => t.parentId === focusedTodo.id);
    const meta = getPriorityMeta(state.uiState.categoryTheme, focusedTodo.priority);
    const timerRemainingSeconds =
      state.uiState.focusedTodoId === focusedTodo.id
        ? state.uiState.focusTimerRemainingSeconds ??
          (focusedTodo.estimatedMinutes ? focusedTodo.estimatedMinutes * 60 : null)
        : focusedTodo.estimatedMinutes
          ? focusedTodo.estimatedMinutes * 60
          : null;
    const hasEstimate = focusedTodo.estimatedMinutes !== null;
    const isTimerPromptOpen =
      state.uiState.focusedTodoId === focusedTodo.id &&
      state.uiState.isFocusTimerCompletionPromptOpen;
    const isTimerRunning =
      state.uiState.focusedTodoId === focusedTodo.id && state.uiState.focusTimerStatus === "running";
    const isTimerPaused =
      state.uiState.focusedTodoId === focusedTodo.id && state.uiState.focusTimerStatus === "paused";

    return (
      <section className="flex h-full w-full flex-col items-center justify-start overflow-y-auto bg-[var(--paper)]">
        <div className="flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
          <div className="rounded-[28px] border border-[var(--line)] bg-[var(--paper-strong)] p-8 text-center shadow-[0_1px_3px_rgba(31,36,48,0.06),0_1px_2px_rgba(31,36,48,0.04)]">
            <Badge
              className="mb-4 text-[13px] px-3 py-1"
              style={{
                backgroundColor: `var(${meta.softVar})`,
                color: `var(${meta.accentVar})`,
                borderColor: `color-mix(in srgb, var(${meta.accentVar}) 30%, transparent)`,
              }}
            >
              {meta.label}
            </Badge>
            <h1 className="mb-4 text-4xl font-semibold leading-tight tracking-tight text-[var(--ink-900)]">
              {focusedTodo.text}
            </h1>
            <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-sm text-[var(--ink-700)]">
              <span className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1">
                {STATUS_META[focusedTodo.status].label}
              </span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1">
                Estimate: {formatEstimate(focusedTodo.estimatedMinutes)}
              </span>
            </div>

            <div className="mx-auto mb-6 flex w-full max-w-sm flex-col rounded-[24px] border border-[var(--line)] bg-[var(--paper)] p-5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-700)]">
                Remaining Time
              </span>
              <span className="font-mono text-5xl font-semibold tracking-tight text-[var(--ink-900)]">
                {formatTimer(timerRemainingSeconds)}
              </span>
              <span className="mt-2 text-sm text-[var(--ink-700)]">
                {isTimerRunning
                  ? "Timer running"
                  : isTimerPaused
                    ? "Timer paused"
                    : hasEstimate
                      ? "Ready to start"
                      : "Set an estimate to begin"}
              </span>
            </div>

            {!hasEstimate ? (
              <div className="mb-6">
                <p className="mb-3 text-sm text-[var(--ink-700)]">
                  Pick an estimate to start this countdown.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {ESTIMATE_PRESETS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "set-todo-estimated-minutes",
                          date,
                          todoId: focusedTodo.id,
                          estimatedMinutes: minutes,
                        })
                      }
                      className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-sm font-medium text-[var(--ink-700)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]"
                    >
                      {minutes}m
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isTimerRunning ? (
                <Button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "start-focus-timer",
                      date,
                      todoId: focusedTodo.id,
                      estimateMinutes: focusedTodo.estimatedMinutes,
                    })
                  }
                  disabled={!hasEstimate}
                >
                  <Play className="h-4 w-4" />
                  {isTimerPaused ? "Resume" : "Start"}
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => dispatch({ type: "pause-focus-timer" })}>
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => dispatch({ type: "reset-focus-timer" })}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={(event) => {
                  if (focusedTodo.status !== "finished") {
                    triggerCompletionConfettiFromElement(event.currentTarget);
                  }
                  dispatch({
                    type: "set-todo-status",
                    date,
                    todoId: focusedTodo.id,
                    status: "finished",
                  });
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Finished
              </Button>
            </div>

            {isTimerPromptOpen ? (
              <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 text-left">
                <p className="text-sm font-semibold text-[var(--ink-900)]">Time is up.</p>
                <p className="mt-1 text-sm text-[var(--ink-700)]">
                  Decide whether to finish this task, add more time, or keep it ongoing without a running timer.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={(event) => {
                      triggerCompletionConfettiFromElement(event.currentTarget);
                      dispatch({ type: "resolve-focus-timer-complete", resolution: "finish" });
                    }}
                  >
                    Finish Task
                  </Button>
                  {ESTIMATE_PRESETS.slice(0, 3).map((minutes) => (
                    <Button
                      key={minutes}
                      type="button"
                      variant="outline"
                      onClick={() =>
                        dispatch({
                          type: "resolve-focus-timer-complete",
                          resolution: "add-time",
                          extraMinutes: minutes,
                        })
                      }
                    >
                      Add {minutes}m
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      dispatch({
                        type: "resolve-focus-timer-complete",
                        resolution: "keep-ongoing",
                      })
                    }
                  >
                    Keep Ongoing
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] p-6 shadow-[0_1px_3px_rgba(31,36,48,0.06),0_1px_2px_rgba(31,36,48,0.04)]">
            <h3 className="mb-4 text-[15px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-900)]">
              Sub-tasks
            </h3>
            <ul className="flex w-full flex-col gap-2">
              {subtasks.length === 0 ? (
                <li className="text-[15px] italic text-[var(--ink-700)]">No sub-tasks.</li>
              ) : (
                subtasks.map((subtodo) => (
                  <EditableTaskItem
                    key={subtodo.id}
                    todo={subtodo}
                    date={date}
                    dispatch={dispatch}
                    onCelebrate={triggerCompletionConfettiFromElement}
                    onRequestFocus={requestFocusForTodo}
                  />
                ))
              )}
            </ul>
            <div className="mt-4 border-t border-[var(--line)] pt-4">
              <InlineTaskInput
                date={date}
                priority={focusedTodo.priority}
                meta={{ ...meta, placeholder: "Add a sub-task..." }}
                dispatch={(action) => {
                  if (action.type === "add-todo") {
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
            <h2 className="text-2xl font-semibold text-[var(--ink-900)] tracking-tight">
              {getDayLabel(date)}
            </h2>
          </div>
        </div>
        <div className="editor-layer">
          {isLoadingDate ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--brand)]"></div>
            </div>
          ) : (
            <MarkdownEditor
              key={date}
              value={page.markdown}
              onChange={(markdown) =>
                dispatch({ type: "update-daily-markdown", date, markdown })
              }
            />
          )}
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
            <h2 className="text-xl font-semibold text-[var(--ink-900)] leading-[1.35]">Todos</h2>
            <p className="text-xs text-[var(--ink-700)]">Plan the day from here.</p>
          </div>

          <div className="todo-pane-actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={enterFocusMode}
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
                            onRequestFocus={requestFocusForTodo}
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
