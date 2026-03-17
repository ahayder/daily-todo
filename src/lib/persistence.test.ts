import { beforeEach, describe, expect, test } from "vitest";
import { loadAppState } from "@/lib/persistence";
import { STORAGE_KEY } from "@/lib/store";

describe("loadAppState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("seeds initial state when empty", () => {
    const state = loadAppState(new Date("2026-03-11T08:00:00"));

    expect(state.dailyPages["2026-03-11"]).toBeDefined();
    expect(Object.keys(state.notesDocs).length).toBeGreaterThan(0);
    expect(Object.keys(state.plannerPresets).length).toBeGreaterThan(0);
    expect(state.uiState.themeMode).toBe("system");
    expect(state.uiState.isSidebarCollapsed).toBe(false);
  });

  test("falls back when schema is invalid", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ broken: true }));

    const state = loadAppState(new Date("2026-03-11T08:00:00"));

    expect(state.dailyPages["2026-03-11"]).toBeDefined();
    expect(state.uiState.lastView).toBe("daily");
  });

  test("normalizes missing themeMode to system", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dailyPages: {
          "2026-03-11": { date: "2026-03-11", markdown: "", todos: [] },
        },
        notesDocs: {
          note_1: {
            id: "note_1",
            title: "Quick Notes",
            markdown: "",
            updatedAt: "2026-03-11T08:00:00.000Z",
          },
        },
        uiState: {
          selectedDailyDate: "2026-03-11",
          selectedNoteId: "note_1",
          expandedYears: ["2026"],
          expandedMonths: ["2026-03"],
          lastView: "daily",
        },
      }),
    );

    const state = loadAppState(new Date("2026-03-11T08:00:00"));
    expect(state.uiState.themeMode).toBe("system");
  });

  test("normalizes invalid themeMode to system", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dailyPages: {
          "2026-03-11": { date: "2026-03-11", markdown: "", todos: [] },
        },
        notesDocs: {
          note_1: {
            id: "note_1",
            title: "Quick Notes",
            markdown: "",
            updatedAt: "2026-03-11T08:00:00.000Z",
          },
        },
        uiState: {
          selectedDailyDate: "2026-03-11",
          selectedNoteId: "note_1",
          expandedYears: ["2026"],
          expandedMonths: ["2026-03"],
          lastView: "daily",
          themeMode: "sepia",
        },
      }),
    );

    const state = loadAppState(new Date("2026-03-11T08:00:00"));
    expect(state.uiState.themeMode).toBe("system");
  });

  test("backfills planner state for older payloads", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dailyPages: {
          "2026-03-11": { date: "2026-03-11", markdown: "", todos: [] },
        },
        notesDocs: {
          note_1: {
            id: "note_1",
            title: "Quick Notes",
            markdown: "",
            updatedAt: "2026-03-11T08:00:00.000Z",
          },
        },
        uiState: {
          selectedDailyDate: "2026-03-11",
          selectedNoteId: "note_1",
          expandedYears: ["2026"],
          expandedMonths: ["2026-03"],
          lastView: "daily",
        },
      }),
    );

    const state = loadAppState(new Date("2026-03-11T08:00:00"));

    expect(Object.keys(state.plannerPresets)).toHaveLength(1);
    expect(state.uiState.selectedPlannerPresetId).toBeTruthy();
  });

  test("normalizes missing sidebar state to expanded", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dailyPages: {
          "2026-03-11": { date: "2026-03-11", markdown: "", todos: [] },
        },
        notesDocs: {
          note_1: {
            id: "note_1",
            title: "Quick Notes",
            markdown: "",
            updatedAt: "2026-03-11T08:00:00.000Z",
          },
        },
        plannerPresets: {},
        uiState: {
          selectedDailyDate: "2026-03-11",
          selectedNoteId: "note_1",
          selectedPlannerPresetId: null,
          expandedYears: ["2026"],
          expandedMonths: ["2026-03"],
          lastView: "daily",
        },
      }),
    );

    const state = loadAppState(new Date("2026-03-11T08:00:00"));
    expect(state.uiState.isSidebarCollapsed).toBe(false);
  });
});
