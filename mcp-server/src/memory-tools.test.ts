import { describe, expect, it } from "vitest";
import { CONTENT_COLUMN_INBOX_ID } from "@/lib/store";
import type { ContentCard, PlannerPreset, Task } from "@/lib/types";
import { withHistory } from "./history";
import { createMemoryTestStore } from "./memory-test-store";
import * as memory from "./memory-tools";
import * as tools from "./tools";

// Tue 2026-10-27, 11:00 in Dhaka.
let clock = new Date("2026-10-27T05:00:00.000Z");
const tick = () => {
  clock = new Date(clock.getTime() + 1000);
  return clock;
};

function preset(): PlannerPreset {
  const day = (key: string) => ({ key, title: key, purposes: [], events: [] });
  const days = Object.fromEntries(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((key) => [key, day(key)]),
  ) as unknown as PlannerPreset["days"];
  days.monday.events = [
    { id: "deep", dayKey: "monday", purposeId: null, title: "Deep work", startMinutes: 540, endMinutes: 660, color: "teal", notes: "" },
  ];
  return { id: "p1", name: "My week", subtitle: "", dayOrder: [], days, createdAt: "", updatedAt: "" };
}

/** A fresh history store per "tool call", like the server does per request. */
function setup(initial: Parameters<typeof createMemoryTestStore>[0] = {}) {
  const { store, state } = createMemoryTestStore({ preset: preset(), ...initial });
  const call = (): memory.MemoryContext => ({
    store: withHistory(store, "chat:test"),
    timeZone: "Asia/Dhaka",
    source: "chat:test",
    now: tick,
  });
  const tasks = () => Object.values(state.records.task) as Task[];
  return { state, call, tasks };
}

