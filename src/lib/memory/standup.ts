import type { Decision, FollowUp, LifeArea, Project, Task } from "@/lib/types";
import type { MemoryData } from "./data";
import { addDays, dayInZone, weekdayOf } from "./dates";
import { liveRecords } from "./records";
import { currentDecisions } from "./decisions";

export type StandupAgenda = {
  date: string;
  since: string;
  whatIDid: { tasks: Task[]; decisions: Decision[] };
  today: Task[];
  waitingOnOthers: { who: string; items: FollowUp[] }[];
  openProposals: Decision[];
  next: { project: string; nextStep: string }[];
};

/** The workday before `day` (skips Saturday and Sunday). */
export function previousWorkday(day: string): string {
  let previous = addDays(day, -1);
  while (weekdayOf(previous) === "sat" || weekdayOf(previous) === "sun") previous = addDays(previous, -1);
  return previous;
}

/**
 * The standup agenda for `date`: what was done since the last standup, what's
 * on today, who the user is waiting on, open proposals, and each project's
 * next step. `area` (default "job") keeps it to one life area; "all" = no filter.
 */
export function buildStandupAgenda(
  date: string,
  data: MemoryData,
  options: { since?: string; timeZone: string; area?: LifeArea | "all" },
): StandupAgenda {
  const since = options.since ?? previousWorkday(date);
  const area = options.area ?? "job";
  const projects = data.project;
  const inArea = (record: { area?: LifeArea | null; projectId: string | null }) => {
    if (area === "all") return true;
    const projectArea = record.projectId ? projects[record.projectId]?.area : null;
    // Records without any area (no own area, no project area) are kept.
    const recordArea = record.area ?? projectArea ?? null;
    return recordArea === null || recordArea === area;
  };
  const tasks = liveRecords(data.task).filter(inArea);
  const waiting = liveRecords(data.follow_up).filter((item) => item.status === "waiting" && inArea(item));
  const byPerson = new Map<string, FollowUp[]>();
  for (const item of waiting) byPerson.set(item.who || "Someone", [...(byPerson.get(item.who || "Someone") ?? []), item]);
  const decisions = currentDecisions(data.decision).filter(inArea);

  return {
    date,
    since,
    whatIDid: {
      tasks: tasks.filter((task) => {
        if (task.status !== "done" || !task.doneAt) return false;
        const doneDay = dayInZone(task.doneAt, options.timeZone);
        return doneDay >= since && doneDay <= date;
      }),
      decisions: decisions.filter((decision) => {
        const day = decision.decidedOn ?? dayInZone(decision.createdAt, options.timeZone);
        return decision.status === "agreed" && day >= since && day <= date;
      }),
    },
    today: tasks.filter((task) => task.status === "open" && task.day !== null && task.day <= date),
    waitingOnOthers: [...byPerson].map(([who, items]) => ({ who, items })),
    openProposals: decisions.filter((decision) => decision.status === "proposed"),
    next: liveRecords(projects)
      .filter((project: Project) => project.status === "active" && project.nextStep && (area === "all" || project.area === null || project.area === area))
      .map((project) => ({ project: project.name, nextStep: project.nextStep })),
  };
}
