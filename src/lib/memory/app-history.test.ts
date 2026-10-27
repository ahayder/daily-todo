import { describe, expect, it } from "vitest";
import { buildChange } from "@/lib/change-log";
import { createInitialState } from "@/lib/store";
import type { AppState, ChangeLogEntry } from "@/lib/types";
import { applyMemoryAction } from "./app-actions";
import { changeStatus, checkRedo, checkUndo, redoChange, undoChange, writeWithHistory } from "./app-history";
import { createRepeat } from "./repeats";
import { createTask } from "./tasks";
import { buildHistory, describeChange, sourceLabel } from "./history-view";

const NOW = new Date("2026-10-27T05:00:00.000Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

function stateWithTask() {
  const base = createInitialState("2026-10-27");
  const task = createTask({ title: "Send link" }, NOW)!;
  return { state: { ...base, memory: { ...base.memory, task: { [task.id]: task } } } as AppState, task };
}

const entries = (state: AppState) => Object.values(state.changeLog).toSorted((a, b) => a.id.localeCompare(b.id));

describe("app edits with history", () => {
  it("logs one app change per action and skips no-op writes", () => {
    const { state, task } = stateWithTask();
    const planned = applyMemoryAction(state, { type: "memory-schedule-task", taskId: task.id, day: "2026-10-27" }, NOW);
    expect(planned.memory.task[task.id].day).toBe("2026-10-27");
    expect(entries(planned)).toHaveLength(1);
    expect(entries(planned)[0]).toMatchObject({ source: "app", action: "update", entityKind: "task" });

    const again = applyMemoryAction(planned, { type: "memory-schedule-task", taskId: task.id, day: "2026-10-27" });
    expect(again).toBe(planned);
  });

  it("undoes a change, brings it back, and tracks its status", () => {
    const { state, task } = stateWithTask();
    const done = applyMemoryAction(state, { type: "memory-complete-task", taskId: task.id }, NOW);
    const changeId = entries(done)[0].id;
    expect(changeStatus(done, changeId)).toBe("live");

    const undone = undoChange(done, changeId, { now: later(1) });
    expect(undone.memory.task[task.id].status).toBe("open");
    expect(changeStatus(undone, changeId)).toBe("undone");
    expect(entries(undone).at(-1)).toMatchObject({ action: "undo", refChangeId: changeId });

    const back = redoChange(undone, changeId, { now: later(2) });
    expect(back.memory.task[task.id].status).toBe("done");
    expect(changeStatus(back, changeId)).toBe("live");
  });

  it("undoes an AI-created task as a soft delete, never removing it", () => {
    const { state } = stateWithTask();
    const fresh = createTask({ title: "From chat", source: "chat:claude" }, NOW)!;
    const created = writeWithHistory(state, [{ kind: "task", id: fresh.id, value: fresh }], {
      source: "chat:claude",
      now: NOW,
    });
    const undone = undoChange(created, entries(created)[0].id, { now: later(1) });
    expect(undone.memory.task[fresh.id].deletedAt).toBe(later(1).toISOString());
  });

  it("refuses to undo when the record changed again since", () => {
    const { state, task } = stateWithTask();
    const done = applyMemoryAction(state, { type: "memory-complete-task", taskId: task.id }, NOW);
    const firstChange = entries(done)[0].id;
    const moved = applyMemoryAction(done, { type: "memory-schedule-task", taskId: task.id, day: "2026-10-28" }, later(1));
    const check = checkUndo(moved, firstChange);
    expect(check.ok).toBe(false);
    expect(undoChange(moved, firstChange)).toBe(moved);
    expect(checkRedo(moved, firstChange).ok).toBe(false);
  });

  it("undoes a whole batch together", () => {
    const { state, task } = stateWithTask();
    const other = createTask({ title: "Second" }, NOW)!;
    const both = writeWithHistory(
      state,
      [
        { kind: "task", id: task.id, value: { ...task, day: "2026-10-27" } },
        { kind: "task", id: other.id, value: other },
      ],
      { source: "chat:chatgpt", now: NOW },
    );
    const undone = undoChange(both, entries(both)[0].id, { now: later(1) });
    expect(undone.memory.task[task.id].day).toBeNull();
    expect(undone.memory.task[other.id].deletedAt).not.toBeNull();
  });

  it("ticks off a repeat once per day", () => {
    const base = createInitialState("2026-10-27");
    const repeat = createRepeat({ title: "Gym", days: ["tue"], time: "07:00" }, NOW)!;
    const state: AppState = { ...base, memory: { ...base.memory, repeat: { [repeat.id]: repeat } } };
    const done = applyMemoryAction(state, { type: "memory-complete-repeat", repeatId: repeat.id, day: "2026-10-27" }, NOW);
    const task = Object.values(done.memory.task)[0];
    expect(task).toMatchObject({ title: "Gym", repeatId: repeat.id, day: "2026-10-27", status: "done" });
    expect(applyMemoryAction(done, { type: "memory-complete-repeat", repeatId: repeat.id, day: "2026-10-27" })).toBe(
      done,
    );
  });
});

describe("history view", () => {
  const change = (entry: Partial<ChangeLogEntry>) =>
    buildChange({ batchId: "b", entityKind: "task", entityId: "t", before: null, after: null, source: "app", ...entry });

  it("describes changes in plain words", () => {
    const task = { title: "Send link", status: "open", day: null, blockId: null, deletedAt: null };
    expect(describeChange(change({ before: null, after: task }))).toBe("Added task “Send link”");
    expect(describeChange(change({ before: task, after: { ...task, status: "done" } }))).toBe("Finished “Send link”");
    expect(describeChange(change({ before: task, after: { ...task, day: "2026-10-27" } }))).toBe(
      "Planned “Send link” for Tue 27 Oct",
    );
    expect(describeChange(change({ before: { ...task, day: "2026-10-27" }, after: task }))).toBe(
      "Moved “Send link” to the Shelf",
    );
    expect(describeChange(change({ before: task, after: { ...task, notes: "x", blockId: null } }))).toBe(
      "Changed the notes of task “Send link”",
    );
    expect(describeChange(change({ before: task, after: { ...task, deletedAt: "x" } }))).toBe(
      "Deleted task “Send link”",
    );
  });

  it("labels who made a change", () => {
    expect(sourceLabel("app")).toBe("You");
    expect(sourceLabel("chat:claude")).toBe("Claude");
    expect(sourceLabel("chat:chatgpt")).toBe("ChatGPT");
    expect(sourceLabel("chat")).toBe("An AI chat");
  });

  it("shows one row per batch, hides undo entries, and groups by the user's day", () => {
    const { state, task } = stateWithTask();
    const done = applyMemoryAction(state, { type: "memory-complete-task", taskId: task.id }, NOW);
    const undone = undoChange(done, entries(done)[0].id, { now: later(1) });
    const days = buildHistory(undone, "Asia/Dhaka");
    expect(days).toHaveLength(1);
    expect(days[0].day).toBe("2026-10-27");
    expect(days[0].rows).toHaveLength(1);
    expect(days[0].rows[0]).toMatchObject({ who: "You", text: "Finished “Send link”", status: "undone" });
  });
});