describe("memory MCP tools", () => {
  it("logs every write through withHistory, including content and change-request saves", async () => {
    const { state, call } = setup({
      cards: [{ id: "c1", columnId: CONTENT_COLUMN_INBOX_ID, title: "Video", notes: "", order: 0, updatedAt: "x" } as ContentCard],
    });
    await memory.addTask(call(), { title: "Write intro" });
    await tools.moveCard(call().store, { card: "c1", to: "develop" });
    await tools.addChangeRequest(call().store, { text: "Bigger buttons" });
    await tools.addSeries(call().store, { title: "Desk" });
    expect(state.changes.map((change) => [change.entityKind, change.action])).toEqual([
      ["task", "create"],
      ["content_card", "update"],
      ["app_note", "create"],
      ["content_board", "update"],
    ]);
    expect(state.changes.length).toBe(state.writes.length);
    expect(state.changes.every((change) => change.source === "chat:test")).toBe(true);
  });

  it("adds, schedules into a block and completes a task", async () => {
    const { call, tasks } = setup();
    const { created } = await memory.addTask(call(), { title: "Send Brian the compare link", tags: ["Velox"] });
    expect(created).toMatchObject({ day: "shelf", tags: ["velox"] });
    await memory.scheduleTaskTool(call(), { task: "compare link", day: "today", block: "deep" });
    expect(tasks()[0]).toMatchObject({ day: "2026-10-27", blockId: "deep" });
    const today = await memory.listToday(call());
    expect(today.blocks[0].tasks.map((task) => task.title)).toEqual(["Send Brian the compare link"]);
    await memory.completeTaskTool(call(), { task: created.id! });
    expect(tasks()[0].status).toBe("done");
    await expect(memory.scheduleTaskTool(call(), { task: created.id!, day: "today", block: "lunch" })).rejects.toThrow(
      /No time blocks/,
    );
  });

  it("completes a repeat due today by creating its task row", async () => {
    const { call, tasks } = setup();
    await memory.addRepeat(call(), { title: "Standup prep", days: ["tue"], time: "15:30" });
    const before = await memory.listToday(call());
    expect(before.repeats.map((repeat) => repeat.title)).toEqual(["Standup prep"]);
    await memory.completeTaskTool(call(), { task: before.repeats[0].id });
    expect(tasks()[0]).toMatchObject({ title: "Standup prep", status: "done", day: "2026-10-27" });
    expect((await memory.listToday(call())).repeats).toEqual([]);
  });

  it("files a meeting with linked decisions, tasks and follow-ups, without the transcript by default", async () => {
    const { state, call } = setup();
    await memory.addProject(call(), { name: "Velox", area: "job" });
    const ctx = call();
    const result = await memory.fileMeeting(ctx, {
      title: "Standup",
      project: "Velox",
      summary: "Talked imports",
      people: ["Brian"],
      transcript: "raw words",
      decisions: [{ title: "Use queues", status: "agreed" }],
      tasks: [{ title: "Fix importer", day: "today" }, { title: "Write docs" }],
      follow_ups: [{ what: "API keys", who: "Brian" }],
    });
    expect(result.transcript_stored).toBe(false);
    const projectId = Object.keys(state.records.project)[0];
    const meeting = Object.values(state.records.meeting)[0] as { transcript: string; projectId: string };
    expect(meeting).toMatchObject({ transcript: "", projectId });
    expect(result.decisions[0]).toMatchObject({ source: "Meeting · Standup", project_id: projectId, people: ["Brian"] });
    expect(result.tasks.map((task) => task.project_id)).toEqual([projectId, projectId]);
    expect(result.follow_ups[0]).toMatchObject({ who: "Brian", since: "2026-10-27" });
    // One tool call = one batch.
    expect(new Set(state.changes.filter((c) => c.batchId === ctx.store.batchId).map((c) => c.entityKind))).toEqual(
      new Set(["meeting", "decision", "task", "follow_up"]),
    );

    const kept = await memory.fileMeeting(call(), { title: "1:1", summary: "s", transcript: "words", store_transcript: true });
    expect(kept.transcript_stored).toBe(true);
  });

  it("undoes a whole tool call and redoes it", async () => {
    const { state, call } = setup();
    const filed = await memory.fileMeeting(call(), {
      title: "Planning",
      summary: "s",
      tasks: [{ title: "A" }, { title: "B" }],
    });
    const changeId = state.changes.find((c) => c.batchId === filed.batch_id)!.id;
    const undone = await memory.undoChange(call(), { change: changeId });
    expect(undone.undone).toHaveLength(3);
    expect(Object.values(state.records.task).every((task) => (task as Task).deletedAt !== null)).toBe(true);
    // Nothing was removed: soft delete only.
    expect(Object.keys(state.records.task)).toHaveLength(2);
    await expect(memory.undoChange(call(), { change: changeId })).rejects.toThrow(/Can't undo/);

    const redone = await memory.redoChange(call(), { change: changeId });
    expect(redone.redone).toHaveLength(3);
    expect(Object.values(state.records.task).every((task) => (task as Task).deletedAt === null)).toBe(true);
    await expect(memory.redoChange(call(), { change: changeId })).rejects.toThrow(/Can't redo/);
  });

  it("refuses to undo when the record changed since", async () => {
    const { state, call } = setup();
    const { created } = await memory.addTask(call(), { title: "Draft" });
    await memory.scheduleTaskTool(call(), { task: created.id!, day: "today" });
    const scheduleChange = state.changes.at(-1)!;
    await memory.updateTaskTool(call(), { task: created.id!, title: "Draft v2" });
    await expect(memory.undoChange(call(), { change: scheduleChange.id })).rejects.toThrow(/changed again since/);
    // The newest change can still be undone.
    await memory.undoChange(call(), { change: state.changes.at(-1)!.id });
    expect((state.records.task[created.id!] as Task).title).toBe("Draft");
  });

  it("undoes a content card move, and lists it in the history", async () => {
    const { state, call } = setup({
      cards: [{ id: "c1", columnId: CONTENT_COLUMN_INBOX_ID, title: "Video", notes: "", order: 0, updatedAt: "x" } as ContentCard],
    });
    await tools.moveCard(call().store, { card: "c1", to: "editing" });
    const { changes } = await memory.listChanges(call());
    expect(changes[0]).toMatchObject({ kind: "content_card", summary: expect.stringContaining('video card "Video"') });
    await memory.undoChange(call(), { change: changes[0].change_id });
    expect(state.cards.c1.columnId).toBe(CONTENT_COLUMN_INBOX_ID);
  });

  it("logs a decision that replaces another, and keeps both", async () => {
    const { state, call } = setup();
    await memory.logDecisionTool(call(), { title: "Ship Friday", status: "agreed" });
    const second = await memory.logDecisionTool(call(), { title: "Ship Monday", replaces: "friday" });
    expect(second.replaced?.title).toBe("Ship Friday");
    expect(Object.keys(state.records.decision)).toHaveLength(2);
    expect((await memory.listDecisions(call())).decisions.map((d) => d.title)).toEqual(["Ship Monday"]);
    const detail = await memory.getDecision(call(), "Ship Monday");
    expect(detail.history?.map((d) => d.title)).toEqual(["Ship Friday", "Ship Monday"]);
  });

  it("builds a standup agenda and searches memory", async () => {
    const { call } = setup();
    await memory.addProject(call(), { name: "Velox", area: "job", next_step: "Ship importer" });
    await memory.addTask(call(), { title: "Send Brian the compare link", project: "Velox", day: "today" });
    await memory.addFollowUp(call(), { what: "API keys", who: "Brian", project: "Velox" });
    await memory.logDecisionTool(call(), { title: "Move standup to 16:30", project: "Velox" });
    const agenda = await memory.standupAgenda(call());
    expect(agenda.today.map((task) => task.title)).toEqual(["Send Brian the compare link"]);
    expect(agenda.waiting_on_others).toEqual([{ who: "Brian", items: [{ what: "API keys", since: "2026-10-27" }] }]);
    expect(agenda.open_proposals.map((d) => d.title)).toEqual(["Move standup to 16:30"]);
    expect(agenda.next).toEqual([{ project: "Velox", nextStep: "Ship importer" }]);

    const found = await memory.searchMemoryTool(call(), { query: "compare link" });
    expect(found.results.map((hit) => hit.label)).toEqual(["Send Brian the compare link"]);
    const project = await memory.getProject(call(), "velox");
    expect(project.open_tasks).toHaveLength(1);
    expect(project.timeline.length).toBeGreaterThan(0);
  });

  it("soft-deletes and restores tasks, and refuses to guess between titles", async () => {
    const { state, call } = setup();
    await memory.addTask(call(), { title: "Call mom" });
    await memory.addTask(call(), { title: "Call dentist" });
    await expect(memory.deleteTask(call(), { task: "call" })).rejects.toThrow(/Several tasks/);
    await memory.deleteTask(call(), { task: "call mom" });
    expect((await memory.listTasks(call())).total).toBe(1);
    expect(Object.keys(state.records.task)).toHaveLength(2);
    await memory.restoreTask(call(), { task: "call mom" });
    expect((await memory.listTasks(call())).total).toBe(2);
  });
});
