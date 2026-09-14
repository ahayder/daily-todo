import { describe, expect, test } from "vitest";
import {
  dayKeyForDate,
  getCurrentBlock,
  getNextBlock,
  minutesLeft,
  minutesOfDay,
  progressFraction,
} from "@/lib/planner-now";
import type { PlannerEvent } from "@/lib/types";

function event(id: string, startMinutes: number, endMinutes: number): PlannerEvent {
  return {
    id,
    purposeId: null,
    dayKey: "monday",
    title: id,
    color: "teal",
    notes: "",
    startMinutes,
    endMinutes,
  };
}

// 6:00–9:00 morning, 9:00–12:30 deep work, 13:30–15:30 deep work
const day = [event("morning", 360, 540), event("deep-am", 540, 750), event("deep-pm", 810, 930)];

describe("planner now helpers", () => {
  test("maps calendar dates to the three templates", () => {
    expect(dayKeyForDate(new Date("2026-09-13T09:00:00"))).toBe("sunday"); // Sun
    expect(dayKeyForDate(new Date("2026-09-14T09:00:00"))).toBe("monday"); // Mon
    expect(dayKeyForDate(new Date("2026-09-17T09:00:00"))).toBe("monday"); // Thu → weekday
    expect(dayKeyForDate(new Date("2026-09-19T09:00:00"))).toBe("saturday"); // Sat
  });

  test("reads minutes of day from a date", () => {
    expect(minutesOfDay(new Date("2026-09-14T14:47:00"))).toBe(887);
  });

  test("finds the block covering now, and null in a gap", () => {
    expect(getCurrentBlock(day, 600)?.id).toBe("deep-am"); // 10:00 inside deep work
    expect(getCurrentBlock(day, 780)).toBeNull(); // 13:00 gap between blocks
    expect(getCurrentBlock(day, 300)).toBeNull(); // 05:00 before first block
  });

  test("treats the end minute as belonging to the next block, not the current", () => {
    expect(getCurrentBlock(day, 540)?.id).toBe("deep-am"); // start is inclusive
    expect(getCurrentBlock(day, 750)).toBeNull(); // end is exclusive → gap
  });

  test("finds the next block after now", () => {
    expect(getNextBlock(day, 600)?.id).toBe("deep-pm");
    expect(getNextBlock(day, 300)?.id).toBe("morning");
    expect(getNextBlock(day, 930)).toBeNull(); // after the last block
  });

  test("computes remaining minutes and progress within a block", () => {
    const block = event("deep-pm", 810, 930); // 13:30–15:30
    expect(minutesLeft(block, 887)).toBe(43); // 14:47 → 43 min left
    expect(progressFraction(block, 870)).toBeCloseTo(0.5, 5); // halfway
    expect(minutesLeft(block, 1000)).toBe(0); // never negative
    expect(progressFraction(block, 1000)).toBe(1); // clamped
  });
});
