import { beforeEach, describe, expect, test, vi } from "vitest";
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
import { SnapshotPersistenceRepository } from "@/lib/snapshot-persistence-repository";
import { SplitPersistenceRepository } from "@/lib/split-persistence-repository";
import {
  getSyncRecordValuesFromState,
  hasUnsavedDailyPage,
  isUntouchedEmptyDailyPage,
} from "@/lib/pocketbase/persistence-repository";
import { appStateSchema } from "@/lib/schema";
import {
  DEFAULT_NOTES_FOLDER_ID,
  createContentCard,
  createInitialState,
} from "@/lib/store";
import type { AppState } from "@/lib/types";

describe("normalizeAppState", () => {
  test("seeds initial state when payload is empty", () => {
    const state = normalizeAppState(null, new Date("2026-03-11T08:00:00Z"));

    expect(state.dailyPages["2026-03-11"]).toBeDefined();
    expect(Object.keys(state.notesDocs).length).toBeGreaterThan(0);
    expect(Object.keys(state.plannerPresets).length).toBeGreaterThan(0);
    expect(state.contentBoard.columns.map((column) => column.title)).toEqual([
      "Ideas",
      "Planned",
      "In Progress",
      "Ready",
      "Published",
    ]);
    expect(state.contentCards).toEqual({});
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
    expect(state.uiState.contentFontScale).toBe(CONTENT_FONT_SCALE_DEFAULT);
    expect(Object.keys(state.plannerPresets)).toHaveLength(1);
    expect(state.noteFolders[DEFAULT_NOTES_FOLDER_ID]).toBeDefined();
    expect(state.notesDocs.note_1.folderId).toBe(DEFAULT_NOTES_FOLDER_ID);
    expect(state.contentBoard.columns).toHaveLength(5);
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
    expect(state.contentBoard.columns).toHaveLength(5);
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
      "Capture raw concepts",
      "Ready to work on",
      "Currently being created",
      "Prepared to publish",
      "Live and complete",
    ]);
  });
});

