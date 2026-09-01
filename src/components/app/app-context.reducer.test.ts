import { describe, expect, test } from "vitest";

import { createInitialState } from "@/lib/store";
import { appReducer } from "./app-context.reducer";

describe("dev-advance-day", () => {
  test("rolls forward from the latest day, carrying incomplete todos and note markdown", () => {
    const state = createInitialState("2026-03-10");
    state.dailyPages["2026-03-10"].markdown = "Carry me forward";
    state.dailyPages["2026-03-10"].todos = [
      {
        id: "open",
        text: "Open task",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-10T10:00:00.000Z",
      },
      {
        id: "done",
        text: "Done task",
        priority: 2,
        status: "finished",
        estimatedMinutes: null,
        createdAt: "2026-03-10T10:00:00.000Z",
      },
    ];

    const next = appReducer(state, { type: "dev-advance-day" });

    expect(next.uiState.selectedDailyDate).toBe("2026-03-11");
    expect(next.dailyPages["2026-03-11"]).toBeDefined();
    expect(next.dailyPages["2026-03-11"].markdown).toBe("Carry me forward");
    // Only the incomplete task carries forward.
    expect(next.dailyPages["2026-03-11"].todos).toHaveLength(1);
    expect(next.dailyPages["2026-03-11"].todos[0].text).toBe("Open task");
    expect(next.dailyPages["2026-03-11"].todos[0].status).toBe("pending");
    // The source day is preserved intact.
    expect(next.dailyPages["2026-03-10"].todos).toHaveLength(2);
  });

  test("marches forward one day per call, chaining from the newest page", () => {
    const state = createInitialState("2026-03-10");
    state.dailyPages["2026-03-10"].markdown = "Day one";

    const afterFirst = appReducer(state, { type: "dev-advance-day" });
    const afterSecond = appReducer(afterFirst, { type: "dev-advance-day" });

    expect(afterFirst.uiState.selectedDailyDate).toBe("2026-03-11");
    expect(afterSecond.uiState.selectedDailyDate).toBe("2026-03-12");
    expect(afterSecond.dailyPages["2026-03-12"]).toBeDefined();
    expect(afterSecond.dailyPages["2026-03-12"].markdown).toBe("Day one");
  });
});

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

  test("editing the new day never mutates the previous day's note or todos", () => {
    // Aug 26 is the historical day. It must stay exactly as written once the
    // view advances to Aug 27 and Aug 27 is edited.
    const base = createInitialState("2026-08-26");
    base.dailyPages["2026-08-26"].markdown = "August 26 note";
    base.dailyPages["2026-08-26"].todos = [
      {
        id: "keep-open",
        text: "Carry me forward",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-08-26T09:00:00.000Z",
      },
      {
        id: "keep-done",
        text: "Finished yesterday",
        priority: 2,
        status: "finished",
        estimatedMinutes: null,
        createdAt: "2026-08-26T10:00:00.000Z",
      },
    ];

    // Advance to Aug 27 (carryover), then edit only Aug 27.
    let state = appReducer(base, { type: "ensure-daily-today", date: "2026-08-27" });
    state = appReducer(state, {
      type: "update-daily-markdown",
      date: "2026-08-27",
      markdown: "August 27 note — different",
    });
    state = appReducer(state, {
      type: "add-todo",
      date: "2026-08-27",
      text: "A brand new Aug 27 task",
      priority: 1,
    });
    // Complete the carried-over todo on Aug 27.
    const carriedId = state.dailyPages["2026-08-27"].todos[0].id;
    state = appReducer(state, {
      type: "set-todo-status",
      date: "2026-08-27",
      todoId: carriedId,
      status: "finished",
    });

    // Aug 26 is untouched.
    expect(state.dailyPages["2026-08-26"].markdown).toBe("August 26 note");
    expect(state.dailyPages["2026-08-26"].todos).toEqual(base.dailyPages["2026-08-26"].todos);
    expect(state.dailyPages["2026-08-26"].todos.map((todo) => todo.status)).toEqual([
      "pending",
      "finished",
    ]);

    // Aug 27 carried only the incomplete todo forward (finished one stayed on Aug 26),
    // and holds its own independent edits.
    expect(state.dailyPages["2026-08-27"].markdown).toBe("August 27 note — different");
    expect(state.dailyPages["2026-08-27"].todos.map((todo) => todo.text)).toEqual([
      "Carry me forward",
      "A brand new Aug 27 task",
    ]);
    // The carried todo has a fresh id (not the Aug 26 id) so the two days never alias.
    expect(carriedId).not.toBe("keep-open");
  });
});
