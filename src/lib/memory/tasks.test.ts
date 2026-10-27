import { describe, expect, it } from "vitest";
import type { PlannerPreset, Repeat, Task } from "@/lib/types";
import { dayInZone, todayIn, weekdayOf } from "./dates";
import { createRepeat, repeatsForDate } from "./repeats";
import { completeTask, createTask, getTodayView, reopenTask, scheduleTask, updateTask } from "./tasks";

const NOW = new Date("2026-10-27T05:00:00.000Z"); // Tue 11:00 in Dhaka

function task(title: string, extra: Partial<Task> = {}): Task {
  return { ...createTask({ title }, NOW)!, ...extra };
}

function asMap<T extends { id: string }>(...items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function presetWith(events: { id: string; title: string; start: number; end: number }[]): PlannerPreset {
  const day = (key: string) => ({ key, title: key, purposes: [], events: [] });
  const days = Object.fromEntries(
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((key) => [key, day(key)]),
  ) as unknown as PlannerPreset["days"];
  days.monday.events = events.map((event) => ({
    id: event.id,
    dayKey: "monday",
    purposeId: null,
    title: event.title,
    startMinutes: event.start,
    endMinutes: event.end,
    color: "teal",
    notes: "",
  }));
  return { id: "p1", name: "Week", subtitle: "", dayOrder: [], days, createdAt: "", updatedAt: "" };
}

describe("dates", () => {
  it("uses the user's time zone for today", () => {
    // 20:00 UTC on the 26th is already the 27th in Dhaka (UTC+6).
    const late = new Date("2026-10-26T20:00:00.000Z");
    expect(todayIn("Asia/Dhaka", late)).toBe("2026-10-27");
    expect(todayIn("UTC", late)).toBe("2026-10-26");
    expect(dayInZone("2026-10-26T20:00:00.000Z", "Asia/Dhaka")).toBe("2026-10-27");
    expect(weekdayOf("2026-10-27")).toBe("tue");
  });
});

describe("tasks", () => {
  it("creates open tasks on the Shelf and refuses blank titles", () => {
    expect(createTask({ title: "  " })).toBeNull();
    const created = createTask({ title: " Send link ", tags: ["#Velox", "velox"], blockId: "b1" }, NOW)!;
    expect(created).toMatchObject({ title: "Send link", status: "open", day: null, blockId: null, tags: ["velox"] });
  });

  it("appends notes, schedules, completes and reopens", () => {
    const original = task("Write");
    let tasks = asMap(original);
    tasks = updateTask(tasks, original.id, { notes: "first", appendNote: "second" }, NOW);
    expect(tasks[original.id].notes).toBe("first\nsecond");
    tasks = scheduleTask(tasks, original.id, { day: "2026-10-27", blockId: "b1" }, NOW);
    expect(tasks[original.id]).toMatchObject({ day: "2026-10-27", blockId: "b1" });
    tasks = scheduleTask(tasks, original.id, { day: null, blockId: "b1" }, NOW);
    expect(tasks[original.id]).toMatchObject({ day: null, blockId: null });
    tasks = completeTask(tasks, original.id, NOW);
    expect(tasks[original.id]).toMatchObject({ status: "done", doneAt: NOW.toISOString() });
    expect(completeTask(tasks, original.id, NOW)).toBe(tasks);
    tasks = reopenTask(tasks, original.id, NOW);
    expect(tasks[original.id]).toMatchObject({ status: "open", doneAt: null });
  });

  it("returns the same map when an update changes nothing", () => {
    const original = task("Same");
    const tasks = asMap(original);
    expect(updateTask(tasks, original.id, { title: "Same" }, NOW)).toBe(tasks);
  });
});

describe("getTodayView", () => {
  const date = "2026-10-27";
  const preset = presetWith([
    { id: "deep", title: "Deep work", start: 9 * 60, end: 11 * 60 },
    { id: "early", title: "Inbox", start: 8 * 60, end: 8 * 60 + 30 },
  ]);

  it("puts tasks in blocks, the day, the Shelf and leftovers without copying anything", () => {
    const inBlock = task("In block", { day: date, blockId: "deep" });
    const loose = task("Loose", { day: date });
    const orphan = task("Old block", { day: date, blockId: "gone" });
    const shelf = task("Shelf", { day: null });
    const leftover = task("Leftover", { day: "2026-10-24" });
    const doneOld = task("Done old", { day: "2026-10-20", status: "done" });
    const deleted = task("Deleted", { day: null, deletedAt: NOW.toISOString() });
    const view = getTodayView({
      tasks: asMap(inBlock, loose, orphan, shelf, leftover, doneOld, deleted),
      repeats: {},
      preset,
      date,
    });
    expect(view.blocks.map((block) => [block.title, block.start, block.end])).toEqual([
      ["Inbox", "08:00", "08:30"],
      ["Deep work", "09:00", "11:00"],
    ]);
    expect(view.blocks[1].tasks.map((t) => t.title)).toEqual(["In block"]);
    expect(view.today.map((t) => t.title)).toEqual(["Loose", "Old block"]);
    expect(view.shelf.map((t) => t.title)).toEqual(["Shelf"]);
    expect(view.leftovers.map((t) => [t.title, t.daysWaiting])).toEqual([["Leftover", 3]]);
  });

  it("shows repeats on their weekdays until one is completed for the day", () => {
    const gym = createRepeat({ title: "Gym", days: ["Mon", "wed", "fri"], time: "7:00" }, NOW)!;
    const standup = createRepeat({ title: "Standup prep", days: ["tue"], time: "15:30" }, NOW)!;
    const paused: Repeat = { ...createRepeat({ title: "Paused", days: ["tue"] }, NOW)!, active: false };
    const repeats = asMap(gym, standup, paused);
    expect(gym.time).toBe("07:00");
    expect(repeatsForDate(repeats, "2026-10-26").map((r) => r.title)).toEqual(["Gym"]);

    const view = getTodayView({ tasks: {}, repeats, preset: null, date });
    expect(view.repeats.map((r) => [r.title, r.id])).toEqual([["Standup prep", `repeat:${standup.id}`]]);

    const done = task("Standup prep", { day: date, repeatId: standup.id, status: "done" });
    expect(getTodayView({ tasks: asMap(done), repeats, preset: null, date }).repeats).toEqual([]);
  });

  it("uses the weekday planner template on every weekday and the Saturday one on Saturday", () => {
    // The Daily Planner edits "monday" for Mon–Fri (see dayKeyForDate).
    expect(getTodayView({ tasks: {}, repeats: {}, preset, date: "2026-10-29" }).blocks).toHaveLength(2);
    expect(getTodayView({ tasks: {}, repeats: {}, preset, date: "2026-10-31" }).blocks).toHaveLength(0);
  });
});
