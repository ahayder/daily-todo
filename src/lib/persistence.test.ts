import { beforeEach, describe, expect, test } from "vitest";
import {
  CONTENT_FONT_SCALE_DEFAULT,
  CONTENT_FONT_SCALE_MAX,
} from "@/lib/content-font-scale";
import { createBrowserLocalCacheStorage, getUserCacheStorageKey } from "@/lib/local-cache-storage";
import {
  LEGACY_LOCAL_STORAGE_KEY,
  createPersistenceMetadata,
  normalizeAppState,
} from "@/lib/persistence";
import { getSyncRecordValuesFromState } from "@/lib/sync-outbox";
import { appStateSchema } from "@/lib/schema";
import {
  DEFAULT_NOTES_FOLDER_ID,
  DEFAULT_TODO_WORKSPACE_ID,
  createContentCard,
  createInitialState,
  createTodoWorkspaceInState,
} from "@/lib/store";

describe("normalizeAppState", () => {
  test("seeds initial state when payload is empty", () => {
    const state = normalizeAppState(null, new Date("2026-03-11T08:00:00Z"));

    expect(state.dailyPages["2026-03-11"]).toBeDefined();
    expect(Object.keys(state.notesDocs).length).toBeGreaterThan(0);
    expect(Object.keys(state.plannerPresets).length).toBeGreaterThan(0);
    expect(state.contentBoard.columns.map((column) => column.title)).toEqual([
      "Inbox",
      "Develop",
      "Shoot next",
      "Published",
    ]);
    expect(state.contentCards).toEqual({});
    expect(state.todoWorkspaces[DEFAULT_TODO_WORKSPACE_ID].name).toBe("Main");
    expect(state.uiState.selectedTodoWorkspaceId).toBe(DEFAULT_TODO_WORKSPACE_ID);
  });

  test("normalizes missing shared UI defaults", () => {
    const state = normalizeAppState(
      {
        dailyPages: {
          "2026-03-11": { date: "2026-03-11", markdown: "", todos: [] },
        },
        notesDocs: {
          note_1: {
            id: "note_1",
            title: "Quick Notes",
            folderId: null,
            markdown: "",
            updatedAt: "2026-03-11T08:00:00.000Z",
          },
        },
        noteFolders: {},
        plannerPresets: {},
        uiState: {
          selectedDailyDate: "2026-03-11",
          selectedNoteId: "note_1",
          selectedNoteFolderId: null,
          selectedPlannerPresetId: null,
          expandedYears: ["2026"],
          expandedMonths: ["2026-03"],
          lastView: "todos",
        },
      },
      new Date("2026-03-11T08:00:00Z"),
    );

    expect(state.uiState.themeMode).toBe("dark");
    expect(state.uiState.isSidebarCollapsed).toBe(false);
    expect(state.uiState.hasSeenPlannerTour).toBe(false);
    expect(state.uiState.contentFontScale).toBe(CONTENT_FONT_SCALE_DEFAULT);
    expect(Object.keys(state.plannerPresets)).toHaveLength(1);
    expect(state.noteFolders[DEFAULT_NOTES_FOLDER_ID]).toBeDefined();
    expect(state.notesDocs.note_1.folderId).toBe(DEFAULT_NOTES_FOLDER_ID);
    expect(state.contentBoard.columns).toHaveLength(4);
    expect(state.todoWorkspaces[DEFAULT_TODO_WORKSPACE_ID].name).toBe("Main");
  });

  test("backfills planner subtitle and creation date from legacy metadata", () => {
    const initial = createInitialState("2026-03-11");
    const presetId = initial.uiState.selectedPlannerPresetId!;
    const legacyPreset: Record<string, unknown> = {
      ...initial.plannerPresets[presetId],
    };
    delete legacyPreset.subtitle;
    delete legacyPreset.createdAt;
    const state = normalizeAppState({
      ...initial,
      plannerPresets: { [presetId]: legacyPreset },
    });

    expect(state.plannerPresets[presetId].subtitle).toMatch(/reusable weekly rhythm/i);
    expect(state.plannerPresets[presetId].createdAt).toBe(legacyPreset.updatedAt);
  });

  test("migrates legacy planner blocks into reusable purposes", () => {
    const initial = createInitialState("2026-03-11");
    const presetId = initial.uiState.selectedPlannerPresetId!;
    initial.plannerPresets[presetId].days.monday.events = [
      {
        id: "legacy-office",
        purposeId: null,
        dayKey: "monday",
        title: "Office work",
        startMinutes: 540,
        endMinutes: 660,
        color: "teal",
        notes: "Focus",
      },
    ];
    const legacyPayload = JSON.parse(JSON.stringify(initial)) as {
      plannerPresets: Record<
        string,
        {
          days: Record<
            string,
            {
              purposes?: unknown;
              events: Array<Record<string, unknown>>;
            }
          >;
        }
      >;
    };
    const legacyMonday = legacyPayload.plannerPresets[presetId].days.monday;
    delete legacyMonday.purposes;
    delete legacyMonday.events[0].purposeId;

    const normalized = normalizeAppState(
      legacyPayload,
      new Date("2026-03-11T08:00:00Z"),
    );
    const monday = normalized.plannerPresets[presetId].days.monday;

    expect(monday.purposes).toHaveLength(1);
    expect(monday.purposes[0]).toMatchObject({
      title: "Office work",
      targetMinutes: 120,
      role: "primary",
    });
    expect(monday.events[0].purposeId).toBe(monday.purposes[0].id);
  });

  test("maps legacy daily lastView state to todos and discards planner branches", () => {
    const state = normalizeAppState(
      {
        dailyPages: {
          "2026-03-11": { date: "2026-03-11", markdown: "", todos: [] },
        },
        notesDocs: {},
        noteFolders: {},
        plannerPresets: {},
        contentIdeas: { idea_1: { id: "idea_1", hook: "Legacy" } },
        contentPlannerOptions: { pillars: [{ name: "Teach" }], platforms: [] },
        uiState: {
          selectedDailyDate: "2026-03-11",
          selectedNoteId: null,
          selectedNoteFolderId: null,
          selectedPlannerPresetId: null,
          selectedContentIdeaId: "idea_1",
          contentPlanner: { searchQuery: "legacy" },
          expandedYears: ["2026"],
          expandedMonths: ["2026-03"],
          lastView: "daily",
        },
      },
      new Date("2026-03-11T08:00:00Z"),
    );

    expect(state.uiState.lastView).toBe("todos");
    expect(state.contentCards).toEqual({});
    expect("contentIdeas" in state).toBe(false);
    expect("contentPlanner" in state.uiState).toBe(false);
  });

  test("clamps content font scale from persisted state", () => {
    const initial = createInitialState("2026-03-11");
    const state = normalizeAppState(
      {
        ...initial,
        uiState: { ...initial.uiState, contentFontScale: 9 },
      },
      new Date("2026-03-11T08:00:00Z"),
    );

    expect(state.uiState.contentFontScale).toBe(CONTENT_FONT_SCALE_MAX);
  });

  test("migrates legacy done-based todos without disturbing the content board", () => {
    const initial = createInitialState("2026-03-11");
    const state = normalizeAppState(
      {
        ...initial,
        dailyPages: {
          "2026-03-11": {
            date: "2026-03-11",
            markdown: "",
            todos: [
              {
                id: "todo_1",
                text: "Legacy task",
                priority: 1,
                done: true,
                createdAt: "2026-03-11T08:00:00.000Z",
              },
            ],
          },
        },
      },
      new Date("2026-03-11T08:00:00Z"),
    );

    expect(state.dailyPages["2026-03-11"].todos[0]).toMatchObject({
      status: "finished",
      estimatedMinutes: null,
    });
    expect(state.contentBoard.columns).toHaveLength(4);
  });

  test("rejects fractional card positions in persisted state", () => {
    const state = createInitialState("2026-03-11");
    const column = state.contentBoard.columns[0];
    const card = createContentCard({
      columnId: column.id,
      title: "Invalid order",
      order: 0,
    })!;

    const result = appStateSchema.safeParse({
      ...state,
      contentCards: {
        [card.id]: { ...card, order: 1.5 },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentCards).toEqual({});
    }
  });

  test("backfills missing content column subtitles", () => {
    const initial = createInitialState("2026-03-11");
    const legacyColumns = initial.contentBoard.columns.map((column) => ({
      id: column.id,
      title: column.title,
    }));

    const state = normalizeAppState(
      {
        ...initial,
        contentBoard: {
          ...initial.contentBoard,
          columns: legacyColumns,
        },
      },
      new Date("2026-03-11T08:00:00Z"),
    );

    expect(state.contentBoard.columns.map((column) => column.subtitle)).toEqual([
      "Capture the specific thought, not just the topic.",
      "Ideas worth keeping",
      "Ready to record — max 5",
      "Done and live",
    ]);
  });
});

describe("browser local cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("loads user-scoped cached state", () => {
    const cache = createBrowserLocalCacheStorage();
    const state = createInitialState("2026-03-11");
    state.uiState.contentFontScale = 1.15;

    window.localStorage.setItem(
      getUserCacheStorageKey("user_1"),
      JSON.stringify({
        state,
        metadata: createPersistenceMetadata(),
      }),
    );

    expect(
      cache.loadCached({ userId: "user_1", now: new Date("2026-03-11T08:00:00Z") }).envelope?.state
        .uiState.selectedDailyDate,
    ).toBe("2026-03-11");
    expect(
      cache.loadCached({ userId: "user_1", now: new Date("2026-03-11T08:00:00Z") }).envelope?.state
        .uiState.contentFontScale,
    ).toBe(1.15);
  });

  test("falls back to the legacy cache key during migration", () => {
    const cache = createBrowserLocalCacheStorage();
    const state = createInitialState("2026-03-11");

    window.localStorage.setItem(LEGACY_LOCAL_STORAGE_KEY, JSON.stringify(state));

    expect(
      cache.loadCached({ userId: "user_1", now: new Date("2026-03-11T08:00:00Z") }).envelope?.state
        .uiState.selectedDailyDate,
    ).toBe("2026-03-11");
  });

  test("drops legacy content planner record metadata from cache", () => {
    const cache = createBrowserLocalCacheStorage();
    const state = createInitialState("2026-03-11");

    window.localStorage.setItem(
      getUserCacheStorageKey("user_1"),
      JSON.stringify({
        state,
        metadata: {
          ...createPersistenceMetadata(),
          records: {
            "content_idea:old": {
              key: "content_idea:old",
              kind: "content_idea",
              fingerprint: "old",
              lastRemoteUpdatedAt: null,
              lastRemoteUpdatedAtClient: null,
            },
          },
        },
      }),
    );

    expect(
      cache.loadCached({ userId: "user_1", now: new Date("2026-03-11T08:00:00Z") }).envelope
        ?.metadata.records,
    ).toEqual({});
  });
});

