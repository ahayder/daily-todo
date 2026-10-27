import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/store";
import type { AppState, MemoryData } from "@/lib/types";
import { applyMemoryAction } from "./app-actions";
import { undoChange } from "./app-history";
import { emptyMemoryData } from "./data";
import { createDecision, logDecision } from "./decisions";
import { createFollowUp } from "./follow-ups";
import { createMeeting } from "./meetings";
import {
  decisionLog,
  decisionTags,
  nextStepTask,
  projectGroups,
  projectHref,
  projectView,
  waitingByPerson,
} from "./memory-screen";
import { duePings } from "./pings";
import { createProject } from "./projects";
import { createRepeat } from "./repeats";
import { createTask, type TodayView } from "./tasks";

const NOW = new Date("2026-10-27T05:00:00.000Z");
const TODAY = "2026-10-27";
const map = <T extends { id: string }>(...items: T[]) => Object.fromEntries(items.map((item) => [item.id, item]));

function sample() {
  const velox = createProject({ name: "Velox", area: "job", state: "Fix list", nextStep: "Stop the pop-up" }, NOW)!;
  const paused = { ...createProject({ name: "Old idea" }, NOW)!, status: "paused" as const };
  const old = createDecision({ title: "Three videos a week", status: "yours", tags: ["youtube"], decidedOn: "2026-10-08" }, NOW)!;
  const chain = logDecision(map(old), { title: "Two videos a week", status: "yours", tags: ["youtube"], replacesId: old.id, decidedOn: "2026-10-23" }, NOW);
  const compare = createDecision({ title: "Use a compare link", status: "agreed", projectId: velox.id, tags: ["velox"], decidedOn: "2026-10-26" }, NOW)!;
  const popup = createTask({ title: "Stop the pop-up", projectId: velox.id, day: TODAY, whyDecisionId: compare.id }, NOW)!;
  const shelf = createTask({ title: "Markdown in comments", projectId: velox.id }, NOW)!;
  const gym = createRepeat({ title: "Gym", days: ["mon", "wed", "fri"], whyDecisionId: chain.created!.id }, NOW)!;
  const hosting = createFollowUp({ what: "Hosting instructions", who: "Brian", since: "2026-10-09", projectId: velox.id }, NOW)!;
  const review = createFollowUp({ what: "Review date", who: "Brian", since: "2026-10-14" }, NOW)!;
  const standup = createMeeting({ title: "Standup", date: "2026-10-26", projectId: velox.id, summary: "Agreed the compare link" }, NOW)!;
  const memory: MemoryData = {
    ...emptyMemoryData(),
    project: map(velox, paused),
    decision: { ...chain.decisions, [compare.id]: compare },
    task: map(popup, shelf),
    repeat: map(gym),
    follow_up: map(hosting, review),
    meeting: map(standup),
  };
  return { memory, velox, compare, popup, shelf, hosting, old };
}

