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
  });

  test("falls back when schema is invalid", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ broken: true }));

    const state = loadAppState(new Date("2026-03-11T08:00:00"));

    expect(state.dailyPages["2026-03-11"]).toBeDefined();
    expect(state.uiState.lastView).toBe("daily");
  });
});
