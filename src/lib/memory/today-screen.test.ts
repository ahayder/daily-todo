import { describe, expect, it } from "vitest";
import type { PlannerPreset, Task } from "@/lib/types";
import type { HistoryDay } from "./history-view";
import type { TodayView } from "./tasks";
import { aiChangesToday, getNow, minutesInZone, selectedPlannerPreset, shortDuration } from "./today-screen";

const task = (title: string, status: Task["status"] = "open") => ({ id: title, title, status }) as Task;

const view: TodayView = {
  date: "2026-10-27",
  blocks: [
    { id: "a", title: "Inbox", start: "08:00", end: "09:00", tasks: [task("Done one", "done"), task("Reply")] },
    { id: "b", title: "Deep work", start: "09:00", end: "11:00", tasks: [] },
  ],
  today: [],
  repeats: [],
  shelf: [],
  leftovers: [],
};

describe("today screen", () => {
  it("finds the current block, its first open task and the next block", () => {
    const now = getNow(view, 8 * 60 + 15)!;
    expect(now.block.id).toBe("a");
    expect(now.task?.title).toBe("Reply");
    expect(now.minutesLeft).toBe(45);
    expect(now.progress).toBeCloseTo(0.25);
    expect(now.next?.id).toBe("b");
    expect(getNow(view, 10 * 60)?.task).toBeNull();
    expect(getNow(view, 12 * 60)).toBeNull();
  });

  it("reads minutes in the user's time zone", () => {
    // 05:30 UTC is 11:30 in Dhaka.
    expect(minutesInZone(new Date("2026-10-27T05:30:00.000Z"), "Asia/Dhaka")).toBe(11 * 60 + 30);
  });

  it("formats short durations for the Now ring", () => {
    expect(shortDuration(38)).toBe("38m");
    expect(shortDuration(60)).toBe("1h");
    expect(shortDuration(105)).toBe("1h45");
  });

  it("picks the selected planner week, else the newest", () => {
    const preset = (id: string, updatedAt: string) => ({ id, updatedAt }) as PlannerPreset;
    const plannerPresets = { old: preset("old", "2026-01-01"), fresh: preset("fresh", "2026-10-01") };
    const uiState = { selectedPlannerPresetId: "old" } as Parameters<typeof selectedPlannerPreset>[0]["uiState"];
    expect(selectedPlannerPreset({ plannerPresets, uiState })?.id).toBe("old");
    expect(selectedPlannerPreset({ plannerPresets, uiState: { ...uiState, selectedPlannerPresetId: "gone" } })?.id).toBe(
      "fresh",
    );
  });

  it("lists only today's AI changes that are still in effect", () => {
    const row = (changeId: string, who: string, status: "live" | "undone") =>
      ({ changeId, batchId: changeId, at: "", who, text: "", more: [], where: null, status }) as const;
    const history: HistoryDay[] = [
      { day: "2026-10-27", rows: [row("3", "Claude", "live"), row("2", "You", "live"), row("1", "ChatGPT", "undone")] },
      { day: "2026-10-26", rows: [row("0", "Claude", "live")] },
    ];
    expect(aiChangesToday(history, "2026-10-27").map((item) => item.changeId)).toEqual(["3"]);
  });
});