describe("memory screen", () => {
  it("groups projects and links to them", () => {
    const { memory, velox } = sample();
    const groups = projectGroups(memory);
    expect(groups.active.map((project) => project.name)).toEqual(["Velox"]);
    expect(groups.other.map((project) => project.name)).toEqual(["Old idea"]);
    expect(projectHref(velox.id)).toBe(`/memory/project?id=${velox.id}`);
  });

  it("lists decisions newest first, keeps replaced ones and shows their links", () => {
    const { memory } = sample();
    const log = decisionLog(memory);
    expect(log.map((item) => item.decision.title)).toEqual(["Use a compare link", "Two videos a week", "Three videos a week"]);
    expect(log[0].links).toEqual(["1 open task"]);
    expect(log[1].links).toEqual(["Repeats Mon/Wed/Fri"]);
    expect(log[2].replacedBy).toBe("Two videos a week");
    expect(decisionLog(memory, { tag: "velox" })).toHaveLength(1);
    expect(decisionTags(memory)).toEqual(["velox", "youtube"]);
  });

  it("groups who the user is waiting on, longest first", () => {
    const { memory } = sample();
    expect(waitingByPerson(memory, TODAY)).toEqual([
      { who: "Brian", items: [expect.objectContaining({ what: "Hosting instructions", daysWaiting: 18 }), expect.objectContaining({ daysWaiting: 13 })] },
    ]);
  });

  it("builds the project view with tasks, decisions, waiting, meetings and the next-step task", () => {
    const { memory, velox } = sample();
    const view = projectView({ memory, changeLog: {}, preset: null, projectId: velox.id, today: TODAY })!;
    expect(view.open.map((task) => [task.title, task.where])).toEqual([
      ["Stop the pop-up", "On Today"],
      ["Markdown in comments", "On the Shelf"],
    ]);
    expect(view.decisions.map((item) => item.decision.title)).toEqual(["Use a compare link"]);
    expect(view.waiting[0].items.map((item) => item.what)).toEqual(["Hosting instructions"]);
    expect(view.meetings.map((meeting) => meeting.title)).toEqual(["Standup"]);
    expect(nextStepTask(view)?.title).toBe("Stop the pop-up");
    expect(projectView({ memory, changeLog: {}, preset: null, projectId: "missing", today: TODAY })).toBeNull();
  });

  it("logs project, follow-up and decision edits with undo, and shows them on the project timeline", () => {
    const { memory, velox, hosting, compare } = sample();
    const base = createInitialState(TODAY);
    let state: AppState = { ...base, memory };
    state = applyMemoryAction(state, { type: "memory-update-project", projectId: velox.id, updates: { nextStep: "Ship it" } }, NOW);
    state = applyMemoryAction(state, { type: "memory-resolve-follow-up", followUpId: hosting.id }, NOW);
    state = applyMemoryAction(state, { type: "memory-set-decision-status", decisionId: compare.id, status: "proposed" }, NOW);
    expect(state.memory.project[velox.id].nextStep).toBe("Ship it");
    expect(state.memory.follow_up[hosting.id].status).toBe("done");
    expect(state.memory.decision[compare.id].status).toBe("proposed");

    const view = projectView({ memory: state.memory, changeLog: state.changeLog, preset: null, projectId: velox.id, today: TODAY })!;
    expect(view.timeline).toHaveLength(3);
    expect(view.timeline.every((item) => item.who === "You")).toBe(true);

    const followUpChange = Object.values(state.changeLog).find((entry) => entry.entityId === hosting.id)!;
    const undone = undoChange(state, followUpChange.id);
    expect(undone.memory.follow_up[hosting.id].status).toBe("waiting");
    const reopened = applyMemoryAction(state, { type: "memory-reopen-follow-up", followUpId: hosting.id }, NOW);
    expect(reopened.memory.follow_up[hosting.id]).toMatchObject({ status: "waiting", doneAt: null });
  });
});

describe("pings", () => {
  const task = createTask({ title: "Compare link", day: TODAY }, NOW)!;
  const view = (date = TODAY): TodayView => ({
    date,
    blocks: [
      { id: "deep", title: "Deep work", start: "09:00", end: "11:00", tasks: [task] },
      { id: "lunch", title: "Lunch", start: "12:00", end: "13:00", tasks: [] },
      { id: "early", title: "Gym", start: "07:00", end: "08:00", tasks: [task] },
    ],
    today: [],
    repeats: [],
    shelf: [],
    leftovers: [],
  });
  const at = (hours: number, minutes = 0) => hours * 60 + minutes;
  const none = new Set<string>();

  it("pings when a block with a task starts, and for standup ten minutes early", () => {
    expect(duePings({ view: view(), minutes: at(9, 1), sent: none, appFocused: false })).toEqual([
      { id: `block:${TODAY}:deep`, title: "Deep work starts now", body: "Compare link" },
    ]);
    expect(duePings({ view: view(), minutes: at(15, 50), sent: none, appFocused: false })[0].id).toBe(`standup:${TODAY}`);
  });

  it("stays quiet for free blocks, outside work hours, on weekends, when sent, or while the app is in front", () => {
    expect(duePings({ view: view(), minutes: at(12), sent: none, appFocused: false })).toEqual([]);
    expect(duePings({ view: view(), minutes: at(7), sent: none, appFocused: false })).toEqual([]);
    expect(duePings({ view: view("2026-10-31"), minutes: at(9), sent: none, appFocused: false })).toEqual([]);
    expect(duePings({ view: view(), minutes: at(9), sent: new Set([`block:${TODAY}:deep`]), appFocused: false })).toEqual([]);
    expect(duePings({ view: view(), minutes: at(9), sent: none, appFocused: true })).toEqual([]);
    expect(duePings({ view: view(), minutes: at(9, 5), sent: none, appFocused: false })).toEqual([]);
  });
});