describe("content planner persistence records", () => {
  test("serializes one board record and one record per card", () => {
    const state = createInitialState("2026-03-11");
    const column = state.contentBoard.columns[0];
    const card = createContentCard({
      columnId: column.id,
      title: "Launch story",
      notes: "Explain the change.",
      order: 0,
    })!;
    state.contentCards[card.id] = card;

    const records = getSyncRecordValuesFromState(state);

    expect(records["content_board:self"]).toMatchObject({
      key: "content_board:self",
      kind: "content_board",
      value: state.contentBoard,
    });
    expect(records[`content_card:${card.id}`]).toMatchObject({
      kind: "content_card",
      value: card,
    });
    expect(Object.values(records).map((record) => String(record.kind))).not.toContain(
      "content_idea",
    );
  });
});

describe("Todo workspace persistence records", () => {
  test("serializes workspace-scoped daily pages and the workspace registry", () => {
    const initial = createInitialState("2026-03-11");
    const state = createTodoWorkspaceInState(initial, "Work", "2026-03-11");
    const workspaceId = state.uiState.selectedTodoWorkspaceId;

    const records = getSyncRecordValuesFromState(state);

    expect(records[`daily_page:${DEFAULT_TODO_WORKSPACE_ID}:2026-03-11`]).toMatchObject({
      kind: "daily_page",
    });
    expect(records[`daily_page:${workspaceId}:2026-03-11`]).toMatchObject({
      kind: "daily_page",
    });
    expect(records["workspace_state:self"]).toMatchObject({
      kind: "workspace_state",
      value: {
        todoWorkspaces: state.todoWorkspaces,
        uiState: {
          selectedTodoWorkspaceId: workspaceId,
        },
      },
    });
  });
});
