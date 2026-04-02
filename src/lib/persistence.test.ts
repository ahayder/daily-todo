import { beforeEach, describe, expect, test, vi } from "vitest";
import { createBrowserLocalCacheStorage, getUserCacheStorageKey } from "@/lib/local-cache-storage";
import {
  LEGACY_LOCAL_STORAGE_KEY,
  createPersistenceMetadata,
  normalizeAppState,
} from "@/lib/persistence";
import { SnapshotPersistenceRepository } from "@/lib/snapshot-persistence-repository";
import { SplitPersistenceRepository } from "@/lib/split-persistence-repository";
import { DEFAULT_NOTES_FOLDER_ID, createInitialState } from "@/lib/store";
import type { AppState } from "@/lib/types";

describe("normalizeAppState", () => {
  test("seeds initial state when payload is empty", () => {
    const state = normalizeAppState(null, new Date("2026-03-11T08:00:00Z"));

    expect(state.dailyPages["2026-03-11"]).toBeDefined();
    expect(Object.keys(state.notesDocs).length).toBeGreaterThan(0);
    expect(Object.keys(state.plannerPresets).length).toBeGreaterThan(0);
  });

  test("normalizes missing themeMode and sidebar state", () => {
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
    expect(Object.keys(state.plannerPresets)).toHaveLength(1);
    expect(state.noteFolders[DEFAULT_NOTES_FOLDER_ID]).toBeDefined();
    expect(state.notesDocs.note_1.folderId).toBe(DEFAULT_NOTES_FOLDER_ID);
    expect(state.uiState.selectedNoteFolderId).toBe(DEFAULT_NOTES_FOLDER_ID);
    expect(state.uiState.expandedNoteFolders).toContain(DEFAULT_NOTES_FOLDER_ID);
  });

  test("maps legacy daily lastView state to todos", () => {
    const state = normalizeAppState(
      {
        dailyPages: {
          "2026-03-11": { date: "2026-03-11", markdown: "", todos: [] },
        },
        notesDocs: {},
        noteFolders: {},
        plannerPresets: {},
        uiState: {
          selectedDailyDate: "2026-03-11",
          selectedNoteId: null,
          selectedNoteFolderId: null,
          selectedPlannerPresetId: null,
          expandedYears: ["2026"],
          expandedMonths: ["2026-03"],
          lastView: "daily",
        },
      },
      new Date("2026-03-11T08:00:00Z"),
    );

    expect(state.uiState.lastView).toBe("todos");
  });

  test("migrates legacy done-based todos into status and estimate fields", () => {
    const state = normalizeAppState(
      {
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
        notesDocs: {},
        noteFolders: {},
        plannerPresets: {},
        uiState: {
          selectedDailyDate: "2026-03-11",
          selectedNoteId: null,
          selectedNoteFolderId: null,
          selectedPlannerPresetId: null,
          expandedYears: ["2026"],
          expandedMonths: ["2026-03"],
          lastView: "todos",
        },
      },
      new Date("2026-03-11T08:00:00Z"),
    );

    expect(state.dailyPages["2026-03-11"].todos[0]).toMatchObject({
      status: "finished",
      estimatedMinutes: null,
    });
  });
});

describe("browser local cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("loads user-scoped cached state", () => {
    const cache = createBrowserLocalCacheStorage();
    const state = createInitialState("2026-03-11");

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
