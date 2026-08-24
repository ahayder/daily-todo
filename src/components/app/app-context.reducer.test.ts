import { describe, expect, test } from "vitest";

import { createInitialState } from "@/lib/store";
import { appReducer } from "./app-context.reducer";

describe("ensure-daily-today", () => {
  test("advances a stale selection to today, carrying the previous day forward", () => {
    const state = createInitialState("2026-03-10");
    state.dailyPages["2026-03-10"].markdown = "Yesterday's note";
    state.dailyPages["2026-03-10"].todos = [
      {
        id: "a",
        text: "Open task",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ];

    const next = appReducer(state, { type: "ensure-daily-today", date: "2026-03-11" });

    expect(next.uiState.selectedDailyDate).toBe("2026-03-11");
    expect(next.dailyPages["2026-03-11"]).toBeDefined();
    expect(next.dailyPages["2026-03-11"].markdown).toBe("Yesterday's note");
    expect(next.dailyPages["2026-03-11"].todos).toHaveLength(1);
    expect(next.dailyPages["2026-03-11"].todos[0].text).toBe("Open task");
    // The original day is preserved so its history stays intact.
    expect(next.dailyPages["2026-03-10"].markdown).toBe("Yesterday's note");
  });

  test("selects today without recreating an existing page", () => {
    const state = createInitialState("2026-03-11");
    // Simulate being stuck on an older day while today's page already exists.
    state.dailyPages["2026-03-10"] = {
      date: "2026-03-10",
      markdown: "Old day",
      todos: [],
    };
    state.dailyPages["2026-03-11"].markdown = "Today already here";
    state.uiState.selectedDailyDate = "2026-03-10";

    const next = appReducer(state, { type: "ensure-daily-today", date: "2026-03-11" });

    expect(next.uiState.selectedDailyDate).toBe("2026-03-11");
    expect(next.dailyPages["2026-03-11"].markdown).toBe("Today already here");
  });

  test("is a no-op when already viewing today's existing page", () => {
    const state = createInitialState("2026-03-11");

    const next = appReducer(state, { type: "ensure-daily-today", date: "2026-03-11" });

    expect(next).toBe(state);
  });
});