describe("PocketBase daily-page backfill", () => {
  test("detects a synthesized rollover page that has not been written remotely", () => {
    const state = createInitialState("2026-03-11");
    const previousPageRecord = {
      key: "daily_page:2026-03-10",
      kind: "daily_page" as const,
      fingerprint: "previous",
      lastRemoteUpdatedAt: "2026-03-10T08:00:00.000Z",
      lastRemoteUpdatedAtClient: "2026-03-10T08:00:00.000Z",
    };

    expect(
      hasUnsavedDailyPage(state, {
        "daily_page:2026-03-10": previousPageRecord,
      }),
    ).toBe(true);

    expect(
      hasUnsavedDailyPage(state, {
        "daily_page:2026-03-10": previousPageRecord,
        "daily_page:2026-03-11": {
          ...previousPageRecord,
          key: "daily_page:2026-03-11",
        },
      }),
    ).toBe(false);
  });

  test("repairs only an empty daily page that has not been edited since creation", () => {
    const page = createInitialState("2026-03-11").dailyPages["2026-03-11"];

    expect(
      isUntouchedEmptyDailyPage(
        page,
        "2026-03-11T00:00:00.000Z",
        "2026-03-11T00:00:00.500Z",
      ),
    ).toBe(true);
    expect(
      isUntouchedEmptyDailyPage(
        page,
        "2026-03-11T00:00:00.000Z",
        "2026-03-11T00:10:00.000Z",
      ),
    ).toBe(false);
    expect(
      isUntouchedEmptyDailyPage(
        { ...page, markdown: "User content" },
        "2026-03-11T00:00:00.000Z",
        "2026-03-11T00:00:00.000Z",
      ),
    ).toBe(false);
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

describe("SnapshotPersistenceRepository", () => {
  test("returns the remote snapshot when available and updates cache", async () => {
    const state = createInitialState("2026-03-11");
    const cache = {
      loadCached: vi.fn(() => ({ envelope: null, available: true })),
      saveCached: vi.fn(() => ({ available: true })),
      clearCached: vi.fn(() => ({ available: true })),
    };
    const remote = {
      loadSnapshot: vi.fn(async () => ({
        state,
        stateVersion: 1,
        updatedAt: "2026-03-11T08:00:01.000Z",
        updatedAtClient: "2026-03-11T08:00:00.000Z",
      })),
      saveSnapshot: vi.fn(),
    };

    const repository = new SnapshotPersistenceRepository(remote, cache);
    const loaded = await repository.load({
      userId: "user_1",
      now: new Date("2026-03-11T08:00:00Z"),
    });

    expect(loaded.source).toBe("remote");
    expect(loaded.status).toBe("synced");
    expect(remote.loadSnapshot).toHaveBeenCalledWith({ userId: "user_1" });
    expect(cache.saveCached).toHaveBeenCalledWith({
      userId: "user_1",
      envelope: {
        state: loaded.state,
        metadata: loaded.metadata,
      },
    });
  });

  test("falls back to cached state and backfills remote when remote is empty", async () => {
    const cached = createInitialState("2026-03-11");
    const cache = {
      loadCached: vi.fn(() => ({
        envelope: {
          state: cached,
          metadata: createPersistenceMetadata({
            lastLocalMutationAt: "2026-03-11T08:00:00.000Z",
          }),
        },
        available: true,
      })),
      saveCached: vi.fn(() => ({ available: true })),
      clearCached: vi.fn(() => ({ available: true })),
    };
    const remote = {
      loadSnapshot: vi.fn(async () => null),
      saveSnapshot: vi.fn(async () => ({
        state: cached,
        stateVersion: 1,
        updatedAt: "2026-03-11T08:00:01.000Z",
        updatedAtClient: "2026-03-11T08:00:00.000Z",
      })),
    };

    const repository = new SnapshotPersistenceRepository(remote, cache);
    const loaded = await repository.load({
      userId: "user_1",
      now: new Date("2026-03-11T08:00:00Z"),
    });

    expect(loaded.state).toEqual(cached);
    expect(remote.saveSnapshot).toHaveBeenCalledWith({
      userId: "user_1",
      state: cached,
      updatedAtClient: "2026-03-11T08:00:00.000Z",
      knownRemoteUpdatedAt: null,
    });
  });

  test("writes cache before remote on save", async () => {
    const state = createInitialState("2026-03-11");
    const calls: string[] = [];
    const cache = {
      loadCached: vi.fn(() => ({ envelope: null, available: true })),
      saveCached: vi.fn(({ envelope }: { envelope: { state: AppState } }) => {
        calls.push(`cache:${envelope.state.uiState.selectedDailyDate}`);
        return { available: true };
      }),
      clearCached: vi.fn(() => ({ available: true })),
    };
    const remote = {
      loadSnapshot: vi.fn(async () => null),
      saveSnapshot: vi.fn(async ({ state: nextState }: { state: AppState }) => {
        calls.push(`remote:${nextState.uiState.selectedDailyDate}`);
        return {
          state: nextState,
          stateVersion: 1,
          updatedAt: "2026-03-11T08:00:01.000Z",
          updatedAtClient: "2026-03-11T08:00:00.000Z",
        };
      }),
    };

    const repository = new SnapshotPersistenceRepository(remote, cache);
    await repository.save({
      userId: "user_1",
      state,
      baseMetadata: createPersistenceMetadata(),
      now: new Date("2026-03-11T08:00:00Z"),
    });

    expect(calls).toEqual(["cache:2026-03-11", "remote:2026-03-11", "cache:2026-03-11"]);
  });
});

describe("SplitPersistenceRepository", () => {
  test("returns cached state immediately and reconciles remote in the background", async () => {
    const cached = createInitialState("2026-03-11");
    const remoteState = {
      ...cached,
      notesDocs: {
        ...cached.notesDocs,
        note_2: {
          id: "note_2",
          title: "From remote",
          folderId: DEFAULT_NOTES_FOLDER_ID,
          markdown: "",
          updatedAt: "2026-03-11T08:05:00.000Z",
        },
      },
    };
    const cache = {
      loadCached: vi.fn(() => ({
        envelope: {
          state: cached,
          metadata: createPersistenceMetadata({ hasMigratedToSplitStore: true }),
        },
        available: true,
      })),
      saveCached: vi.fn(() => ({ available: true })),
      clearCached: vi.fn(() => ({ available: true })),
    };
    const remoteStore = {
      loadRemoteState: vi.fn(async () => ({
        state: remoteState,
        source: "remote" as const,
        status: "synced" as const,
        metadata: createPersistenceMetadata({ hasMigratedToSplitStore: true }),
        conflictResolution: "remote-overwrote-local" as const,
        notice: "Newer changes from another device were loaded.",
        errorMessage: null,
        persistenceAvailable: true,
      })),
      saveRemoteState: vi.fn(),
    };

    const onRemoteSync = vi.fn();
    const repository = new SplitPersistenceRepository(remoteStore, cache);
    const loaded = await repository.load({
      userId: "user_1",
      now: new Date("2026-03-11T08:00:00Z"),
      onRemoteSync,
    });

    expect(loaded.source).toBe("local");
    expect(loaded.status).toBe("syncing");

    await vi.waitFor(() => {
      expect(onRemoteSync).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "remote",
          state: remoteState,
        }),
      );
    });
  });

  test("writes resolved state back to cache after save", async () => {
    const state = createInitialState("2026-03-11");
    const resolvedState = {
      ...state,
      uiState: {
        ...state.uiState,
        selectedDailyDate: "2026-03-12",
      },
    };
    const cacheWrites: string[] = [];
    const cache = {
      loadCached: vi.fn(() => ({ envelope: null, available: true })),
      saveCached: vi.fn(({ envelope }: { envelope: { state: AppState } }) => {
        cacheWrites.push(envelope.state.uiState.selectedDailyDate ?? "none");
        return { available: true };
      }),
      clearCached: vi.fn(() => ({ available: true })),
    };
    const remoteStore = {
      loadRemoteState: vi.fn(),
      saveRemoteState: vi.fn(async () => ({
        status: "synced" as const,
        metadata: createPersistenceMetadata({ hasMigratedToSplitStore: true }),
        conflictResolution: "remote-overwrote-local" as const,
        notice: "Newer changes from another device were loaded.",
        errorMessage: null,
        resolvedState,
      })),
    };

    const repository = new SplitPersistenceRepository(remoteStore, cache);
    const saved = await repository.save({
      userId: "user_1",
      state,
      baseMetadata: createPersistenceMetadata(),
      now: new Date("2026-03-11T08:00:00Z"),
    });

    expect(saved.resolvedState).toEqual(resolvedState);
    expect(cacheWrites).toEqual(["2026-03-11", "2026-03-12"]);
  });
});
