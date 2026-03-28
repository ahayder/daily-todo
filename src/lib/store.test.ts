import { describe, expect, test } from "vitest";
import {
  DEFAULT_NOTES_FOLDER_ID,
  createInitialState,
  createPlannerPreset,
  duplicatePlannerPreset,
  ensureDailyPageForDate,
  ensureNoteState,
  ensurePlannerState,
  groupTodosByPriority,
} from "@/lib/store";
import type { Todo } from "@/lib/types";

describe("ensureDailyPageForDate", () => {
  test("creates today's page with carryover unchecked todos and full markdown", () => {
    const state = createInitialState("2026-03-10");
    state.dailyPages["2026-03-10"].markdown = "Carry this note";
    state.dailyPages["2026-03-10"].todos = [
      {
        id: "a",
        text: "Open task",
        priority: 1,
        done: false,
        createdAt: "2026-03-10T10:00:00.000Z",
      },
      {
        id: "b",
        text: "Done task",
        priority: 2,
        done: true,
        createdAt: "2026-03-10T11:00:00.000Z",
      },
    ];

    const rolled = ensureDailyPageForDate(state, "2026-03-11");

    expect(rolled.dailyPages["2026-03-11"]).toBeDefined();
    expect(rolled.dailyPages["2026-03-11"].markdown).toBe("Carry this note");
    expect(rolled.dailyPages["2026-03-11"].todos).toHaveLength(1);
    expect(rolled.dailyPages["2026-03-11"].todos[0].text).toBe("Open task");
    expect(rolled.dailyPages["2026-03-11"].todos[0].done).toBe(false);
  });

  test("does not recreate when page already exists", () => {
    const state = createInitialState("2026-03-11");
    const next = ensureDailyPageForDate(state, "2026-03-11");

    expect(Object.keys(next.dailyPages)).toHaveLength(1);
    expect(next.dailyPages["2026-03-11"]).toBeDefined();
  });
});

describe("groupTodosByPriority", () => {
  test("groups by priority and places unchecked items first", () => {
    const todos: Todo[] = [
      { id: "1", text: "p2 done", priority: 2, done: true, createdAt: "t" },
      { id: "2", text: "p1 open", priority: 1, done: false, createdAt: "t" },
      { id: "3", text: "p2 open", priority: 2, done: false, createdAt: "t" },
    ];

    const grouped = groupTodosByPriority(todos);

    expect(grouped[1].map((item) => item.text)).toEqual(["p1 open"]);
    expect(grouped[2].map((item) => item.text)).toEqual(["p2 open", "p2 done"]);
    expect(grouped[3]).toEqual([]);
  });
});

describe("planner state", () => {
  test("seeds a default Notes folder in initial state", () => {
    const state = createInitialState("2026-03-11");
    const noteId = state.uiState.selectedNoteId!;

    expect(state.noteFolders[DEFAULT_NOTES_FOLDER_ID]).toBeDefined();
    expect(state.noteFolders[DEFAULT_NOTES_FOLDER_ID].name).toBe("Notes");
    expect(state.notesDocs[noteId].folderId).toBe(DEFAULT_NOTES_FOLDER_ID);
  });

  test("seeds a default planner preset in initial state", () => {
    const state = createInitialState("2026-03-11");
    const presetIds = Object.keys(state.plannerPresets);

    expect(presetIds).toHaveLength(1);
    expect(state.uiState.selectedPlannerPresetId).toBe(presetIds[0]);
    expect(state.plannerPresets[presetIds[0]].dayOrder).toHaveLength(7);
  });

  test("backfills planner state when missing", () => {
    const state = createInitialState("2026-03-11");
    const { ...rest } = state;
    const repaired = ensurePlannerState({
      ...rest,
      plannerPresets: {},
      uiState: {
        ...rest.uiState,
        selectedPlannerPresetId: null,
      },
    });

    expect(Object.keys(repaired.plannerPresets)).toHaveLength(1);
    expect(repaired.uiState.selectedPlannerPresetId).toBeTruthy();
  });

  test("backfills the default Notes folder and moves orphaned notes into it", () => {
    const state = createInitialState("2026-03-11");
    const noteId = state.uiState.selectedNoteId!;
    const repaired = ensureNoteState({
      ...state,
      noteFolders: {},
      notesDocs: {
        [noteId]: {
          ...state.notesDocs[noteId],
          folderId: null,
        },
      },
      uiState: {
        ...state.uiState,
        selectedNoteFolderId: null,
      },
    });

    expect(repaired.noteFolders[DEFAULT_NOTES_FOLDER_ID]).toBeDefined();
    expect(repaired.notesDocs[noteId].folderId).toBe(DEFAULT_NOTES_FOLDER_ID);
    expect(repaired.uiState.selectedNoteFolderId).toBe(DEFAULT_NOTES_FOLDER_ID);
  });

  test("duplicates a preset with separate day titles", () => {
    const preset = createPlannerPreset("Focus Week");
    preset.days.monday.title = "Deep Work Monday";
    const copy = duplicatePlannerPreset(preset);

    copy.days.monday.title = "Recovery Monday";

    expect(copy.id).not.toBe(preset.id);
    expect(copy.days.monday.title).toBe("Recovery Monday");
    expect(preset.days.monday.title).toBe("Deep Work Monday");
  });
});
