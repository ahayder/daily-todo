import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";
import type { AuthSession } from "@/lib/auth";
import {
  createPersistenceMetadata,
  seedAppState,
  type PersistenceRecordMetadata,
  type PersistenceRepository,
  type ServerLoadResult,
} from "@/lib/persistence";
import { createEmptyDailyPage } from "@/lib/store";
import { toISODate } from "@/lib/date";
import { fingerprintSyncValue, getSyncRecordValuesFromState, type SyncOp } from "@/lib/sync-outbox";
import type { AppState } from "@/lib/types";
import { useAppPersistenceState } from "./use-app-persistence-state";

// These tests lock in the server-first safety rules at the hook level
// (the pure diff rules are covered in src/lib/sync-outbox.test.ts):
// - a failed server load never seeds, replaces or writes anything
// - content edits are dropped until the server's data is shown
// - records the device has but the server lacks are never deleted

beforeAll(() => {
  // jsdom has no matchMedia; the hook's theme effect needs it.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

const session: AuthSession ={ userId: "user_1", email: "user@example.com", isVerified: true };
const today = toISODate(new Date());

function serverRecordsFor(state: AppState): Record<string, PersistenceRecordMetadata> {
  const records: Record<string, PersistenceRecordMetadata> = {};
  for (const record of Object.values(getSyncRecordValuesFromState(state))) {
    records[record.key] = {
      key: record.key,
      kind: record.kind,
      fingerprint: fingerprintSyncValue(record.value),
      lastRemoteUpdatedAt: "2026-01-01T00:00:00.000Z",
      lastRemoteUpdatedAtClient: "2026-01-01T00:00:00.000Z",
    };
  }
  return records;
}

function withOldPage(state: AppState, date: string): AppState {
  return { ...state, dailyPages: { ...state.dailyPages, [date]: createEmptyDailyPage(date) } };
}

function createRepository(overrides: Partial<PersistenceRepository> = {}) {
  const applied: SyncOp[] = [];
  const repository: PersistenceRepository = {
    loadCached: vi.fn(() => null),
    loadServer: vi.fn(async () => {
      throw new Error("offline");
    }),
    applyOps: vi.fn(async ({ ops }) => {
      applied.push(...ops);
      return ops.map((op) => ({
        key: op.key,
        status: "written" as const,
        serverUpdatedAtClient: op.updatedAtClient,
      }));
    }),
    loadOutbox: vi.fn(() => []),
    saveOutbox: vi.fn(),
    saveLocalCache: vi.fn(),
    loadNoteBody: vi.fn(async () => ({ markdown: null, source: "none" }) as never),
    saveNoteBody: vi.fn(async () => ({ status: "saved" }) as never),
    primeRecentNoteCache: vi.fn(async () => {}),
    evictExpiredCachedBodies: vi.fn(async () => {}),
    clearUserData: vi.fn(async () => {}),
    ...overrides,
  };
  return { repository, applied };
}

function renderPersistence(repository: PersistenceRepository) {
  return renderHook(() =>
    useAppPersistenceState({ authStatus: "authenticated", repository, session }),
  );
}

function addTodo(result: { current: ReturnType<typeof useAppPersistenceState> }, text: string) {
  act(() => {
    result.current.value?.dispatch({ type: "add-todo", date: today, text, priority: "medium" });
  });
}

function todoTexts(state: AppState | null) {
  return Object.values(state?.dailyPages ?? {}).flatMap((page) => page.todos.map((todo) => todo.text));
}

describe("useAppPersistenceState — failed server load", () => {
  test("with no device copy, nothing is seeded and nothing is written", async () => {
    const { repository } = createRepository();
    const { result } = renderPersistence(repository);

    await waitFor(() => expect(result.current.loadError).toBe("Can’t reach the server right now."));

    expect(result.current.state).toBeNull();
    expect(repository.applyOps).not.toHaveBeenCalled();
    expect(repository.saveOutbox).not.toHaveBeenCalled();
    expect(repository.saveLocalCache).not.toHaveBeenCalled();
  });

  test("with a device copy, it is shown read-only and edits are dropped", async () => {
    const cachedState = seedAppState();
    const { repository } = createRepository({
      loadCached: vi.fn(() => ({ state: cachedState, metadata: createPersistenceMetadata() })),
    });
    const { result } = renderPersistence(repository);

    await waitFor(() => expect(result.current.loadError).toMatch(/read-only/));
    expect(result.current.state).toBe(cachedState);
    expect(result.current.value?.sync.isReadOnly).toBe(true);

    addTodo(result, "should not stick");

    expect(todoTexts(result.current.state)).not.toContain("should not stick");
    expect(repository.applyOps).not.toHaveBeenCalled();
    expect(repository.saveOutbox).not.toHaveBeenCalled();
    expect(repository.saveLocalCache).not.toHaveBeenCalled();
  });
});

describe("useAppPersistenceState — while the server is loading", () => {
  test("content edits on the cached copy are dropped", async () => {
    const cachedState = seedAppState();
    let resolveServer: (value: ServerLoadResult) => void = () => {};
    const { repository } = createRepository({
      loadCached: vi.fn(() => ({ state: cachedState, metadata: createPersistenceMetadata() })),
      loadServer: vi.fn(
        () => new Promise<ServerLoadResult>((resolve) => {
          resolveServer = resolve;
        }),
      ),
    });
    const { result } = renderPersistence(repository);

    await waitFor(() => expect(result.current.state).toBe(cachedState));
    addTodo(result, "too early");
    expect(todoTexts(result.current.state)).not.toContain("too early");

    const serverState = seedAppState();
    await act(async () => {
      resolveServer({ state: serverState, serverRecords: serverRecordsFor(serverState) });
    });
    await waitFor(() => expect(result.current.value?.sync.isReadOnly).toBe(false));
    expect(todoTexts(result.current.state)).not.toContain("too early");
  });
});

describe("useAppPersistenceState — server-first", () => {
  test("a page only this device has is never deleted on the server", async () => {
    // The device's copy has an old page the server doesn't return (e.g. a partial load).
    const cachedState = withOldPage(seedAppState(), "2026-01-15");
    const serverState = seedAppState();
    const { repository, applied } = createRepository({
      loadCached: vi.fn(() => ({ state: cachedState, metadata: createPersistenceMetadata() })),
      loadServer: vi.fn(async () => ({ state: serverState, serverRecords: serverRecordsFor(serverState) })),
    });
    const { result } = renderPersistence(repository);

    await waitFor(() => expect(result.current.value?.sync.isReadOnly).toBe(false));
    addTodo(result, "after load");

    await waitFor(() => expect(applied.length).toBeGreaterThan(0), { timeout: 3000 });
    expect(todoTexts(result.current.state)).toContain("after load");
    expect(applied.filter((op) => op.type === "delete")).toEqual([]);
  });
});
