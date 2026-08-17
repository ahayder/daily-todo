import { describe, expect, test } from "vitest";
import {
  DEFAULT_CONTENT_COLUMNS,
  DEFAULT_NOTES_FOLDER_ID,
  DEFAULT_TODO_WORKSPACE_ID,
  addPlannerPurposeToDays,
  addContentColumn,
  applyPlannerPurposeToDays,
  createContentCard,
  createContentColumn,
  createIdealPlannerPreset,
  createInitialState,
  createPlannerEvent,
  createPlannerPurpose,
  createPlannerPreset,
  createTodoWorkspaceInState,
  deleteTodoWorkspaceFromState,
  deleteContentColumn,
  duplicatePlannerPreset,
  ensureDailyPageForDate,
  ensureContentPlannerState,
  ensureNoteState,
  ensurePlannerState,
  groupTodosByPriority,
  getDailyPageForWorkspace,
  getDailyPageKey,
  makeTodoSubtask,
  mergeHydratedAppState,
  moveContentCard,
  renameContentColumn,
  reorderContentColumns,
  selectTodoWorkspaceInState,
  updateContentColumnSubtitle,
  updatePlannerPurposeInDay,
} from "@/lib/store";
import type { Todo } from "@/lib/types";

describe("makeTodoSubtask", () => {
  test("nests a main task under another main task and preserves its children", () => {
    const todos: Todo[] = [
      {
        id: "parent",
        text: "Parent",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-11T08:00:00.000Z",
      },
      {
        id: "existing-child",
        text: "Existing child",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-11T08:01:00.000Z",
        parentId: "parent",
      },
      {
        id: "moving",
        text: "Moving",
        priority: 2,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-11T08:02:00.000Z",
      },
      {
        id: "moving-child",
        text: "Moving child",
        priority: 2,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-11T08:03:00.000Z",
        parentId: "moving",
      },
    ];

    const nested = makeTodoSubtask(todos, "moving", "parent");

    expect(nested.map((todo) => todo.id)).toEqual([
      "parent",
      "existing-child",
      "moving",
      "moving-child",
    ]);
    expect(nested.find((todo) => todo.id === "moving")).toMatchObject({
      parentId: "parent",
      priority: 1,
    });
    expect(nested.find((todo) => todo.id === "moving-child")).toMatchObject({
      parentId: "parent",
      priority: 1,
    });
  });

  test("rejects invalid or multi-level nesting", () => {
    const todos: Todo[] = [
      {
        id: "parent",
        text: "Parent",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-11T08:00:00.000Z",
      },
      {
        id: "child",
        text: "Child",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-11T08:01:00.000Z",
        parentId: "parent",
      },
      {
        id: "moving",
        text: "Moving",
        priority: 2,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-11T08:02:00.000Z",
      },
    ];

    expect(makeTodoSubtask(todos, "moving", "child")).toBe(todos);
    expect(makeTodoSubtask(todos, "moving", "moving")).toBe(todos);
  });
});

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

