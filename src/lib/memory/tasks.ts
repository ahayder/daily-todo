import type { LifeArea, PlannerDayKey, PlannerEvent, PlannerPreset, Repeat, Task } from "@/lib/types";
import { daysBetween, minutesToTime, weekdayOf } from "./dates";
import { cleanTags, newRecordBase, patchRecord, liveRecords } from "./records";
import { repeatsForDate } from "./repeats";

export type TaskInput = {
  title: string;
  notes?: string;
  area?: LifeArea | null;
  day?: string | null;
  blockId?: string | null;
  projectId?: string | null;
  tags?: string[];
  link?: string;
  whyDecisionId?: string | null;
  repeatId?: string | null;
  contentCardId?: string | null;
  source?: string;
};

/** A new open task, or null when the title is blank. */
export function createTask(input: TaskInput, now = new Date()): Task | null {
  const title = input.title.trim();
  if (!title) return null;
  return {
    ...newRecordBase("task", input.tags, now),
    title,
    notes: input.notes?.trim() ?? "",
    area: input.area ?? null,
    status: "open",
    day: input.day ?? null,
    blockId: input.day ? (input.blockId ?? null) : null,
    projectId: input.projectId ?? null,
    link: input.link?.trim() ?? "",
    whyDecisionId: input.whyDecisionId ?? null,
    repeatId: input.repeatId ?? null,
    contentCardId: input.contentCardId ?? null,
    source: input.source ?? "app",
    doneAt: null,
  };
}

export type TaskUpdate = Partial<
  Pick<Task, "title" | "notes" | "area" | "projectId" | "tags" | "link" | "whyDecisionId" | "contentCardId">
> & {
  /** Added to the end of the notes on a new line. */
  appendNote?: string;
};

export function updateTask(
  tasks: Record<string, Task>,
  taskId: string,
  updates: TaskUpdate,
  now = new Date(),
): Record<string, Task> {
  const task = tasks[taskId];
  if (!task) return tasks;
  const { appendNote, ...rest } = updates;
  const title = rest.title?.trim();
  let notes = rest.notes ?? task.notes;
  if (appendNote?.trim()) notes = notes ? `${notes}\n${appendNote.trim()}` : appendNote.trim();
  return patchRecord(
    tasks,
    taskId,
    { ...rest, title: title || undefined, notes, tags: rest.tags ? cleanTags(rest.tags) : undefined },
    now,
  );
}

/** Put a task on a day (and optionally a time block), or on the Shelf with day null. */
export function scheduleTask(
  tasks: Record<string, Task>,
  taskId: string,
  target: { day: string | null; blockId?: string | null },
  now = new Date(),
): Record<string, Task> {
  return patchRecord(
    tasks,
    taskId,
    { day: target.day, blockId: target.day ? (target.blockId ?? null) : null },
    now,
  );
}

export function completeTask(tasks: Record<string, Task>, taskId: string, now = new Date()): Record<string, Task> {
  if (tasks[taskId]?.status === "done") return tasks;
  return patchRecord(tasks, taskId, { status: "done", doneAt: now.toISOString() }, now);
}

export function reopenTask(tasks: Record<string, Task>, taskId: string, now = new Date()): Record<string, Task> {
  if (tasks[taskId]?.status === "open") return tasks;
  return patchRecord(tasks, taskId, { status: "open", doneAt: null }, now);
}

/** Id given to a repeat shown as today's task before it has a real row. */
export function virtualRepeatTaskId(repeatId: string): string {
  return `repeat:${repeatId}`;
}

export type VirtualRepeatTask = {
  id: string;
  repeatId: string;
  title: string;
  area: LifeArea | null;
  time: string;
};

export type TodayBlock = {
  id: string;
  title: string;
  start: string;
  end: string;
  tasks: Task[];
};

export type TodayView = {
  date: string;
  /** Time blocks of the Daily Planner for this weekday, with their tasks. */
  blocks: TodayBlock[];
  /** Tasks for the day that are not in a block. */
  today: Task[];
  /** Repeats due today that are not done yet. */
  repeats: VirtualRepeatTask[];
  /** Open tasks with no day. */
  shelf: Task[];
  /** Open tasks from earlier days, with how long they have waited. */
  leftovers: (Task & { daysWaiting: number })[];
};

// The Daily Planner edits one weekday template ("monday") for Mon–Fri, plus
// Saturday and Sunday (see dayKeyForDate in src/lib/planner-now.ts).
const PLANNER_DAY_KEYS: Record<string, PlannerDayKey> = {
  mon: "monday",
  tue: "monday",
  wed: "monday",
  thu: "monday",
  fri: "monday",
  sat: "saturday",
  sun: "sunday",
};

/** The Daily Planner time blocks for a day (unsorted). */
export function plannerEventsForDay(preset: PlannerPreset | null, day: string): PlannerEvent[] {
  return preset?.days[PLANNER_DAY_KEYS[weekdayOf(day)]]?.events ?? [];
}

const byCreated = (left: Task, right: Task) => left.createdAt.localeCompare(right.createdAt);

/**
 * What the day looks like. Nothing is copied forward: open tasks from earlier
 * days stay on their day and show here as leftovers, and repeats are shown as
 * virtual tasks until one is completed (which creates a real row).
 */
export function getTodayView(input: {
  tasks: Record<string, Task>;
  repeats: Record<string, Repeat>;
  preset: PlannerPreset | null;
  date: string;
}): TodayView {
  const { date } = input;
  const tasks = liveRecords(input.tasks).toSorted(byCreated);
  const events = plannerEventsForDay(input.preset, date);
  const blocks: TodayBlock[] = events
    .toSorted((left, right) => left.startMinutes - right.startMinutes)
    .map((event) => ({
      id: event.id,
      title: event.title,
      start: minutesToTime(event.startMinutes),
      end: minutesToTime(event.endMinutes),
      tasks: tasks.filter((task) => task.day === date && task.blockId === event.id),
    }));
  const blockIds = new Set(blocks.map((block) => block.id));
  const repeatsDoneToday = new Set(
    tasks.filter((task) => task.day === date && task.repeatId).map((task) => task.repeatId),
  );

  return {
    date,
    blocks,
    today: tasks.filter((task) => task.day === date && !(task.blockId && blockIds.has(task.blockId))),
    repeats: repeatsForDate(input.repeats, date)
      .filter((repeat) => !repeatsDoneToday.has(repeat.id))
      .map((repeat) => ({
        id: virtualRepeatTaskId(repeat.id),
        repeatId: repeat.id,
        title: repeat.title,
        area: repeat.area,
        time: repeat.time,
      })),
    shelf: tasks.filter((task) => task.status === "open" && task.day === null),
    leftovers: tasks
      .filter((task) => task.status === "open" && task.day !== null && task.day < date)
      .map((task) => ({ ...task, daysWaiting: daysBetween(task.day!, date) }))
      .toSorted((left, right) => right.daysWaiting - left.daysWaiting),
  };
}
