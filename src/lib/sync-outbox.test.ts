import { beforeEach, describe, expect, test } from "vitest";
import { parseAppStateOrThrow } from "@/lib/persistence";
import {
  applySyncOpsToState,
  createBrowserOutboxStorage,
  diffSyncRecords,
  enqueueOps,
  fingerprintSyncValue,
  getMissingRecordOps,
  getSyncRecordValuesFromState,
  MAX_UNEXPLAINED_DELETES,
  mergeDailyPageConflict,
  sameTimestamp,
  type SyncOp,
} from "@/lib/sync-outbox";
import { createContentCard, createInitialState, getDailyPageKey } from "@/lib/store";
import type { AppState, DailyPage, Todo } from "@/lib/types";

const NOW = "2026-10-07T12:00:00.000Z";
const MAIN = "todo-workspace-main";

function todo(id: string, text: string, overrides: Partial<Todo> = {}): Todo {
  return {
    id,
    text,
    priority: 2,
    status: "pending",
    estimatedMinutes: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function withPages(state: AppState, dates: string[], workspaceId = MAIN): AppState {
  const dailyPages = { ...state.dailyPages };
  for (const date of dates) {
    dailyPages[getDailyPageKey(workspaceId, date)] = {
      date,
      markdown: `Notes for ${date}`,
      todos: [todo(`t-${date}`, `Task on ${date}`)],
    };
  }
  return { ...state, dailyPages };
}

function diff(prev: AppState, next: AppState) {
  return diffSyncRecords({
    prev: getSyncRecordValuesFromState(prev),
    next: getSyncRecordValuesFromState(next),
    serverRecords: {},
    now: NOW,
  });
}

function datesBetween(start: string, count: number) {
  const first = new Date(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(first.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

describe("diffSyncRecords — only this device's own edits, never deletes history", () => {
  test("the 2026-10-07 scenario: a device holding only today's page edits it → one upsert, no deletes", () => {
    const base = createInitialState("2026-10-07");
    const prev = withPages(base, ["2026-10-07"]);
    const todayKey = getDailyPageKey(MAIN, "2026-10-07");
    const next = {
      ...prev,
      dailyPages: { ...prev.dailyPages, [todayKey]: { ...prev.dailyPages[todayKey], markdown: "" } },
    };

    const { ops, blockedDeletes } = diff(prev, next);

    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ type: "upsert", key: `daily_page:${MAIN}:2026-10-07` });
    expect(ops.filter((op) => op.type === "delete")).toHaveLength(0);
    expect(blockedDeletes).toBe(0);
  });

  test("a state that suddenly loses all history never produces a daily-page delete", () => {
    const base = createInitialState("2026-10-07");
    const prev = withPages(base, datesBetween("2026-08-01", 55));
    const next = { ...prev, dailyPages: {} };

    const { ops } = diff(prev, next);

    expect(ops.filter((op) => op.kind === "daily_page" && op.type === "delete")).toHaveLength(0);
  });

  test("clearing a page's text and finishing its tasks is an upsert, not a delete", () => {
    const prev = withPages(createInitialState("2026-10-07"), ["2026-10-06"]);
    const key = getDailyPageKey(MAIN, "2026-10-06");
    const next = {
      ...prev,
      dailyPages: { ...prev.dailyPages, [key]: { date: "2026-10-06", markdown: "", todos: [] } },
    };

    expect(diff(prev, next).ops).toEqual([
      expect.objectContaining({ type: "upsert", key: `daily_page:${MAIN}:2026-10-06` }),
    ]);
  });

  test("deleting a workspace removes it from the registry but never deletes its pages", () => {
    const base = createInitialState("2026-10-07");
    const workspaceId = "todo-workspace_extra";
    const prev = withPages(
      {
        ...base,
        todoWorkspaces: {
          ...base.todoWorkspaces,
          [workspaceId]: { id: workspaceId, name: "Extra", createdAt: NOW, updatedAt: NOW },
        },
      },
      ["2026-10-01", "2026-10-02"],
      workspaceId,
    );
    const { [workspaceId]: _removed, ...todoWorkspaces } = prev.todoWorkspaces;
    void _removed;
    const dailyPages = Object.fromEntries(
      Object.entries(prev.dailyPages).filter(([key]) => !key.startsWith(workspaceId)),
    );
    const next = { ...prev, todoWorkspaces, dailyPages };

    const { ops } = diff(prev, next);

    expect(ops.map((op) => `${op.type}:${op.kind}`)).toEqual(["upsert:workspace_state"]);
  });

  test("deleting one note sends exactly one delete", () => {
    const prev = createInitialState("2026-10-07");
    const noteId = Object.keys(prev.notesDocs)[0];
    const next = { ...prev, notesDocs: {} };

    const { ops } = diff(prev, next);

    expect(ops).toEqual([expect.objectContaining({ type: "delete", key: `note:${noteId}` })]);
  });

  test("more than the allowed number of deletes at once is blocked as a likely bug", () => {
    const base = createInitialState("2026-10-07");
    const column = base.contentBoard.columns[0].id;
    const cards = Object.fromEntries(
      Array.from({ length: MAX_UNEXPLAINED_DELETES + 5 }, (_, index) => {
        const card = createContentCard({ columnId: column, title: `Card ${index}`, order: index })!;
        return [card.id, card];
      }),
    );
    const prev = { ...base, contentCards: cards };
    const next = { ...base, contentCards: {} };

    const { ops, blockedDeletes } = diff(prev, next);

    expect(ops.filter((op) => op.type === "delete")).toHaveLength(0);
    expect(blockedDeletes).toBe(MAX_UNEXPLAINED_DELETES + 5);
  });

  test("deleting a folder with many notes is allowed (the note deletes are explained)", () => {
    const base = createInitialState("2026-10-07");
    const folderId = "folder-big";
    const notes = Object.fromEntries(
      Array.from({ length: 8 }, (_, index) => [
        `note-${index}`,
        { id: `note-${index}`, title: `Note ${index}`, folderId, updatedAt: NOW },
      ]),
    );
    const prev = {
      ...base,
      noteFolders: { ...base.noteFolders, [folderId]: { id: folderId, name: "Big", parentId: null, updatedAt: NOW } },
      notesDocs: { ...base.notesDocs, ...notes },
    };
    const next = { ...base };

    const { ops, blockedDeletes } = diff(prev, next);

    expect(blockedDeletes).toBe(0);
    expect(ops.filter((op) => op.type === "delete")).toHaveLength(9);
  });

  test("never re-sends records that are already identical on the server (stale copy replaced by fresh data)", () => {
    const fresh = withPages(createInitialState("2026-10-07"), datesBetween("2026-09-01", 20));
    const stale = { ...fresh, dailyPages: {} };
    const serverRecords = Object.fromEntries(
      Object.values(getSyncRecordValuesFromState(fresh)).map((record) => [
        record.key,
        {
          key: record.key,
          kind: record.kind,
          fingerprint: fingerprintSyncValue(record.value),
          lastRemoteUpdatedAt: null,
          lastRemoteUpdatedAtClient: null,
        },
      ]),
    );

    const { ops } = diffSyncRecords({
      prev: getSyncRecordValuesFromState(stale),
      next: getSyncRecordValuesFromState(fresh),
      serverRecords,
      now: NOW,
    });

    expect(ops).toEqual([]);
  });

  test("records the server version this device last saw, for the version check", () => {
    const prev = withPages(createInitialState("2026-10-07"), ["2026-10-06"]);
    const key = getDailyPageKey(MAIN, "2026-10-06");
    const recordKey = `daily_page:${MAIN}:2026-10-06`;
    const next = {
      ...prev,
      dailyPages: { ...prev.dailyPages, [key]: { ...prev.dailyPages[key], markdown: "edited" } },
    };

    const { ops } = diffSyncRecords({
      prev: getSyncRecordValuesFromState(prev),
      next: getSyncRecordValuesFromState(next),
      serverRecords: {
        [recordKey]: {
          key: recordKey,
          kind: "daily_page",
          fingerprint: "",
          lastRemoteUpdatedAt: null,
          lastRemoteUpdatedAtClient: "2026-10-06 18:00:00.000Z",
        },
      },
      now: NOW,
    });

    expect(ops[0].baseUpdatedAtClient).toBe("2026-10-06 18:00:00.000Z");
    expect(ops[0].base?.kind).toBe("daily_page");
  });
});

describe("outbox", () => {
  function op(key: string, overrides: Partial<SyncOp> = {}): SyncOp {
    const record = { key, kind: "daily_page" as const, value: { date: "2026-10-07", markdown: "", todos: [] } };
    return {
      key,
      kind: "daily_page",
      type: "upsert",
      record,
      base: record,
      baseUpdatedAtClient: "2026-10-07 08:00:00.000Z",
      updatedAtClient: NOW,
      ...overrides,
    };
  }

  test("keeps one entry per record, with the first edit's base", () => {
    const first = op("daily_page:a:2026-10-07");
    const second = op("daily_page:a:2026-10-07", {
      baseUpdatedAtClient: "later",
      updatedAtClient: "2026-10-07T12:05:00.000Z",
    });

    const outbox = enqueueOps(enqueueOps([], [first]), [second]);

    expect(outbox).toHaveLength(1);
    expect(outbox[0].updatedAtClient).toBe("2026-10-07T12:05:00.000Z");
    expect(outbox[0].baseUpdatedAtClient).toBe("2026-10-07 08:00:00.000Z");
  });

  test("deleting a record that never reached the server just drops it", () => {
    const created = op("note:new", { base: null, baseUpdatedAtClient: null });
    const outbox = enqueueOps([created], [op("note:new", { type: "delete" })]);

    expect(outbox).toEqual([]);
  });

  test("survives a reload through localStorage", () => {
    window.localStorage.clear();
    const storage = createBrowserOutboxStorage();
    storage.save({ userId: "user_1", ops: [op("daily_page:a:2026-10-07")] });

    expect(createBrowserOutboxStorage().load({ userId: "user_1" })).toHaveLength(1);

    storage.save({ userId: "user_1", ops: [] });
    expect(createBrowserOutboxStorage().load({ userId: "user_1" })).toEqual([]);
  });

  test("queued edits are laid over fresh server data", () => {
    const server = withPages(createInitialState("2026-10-07"), ["2026-10-06", "2026-10-07"]);
    const edited: DailyPage = { date: "2026-10-07", markdown: "Written offline", todos: [] };
    const overlaid = applySyncOpsToState(server, [
      op(`daily_page:${MAIN}:2026-10-07`, {
        record: { key: `daily_page:${MAIN}:2026-10-07`, kind: "daily_page", value: edited },
      }),
    ]);

    expect(overlaid.dailyPages["2026-10-07"]).toEqual(edited);
    expect(overlaid.dailyPages["2026-10-06"]).toEqual(server.dailyPages["2026-10-06"]);
  });
});

describe("getMissingRecordOps", () => {
  test("only creates records the server doesn't have; never touches existing ones", () => {
    const state = withPages(createInitialState("2026-10-07"), ["2026-10-06", "2026-10-07"]);
    const values = getSyncRecordValuesFromState(state);
    const serverRecords = Object.fromEntries(
      Object.values(values)
        .filter((record) => record.key !== `daily_page:${MAIN}:2026-10-07`)
        .map((record) => [
          record.key,
          { key: record.key, kind: record.kind, fingerprint: "", lastRemoteUpdatedAt: null, lastRemoteUpdatedAtClient: null },
        ]),
    );

    const ops = getMissingRecordOps({ state, serverRecords, outbox: [], now: NOW });

    expect(ops).toEqual([
      expect.objectContaining({ type: "upsert", key: `daily_page:${MAIN}:2026-10-07`, base: null }),
    ]);
  });
});

describe("mergeDailyPageConflict", () => {
  const base: DailyPage = {
    date: "2026-10-07",
    markdown: "Plan",
    todos: [todo("a", "Write post"), todo("b", "Call bank"), todo("c", "Gym")],
  };

  test("keeps edits from both devices", () => {
    const local: DailyPage = {
      ...base,
      todos: [todo("a", "Write post", { status: "finished" }), todo("b", "Call bank"), todo("c", "Gym")],
    };
    const server: DailyPage = {
      ...base,
      todos: [...base.todos, todo("d", "Added on phone")],
    };

    const merged = mergeDailyPageConflict({ base, local, server });

    expect(merged.todos.find((item) => item.id === "a")?.status).toBe("finished");
    expect(merged.todos.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(merged.markdown).toBe("Plan");
  });

  test("a todo deleted on one side stays deleted unless the other side edited it", () => {
    const local: DailyPage = { ...base, todos: [todo("a", "Write post"), todo("c", "Gym")] };
    const server: DailyPage = {
      ...base,
      todos: [todo("a", "Write post"), todo("b", "Call bank"), todo("c", "Gym — 6pm")],
    };

    const merged = mergeDailyPageConflict({ base, local, server });

    expect(merged.todos.map((item) => item.id)).toEqual(["a", "c"]);
    expect(merged.todos.find((item) => item.id === "c")?.text).toBe("Gym — 6pm");
  });

  test("note text: takes the side that changed, and keeps both when both changed", () => {
    expect(mergeDailyPageConflict({ base, local: { ...base, markdown: "Mine" }, server: base }).markdown).toBe(
      "Mine",
    );
    expect(mergeDailyPageConflict({ base, local: base, server: { ...base, markdown: "Theirs" } }).markdown).toBe(
      "Theirs",
    );

    const both = mergeDailyPageConflict({
      base,
      local: { ...base, markdown: "Mine" },
      server: { ...base, markdown: "Theirs" },
    }).markdown;
    expect(both).toContain("Mine");
    expect(both).toContain("Theirs");
  });
});

describe("helpers", () => {
  beforeEach(() => {
    document.getElementById("schema-error-box")?.remove();
  });

  test("fingerprints ignore key order (PocketBase returns keys in its own order)", () => {
    expect(fingerprintSyncValue({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      fingerprintSyncValue({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }),
    );
  });

  test("sameTimestamp treats PocketBase and ISO formats as equal", () => {
    expect(sameTimestamp("2026-10-07 10:14:55.542Z", "2026-10-07T10:14:55.542Z")).toBe(true);
    expect(sameTimestamp("2026-10-07 10:14:55.542Z", "2026-10-07T10:14:56.000Z")).toBe(false);
    expect(sameTimestamp(null, null)).toBe(true);
    expect(sameTimestamp("2026-10-07 10:14:55.542Z", null)).toBe(false);
  });

  test("bad server data throws instead of becoming an empty workspace", () => {
    expect(() => parseAppStateOrThrow({ dailyPages: "broken" })).toThrow();
  });
});