describe("Todo workspaces", () => {
  test("creates an empty independent workspace without changing Main history", () => {
    const state = createInitialState("2026-03-11");
    state.dailyPages["2026-03-11"].markdown = "Main note";
    state.dailyPages["2026-03-11"].todos = [
      {
        id: "main-task",
        text: "Main task",
        priority: 1,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-11T08:00:00.000Z",
      },
    ];

    const created = createTodoWorkspaceInState(state, "Work", "2026-03-11");
    const workspaceId = created.uiState.selectedTodoWorkspaceId;

    expect(workspaceId).not.toBe(DEFAULT_TODO_WORKSPACE_ID);
    expect(created.todoWorkspaces[workspaceId].name).toBe("Work");
    expect(getDailyPageForWorkspace(created, "2026-03-11", workspaceId)).toEqual({
      date: "2026-03-11",
      markdown: "",
      todos: [],
    });
    expect(getDailyPageForWorkspace(created, "2026-03-11", DEFAULT_TODO_WORKSPACE_ID)?.markdown)
      .toBe("Main note");
  });

  test("carries unfinished work only within the selected workspace", () => {
    const initial = createInitialState("2026-03-10");
    initial.dailyPages["2026-03-10"].markdown = "Main history";
    const created = createTodoWorkspaceInState(initial, "Work", "2026-03-10");
    const workspaceId = created.uiState.selectedTodoWorkspaceId;
    const workKey = getDailyPageKey(workspaceId, "2026-03-10");
    created.dailyPages[workKey].markdown = "Work history";
    created.dailyPages[workKey].todos = [
      {
        id: "work-task",
        text: "Work task",
        priority: 2,
        status: "pending",
        estimatedMinutes: null,
        createdAt: "2026-03-10T08:00:00.000Z",
      },
    ];

    const rolled = ensureDailyPageForDate(created, "2026-03-11", workspaceId);
    const workToday = getDailyPageForWorkspace(rolled, "2026-03-11", workspaceId);

    expect(workToday?.markdown).toBe("Work history");
    expect(workToday?.todos.map((todo) => todo.text)).toEqual(["Work task"]);
    expect(getDailyPageForWorkspace(rolled, "2026-03-11", DEFAULT_TODO_WORKSPACE_ID)).toBeNull();
  });

  test("switches on the same date and removes only a confirmed non-Main workspace", () => {
    const initial = createInitialState("2026-03-11");
    const created = createTodoWorkspaceInState(initial, "Work", "2026-03-11");
    const workspaceId = created.uiState.selectedTodoWorkspaceId;
    const switched = selectTodoWorkspaceInState(
      created,
      DEFAULT_TODO_WORKSPACE_ID,
      "2026-03-11",
    );
    const deleted = deleteTodoWorkspaceFromState(switched, workspaceId, "2026-03-11");

    expect(switched.uiState.selectedTodoWorkspaceId).toBe(DEFAULT_TODO_WORKSPACE_ID);
    expect(deleted.todoWorkspaces[workspaceId]).toBeUndefined();
    expect(deleted.dailyPages[getDailyPageKey(workspaceId, "2026-03-11")]).toBeUndefined();
    expect(deleted.dailyPages["2026-03-11"]).toBeDefined();
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

  test("seeds an editable ideal daily rhythm in initial state", () => {
    const state = createInitialState("2026-03-11");
    const presetIds = Object.keys(state.plannerPresets);
    const preset = state.plannerPresets[presetIds[0]];
    const monday = preset.days.monday;
    const workFocus = monday.purposes.find(
      (purpose) => purpose.title === "Work & responsibility",
    );

    expect(presetIds).toHaveLength(1);
    expect(state.uiState.selectedPlannerPresetId).toBe(presetIds[0]);
    expect(preset.name).toBe("Ideal Daily Rhythm");
    expect(preset.subtitle).toMatch(/calm, balanced sample/i);
    expect(preset.createdAt).toBeTruthy();
    expect(state.uiState.hasSeenPlannerTour).toBe(false);
    expect(preset.dayOrder).toHaveLength(7);
    expect(monday.events).toHaveLength(10);
    expect(
      monday.events
        .filter((event) => event.purposeId === workFocus?.id)
        .map((event) => event.title),
    ).toEqual(["Deep work", "Admin window"]);
    expect(
      monday.events.reduce(
        (total, event) => total + event.endMinutes - event.startMinutes,
        0,
      ),
    ).toBe(24 * 60);
  });

  test("keeps custom child block labels when a main focus changes", () => {
    const preset = createIdealPlannerPreset();
    const workFocus = preset.days.monday.purposes.find(
      (purpose) => purpose.title === "Work & responsibility",
    )!;

    const updated = updatePlannerPurposeInDay(
      preset,
      "monday",
      workFocus.id,
      { title: "Meaningful work", color: "gold" },
      new Date("2026-03-11T08:00:00Z"),
    );
    const blocks = updated.days.monday.events.filter(
      (event) => event.purposeId === workFocus.id,
    );

    expect(blocks.map((event) => event.title)).toEqual(["Deep work", "Admin window"]);
    expect(blocks.every((event) => event.color === "gold")).toBe(true);
  });

  test("upgrades only the untouched blank default plan to the ideal starter", () => {
    const state = createInitialState("2026-03-11");
    const blankDefault = createPlannerPreset("Balanced Week");
    const upgraded = ensurePlannerState({
      ...state,
      plannerPresets: { [blankDefault.id]: blankDefault },
      uiState: { ...state.uiState, selectedPlannerPresetId: blankDefault.id },
    });

    expect(upgraded.plannerPresets[blankDefault.id].name).toBe("Ideal Daily Rhythm");
    expect(upgraded.plannerPresets[blankDefault.id].days.monday.purposes.length).toBeGreaterThan(0);

    const customBlank = createPlannerPreset("My empty plan");
    const preserved = ensurePlannerState({
      ...state,
      plannerPresets: { [customBlank.id]: customBlank },
      uiState: { ...state.uiState, selectedPlannerPresetId: customBlank.id },
    });

    expect(preserved.plannerPresets[customBlank.id].days.monday.purposes).toEqual([]);
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

  test("merges remote hydration without discarding a local card drag", () => {
    const base = createInitialState("2026-03-11");
    const [ideas, planned] = base.contentBoard.columns;
    const draggedCard = createContentCard({
      columnId: ideas.id,
      title: "Drag me",
      order: 0,
    })!;
    base.contentCards = { [draggedCard.id]: draggedCard };

    const local = {
      ...base,
      contentCards: moveContentCard(
        base.contentCards,
        draggedCard.id,
        planned.id,
        0,
      ),
    };
    const remoteOnlyCard = createContentCard({
      columnId: ideas.id,
      title: "Created elsewhere",
      order: 1,
    })!;
    const remote = {
      ...base,
      contentBoard: renameContentColumn(base.contentBoard, ideas.id, "Inbox"),
      contentCards: {
        ...base.contentCards,
        [remoteOnlyCard.id]: remoteOnlyCard,
      },
    };

    const merged = mergeHydratedAppState(base, local, remote);

    expect(merged.contentBoard.columns[0].title).toBe("Inbox");
    expect(merged.contentCards[draggedCard.id].columnId).toBe(planned.id);
    expect(merged.contentCards[remoteOnlyCard.id]).toBe(remoteOnlyCard);
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

  test("duplicates a preset with independent content and creation metadata", () => {
    const preset = createPlannerPreset("Focus Week");
    preset.days.monday.title = "Deep Work Monday";
    const copy = duplicatePlannerPreset(preset);

    copy.days.monday.title = "Recovery Monday";

    expect(copy.id).not.toBe(preset.id);
    expect(copy.name).toBe("Focus Week Copy");
    expect(copy.subtitle).toBe(preset.subtitle);
    expect(copy.createdAt).toBeTruthy();
    expect(copy.days.monday.title).toBe("Recovery Monday");
    expect(preset.days.monday.title).toBe("Deep Work Monday");
  });

  test("copies a purpose and all of its slices only to selected days", () => {
    const purpose = createPlannerPurpose({
      title: "Office work",
      targetMinutes: 480,
      role: "primary",
    });
    const preset = addPlannerPurposeToDays(
      createPlannerPreset("Weekday rhythm"),
      purpose,
      ["monday"],
    );
    preset.days.monday.events = [
      createPlannerEvent({
        id: "monday-office",
        purposeId: purpose.id,
        dayKey: "monday",
        title: purpose.title,
        color: purpose.color,
        startMinutes: 540,
        endMinutes: 720,
      }),
    ];

    const copied = applyPlannerPurposeToDays(
      preset,
      "monday",
      purpose.id,
      ["tuesday", "thursday"],
    );

    expect(copied.days.tuesday.purposes).toContainEqual(purpose);
    expect(copied.days.tuesday.events[0]).toMatchObject({
      purposeId: purpose.id,
      dayKey: "tuesday",
      startMinutes: 540,
      endMinutes: 720,
    });
    expect(copied.days.tuesday.events[0].id).not.toBe("monday-office");
    expect(copied.days.wednesday.purposes).toEqual([]);
    expect(copied.days.thursday.events).toHaveLength(1);
  });
});
