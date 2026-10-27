import type { AppState } from "@/lib/types";
import { memoryWrites, redoChange, undoChange, writeWithHistory } from "./app-history";
import { liveRecords } from "./records";
import { completeTask, createTask, reopenTask, scheduleTask } from "./tasks";

/**
 * External-brain edits made in the app. Each one is one batch in the change
 * log (source "app"), so History shows it and it can be undone.
 */
export type MemoryAction =
  | { type: "memory-add-task"; title: string; day: string | null; blockId?: string | null }
  /** day null = back to the Shelf ("Not now"). */
  | { type: "memory-schedule-task"; taskId: string; day: string | null; blockId?: string | null }
  | { type: "memory-complete-task"; taskId: string }
  | { type: "memory-reopen-task"; taskId: string }
  /** Ticks off today's repeat by creating its real (done) task row. */
  | { type: "memory-complete-repeat"; repeatId: string; day: string }
  | { type: "undo-change"; changeId: string }
  | { type: "redo-change"; changeId: string };

export const MEMORY_ACTION_TYPES = new Set<MemoryAction["type"]>([
  "memory-add-task",
  "memory-schedule-task",
  "memory-complete-task",
  "memory-reopen-task",
  "memory-complete-repeat",
  "undo-change",
  "redo-change",
]);

export function isMemoryAction(action: { type: string }): action is MemoryAction {
  return MEMORY_ACTION_TYPES.has(action.type as MemoryAction["type"]);
}

function withTasks(state: AppState, tasks: AppState["memory"]["task"], now: Date): AppState {
  return writeWithHistory(state, memoryWrites("task", state.memory.task, tasks), { now });
}

export function applyMemoryAction(state: AppState, action: MemoryAction, now = new Date()): AppState {
  const tasks = state.memory.task;
  switch (action.type) {
    case "memory-add-task": {
      const task = createTask({ title: action.title, day: action.day, blockId: action.blockId, source: "app" }, now);
      return task ? withTasks(state, { ...tasks, [task.id]: task }, now) : state;
    }
    case "memory-schedule-task":
      return withTasks(state, scheduleTask(tasks, action.taskId, { day: action.day, blockId: action.blockId }, now), now);
    case "memory-complete-task":
      return withTasks(state, completeTask(tasks, action.taskId, now), now);
    case "memory-reopen-task":
      return withTasks(state, reopenTask(tasks, action.taskId, now), now);
    case "memory-complete-repeat": {
      const repeat = state.memory.repeat[action.repeatId];
      if (!repeat || repeat.deletedAt) return state;
      const alreadyDone = liveRecords(tasks).some((task) => task.repeatId === repeat.id && task.day === action.day);
      if (alreadyDone) return state;
      const task = createTask(
        {
          title: repeat.title,
          area: repeat.area,
          day: action.day,
          repeatId: repeat.id,
          projectId: repeat.projectId,
          whyDecisionId: repeat.whyDecisionId,
          tags: repeat.tags,
          source: "app",
        },
        now,
      );
      if (!task) return state;
      return withTasks(state, { ...tasks, [task.id]: { ...task, status: "done", doneAt: now.toISOString() } }, now);
    }
    case "undo-change":
      return undoChange(state, action.changeId, { now });
    case "redo-change":
      return redoChange(state, action.changeId, { now });
  }
}
