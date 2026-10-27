import type { ChangeLogEntry, Decision, FollowUp, MemoryData, MemoryRecordBase, Meeting, Project, Task } from "@/lib/types";
import { daysBetween } from "./dates";
import { currentDecisions } from "./decisions";
import { describeChange, sourceLabel } from "./history-view";
import { liveRecords } from "./records";
import { plannerEventsForDay } from "./tasks";
import type { PlannerPreset } from "@/lib/types";

/** Pure view models for the Memory, Project and Standup pages. */

export function projectHref(projectId: string): string {
  return `/memory/project?id=${encodeURIComponent(projectId)}`;
}

const byName = (left: Project, right: Project) => left.name.localeCompare(right.name);

/** Active projects first (by name), then paused and done. */
export function projectGroups(memory: MemoryData): { active: Project[]; other: Project[] } {
  const projects = liveRecords(memory.project);
  return {
    active: projects.filter((project) => project.status === "active").toSorted(byName),
    other: projects.filter((project) => project.status !== "active").toSorted(byName),
  };
}

export type DecisionItem = {
  decision: Decision;
  /** Title of the decision that replaced this one. */
  replacedBy: string | null;
  project: Project | null;
  /** e.g. "1 task", "Repeats Mon/Wed/Fri". */
  links: string[];
};

const DAY_WORDS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function decisionDay(decision: Decision): string {
  return decision.decidedOn ?? decision.createdAt.slice(0, 10);
}

/**
 * The decisions log, newest first. Replaced decisions stay (struck through in
 * the UI) so the user can see what they changed their mind about.
 */
export function decisionLog(memory: MemoryData, options: { tag?: string; projectId?: string } = {}): DecisionItem[] {
  const decisions = memory.decision;
  const tasks = liveRecords(memory.task);
  const repeats = liveRecords(memory.repeat);
  return liveRecords(decisions)
    .filter((decision) => !options.tag || decision.tags.includes(options.tag))
    .filter((decision) => !options.projectId || decision.projectId === options.projectId)
    .toSorted((left, right) => decisionDay(right).localeCompare(decisionDay(left)) || right.createdAt.localeCompare(left.createdAt))
    .map((decision) => {
      const taskCount = tasks.filter((task) => task.whyDecisionId === decision.id && task.status === "open").length;
      const links = [
        ...(taskCount ? [taskCount === 1 ? "1 open task" : `${taskCount} open tasks`] : []),
        ...repeats
          .filter((repeat) => repeat.whyDecisionId === decision.id && repeat.active)
          .map((repeat) => `Repeats ${repeat.days.map((day) => DAY_WORDS[day]).join("/")}`),
      ];
      return {
        decision,
        replacedBy: decision.replacedById ? (decisions[decision.replacedById]?.title ?? null) : null,
        project: decision.projectId ? (memory.project[decision.projectId] ?? null) : null,
        links,
      };
    });
}

/** Tags used by decisions, most used first. */
export function decisionTags(memory: MemoryData): string[] {
  const counts = new Map<string, number>();
  for (const decision of currentDecisions(memory.decision)) {
    for (const tag of decision.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].toSorted((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([tag]) => tag);
}

export type WaitingItem = FollowUp & { daysWaiting: number };

/** Open follow-ups grouped by person, longest waiting first. */
export function waitingByPerson(
  memory: MemoryData,
  today: string,
  options: { projectId?: string } = {},
): { who: string; items: WaitingItem[] }[] {
  const groups = new Map<string, WaitingItem[]>();
  const items = liveRecords(memory.follow_up)
    .filter((item) => item.status === "waiting")
    .filter((item) => !options.projectId || item.projectId === options.projectId)
    .map((item) => ({ ...item, daysWaiting: item.since ? Math.max(0, daysBetween(item.since, today)) : 0 }))
    .toSorted((left, right) => right.daysWaiting - left.daysWaiting);
  for (const item of items) {
    const who = item.who || "Someone";
    groups.set(who, [...(groups.get(who) ?? []), item]);
  }
  return [...groups].map(([who, list]) => ({ who, items: list }));
}

export type ProjectTask = Task & {
  /** "On Today · 09:00 Deep work", "On the Shelf", "Planned for Thu 29 Oct". */
  where: string;
  daysWaiting: number;
  onToday: boolean;
};

function shortDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

export type TimelineItem = { id: string; at: string; text: string; who: string };

export type ProjectView = {
  project: Project;
  open: ProjectTask[];
  done: Task[];
  decisions: DecisionItem[];
  waiting: { who: string; items: WaitingItem[] }[];
  meetings: Meeting[];
  timeline: TimelineItem[];
};

/** Everything the Project page shows for one project, or null when it doesn't exist. */
export function projectView(input: {
  memory: MemoryData;
  changeLog: Record<string, ChangeLogEntry>;
  preset: PlannerPreset | null;
  projectId: string;
  today: string;
}): ProjectView | null {
  const { memory, projectId, today } = input;
  const project = memory.project[projectId];
  if (!project || project.deletedAt) return null;
  const tasks = liveRecords(memory.task).filter((task) => task.projectId === projectId);
  const blocks = plannerEventsForDay(input.preset, today);

  const open = tasks
    .filter((task) => task.status === "open")
    .map((task): ProjectTask => {
      const onToday = task.day === today;
      const block = onToday && task.blockId ? blocks.find((event) => event.id === task.blockId) : undefined;
      let where = "On the Shelf";
      if (onToday) where = block ? `On Today · ${block.title || "time block"}` : "On Today";
      else if (task.day && task.day > today) where = `Planned for ${shortDay(task.day)}`;
      else if (task.day) where = "Waiting from an earlier day";
      return { ...task, where, onToday, daysWaiting: task.day && task.day < today ? daysBetween(task.day, today) : 0 };
    })
    .toSorted((left, right) => Number(right.onToday) - Number(left.onToday) || left.createdAt.localeCompare(right.createdAt));

  // The project's own changes plus changes to records that belong to it.
  const ownIds = new Set<string>([projectId]);
  for (const kind of ["task", "decision", "meeting", "follow_up", "repeat"] as const) {
    for (const record of liveRecords(memory[kind] as Record<string, MemoryRecordBase & { projectId: string | null }>)) {
      if (record.projectId === projectId) ownIds.add(record.id);
    }
  }
  const timeline = Object.values(input.changeLog)
    .filter((entry) => entry.action !== "undo" && entry.action !== "redo" && ownIds.has(entry.entityId))
    .toSorted((left, right) => right.id.localeCompare(left.id))
    .slice(0, 20)
    .map((entry) => ({ id: entry.id, at: entry.at, text: describeChange(entry), who: sourceLabel(entry.source) }));

  return {
    project,
    open,
    done: tasks
      .filter((task) => task.status === "done")
      .toSorted((left, right) => (right.doneAt ?? "").localeCompare(left.doneAt ?? ""))
      .slice(0, 10),
    decisions: decisionLog(memory, { projectId }).filter((item) => item.replacedBy === null),
    waiting: waitingByPerson(memory, today, { projectId }),
    meetings: liveRecords(memory.meeting)
      .filter((meeting) => meeting.projectId === projectId)
      .toSorted((left, right) => right.date.localeCompare(left.date)),
    timeline,
  };
}

/** The open task that matches the project's next step, if one exists. */
export function nextStepTask(view: ProjectView): ProjectTask | null {
  const step = view.project.nextStep.trim().toLowerCase();
  if (!step) return null;
  return view.open.find((task) => task.title.trim().toLowerCase() === step) ?? null;
}
