import { describe, expect, test } from "vitest";
import {
  DEFAULT_CONTENT_COLUMNS,
  DEFAULT_NOTES_FOLDER_ID,
  addContentColumn,
  createContentCard,
  createContentColumn,
  createInitialState,
  createPlannerPreset,
  deleteContentColumn,
  duplicatePlannerPreset,
  ensureDailyPageForDate,
  ensureContentPlannerState,
  ensureNoteState,
  ensurePlannerState,
  groupTodosByPriority,
  moveContentCard,
  renameContentColumn,
  reorderContentColumns,
  updateContentColumnSubtitle,
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
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-10T10:00:00.000Z",
      },
      {
        id: "b",
        text: "Done task",
        priority: 2,
        status: "finished",
        estimatedMinutes: null,
        createdAt: "2026-03-10T11:00:00.000Z",
      },
    ];

    const rolled = ensureDailyPageForDate(state, "2026-03-11");

    expect(rolled.dailyPages["2026-03-11"]).toBeDefined();
    expect(rolled.dailyPages["2026-03-11"].markdown).toBe("Carry this note");
    expect(rolled.dailyPages["2026-03-11"].todos).toHaveLength(1);
    expect(rolled.dailyPages["2026-03-11"].todos[0].text).toBe("Open task");
    expect(rolled.dailyPages["2026-03-11"].todos[0].status).toBe("pending");
  });

  test("carries subtasks with deterministic ids linked to their copied parent", () => {
    const state = createInitialState("2026-03-10");
    state.dailyPages["2026-03-10"].todos = [
      {
        id: "parent",
        text: "Parent task",
        priority: 1,
        status: "ongoing",
        estimatedMinutes: 25,
        createdAt: "2026-03-10T08:00:00.000Z",
      },
      {
        id: "child",
        text: "Child task",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-10T08:05:00.000Z",
        parentId: "parent",
      },
    ];

    const first = ensureDailyPageForDate(state, "2026-03-11");
    const second = ensureDailyPageForDate(state, "2026-03-11");
    const carried = first.dailyPages["2026-03-11"].todos;

    expect(carried).toEqual([
      expect.objectContaining({
        id: "todo_carry_20260311_0",
        text: "Parent task",
        status: "pending",
        parentId: undefined,
      }),
      expect.objectContaining({
        id: "todo_carry_20260311_1",
        text: "Child task",
        status: "pending",
        parentId: "todo_carry_20260311_0",
      }),
    ]);
    expect(second.dailyPages["2026-03-11"]).toEqual(first.dailyPages["2026-03-11"]);
  });

  test("promotes an unfinished subtask when its finished parent is not carried", () => {
    const state = createInitialState("2026-03-10");
    state.dailyPages["2026-03-10"].todos = [
      {
        id: "parent",
        text: "Finished parent",
        priority: 1,
        status: "finished",
        estimatedMinutes: null,
        createdAt: "2026-03-10T08:00:00.000Z",
      },
      {
        id: "child",
        text: "Open child",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-10T08:05:00.000Z",
        parentId: "parent",
      },
    ];

    const rolled = ensureDailyPageForDate(state, "2026-03-11");

    expect(rolled.dailyPages["2026-03-11"].todos).toEqual([
      expect.objectContaining({
        text: "Open child",
        parentId: undefined,
      }),
    ]);
  });

  test("ignores future pages when selecting the carryover source", () => {
    const state = createInitialState("2026-03-10");
    state.dailyPages["2026-03-10"].markdown = "Previous snapshot";
    state.dailyPages["2026-03-12"] = {
      date: "2026-03-12",
      markdown: "Future snapshot",
      todos: [],
    };

    const rolled = ensureDailyPageForDate(state, "2026-03-11");

    expect(rolled.dailyPages["2026-03-11"].markdown).toBe("Previous snapshot");
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
      {
        id: "1",
        text: "p2 done",
        priority: 2,
        status: "finished",
        estimatedMinutes: null,
        createdAt: "t",
      },
      {
        id: "2",
        text: "p1 open",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "t",
      },
      {
        id: "3",
        text: "p2 open",
        priority: 2,
        status: "ongoing",
        estimatedMinutes: null,
        createdAt: "t",
      },
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

  test("seeds the default content board in initial state", () => {
    const state = createInitialState("2026-03-11");

    expect(state.contentBoard.columns.map((column) => column.title)).toEqual(
      DEFAULT_CONTENT_COLUMNS.map((column) => column.title),
    );
    expect(state.contentCards).toEqual({});
  });

  test("moves cards within and between columns with integer ordering", () => {
    const state = createInitialState("2026-03-11");
    const [ideas, planned] = state.contentBoard.columns;
    const first = createContentCard({ columnId: ideas.id, title: "First", order: 0 })!;
    const second = createContentCard({ columnId: ideas.id, title: "Second", order: 1 })!;
    const third = createContentCard({ columnId: planned.id, title: "Third", order: 0 })!;
    const cards = {
      [first.id]: first,
      [second.id]: second,
      [third.id]: third,
    };

    const reordered = moveContentCard(cards, second.id, ideas.id, 0);
    expect([reordered[second.id].order, reordered[first.id].order]).toEqual([0, 1]);

    const moved = moveContentCard(reordered, first.id, planned.id, 1);
    expect(moved[third.id].order).toBe(0);
    expect(moved[first.id]).toMatchObject({ columnId: planned.id, order: 1 });
    expect(moved[second.id].order).toBe(0);
  });

  test("adds, renames, reorders, and guards column deletion", () => {
    const state = createInitialState("2026-03-11");
    const added = addContentColumn(
      state.contentBoard,
      "  Review Queue  ",
      " Waiting for review ",
    );
    const addedColumn = added.columns.at(-1)!;

    expect(addedColumn.title).toBe("Review Queue");
    expect(addedColumn.subtitle).toBe("Waiting for review");
    expect(renameContentColumn(added, addedColumn.id, " Final Review ").columns.at(-1)?.title).toBe(
      "Final Review",
    );
    expect(
      updateContentColumnSubtitle(added, addedColumn.id, " Ready for approval ")
        .columns.at(-1)?.subtitle,
    ).toBe("Ready for approval");
    expect(
      reorderContentColumns(added, addedColumn.id, added.columns[0].id).columns[0].id,
    ).toBe(addedColumn.id);

    const card = createContentCard({ columnId: addedColumn.id, title: "Occupied", order: 0 })!;
    expect(deleteContentColumn(added, { [card.id]: card }, addedColumn.id)).toBe(added);
    expect(deleteContentColumn(added, {}, addedColumn.id).columns).toHaveLength(
      DEFAULT_CONTENT_COLUMNS.length,
    );
    const singleColumn = { columns: [addedColumn], updatedAt: added.updatedAt };
    expect(deleteContentColumn(singleColumn, {}, addedColumn.id)).toBe(singleColumn);
  });

  test("repairs cards whose column no longer exists", () => {
    const state = createInitialState("2026-03-11");
    const card = createContentCard({
      columnId: "missing",
      title: "Recovered",
      order: 7,
    })!;
    const repaired = ensureContentPlannerState({
      ...state,
      contentCards: { [card.id]: card },
    });

    expect(repaired.contentCards[card.id]).toMatchObject({
      columnId: state.contentBoard.columns[0].id,
      order: 0,
    });
  });

  test("adds sample subtitles to legacy default columns without changing custom columns", () => {
    const state = createInitialState("2026-03-11");
    const customColumn = createContentColumn("Custom")!;
    const repaired = ensureContentPlannerState({
      ...state,
      contentBoard: {
        ...state.contentBoard,
        columns: [
          { ...state.contentBoard.columns[0], subtitle: "" },
          customColumn,
        ],
      },
    });

    expect(repaired.contentBoard.columns[0].subtitle).toBe("Capture raw concepts");
    expect(repaired.contentBoard.columns[1].subtitle).toBe("");
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
