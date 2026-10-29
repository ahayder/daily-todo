import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SyncOp } from "@/lib/sync-outbox";

type Row = Record<string, unknown> & { id: string };

// A tiny in-memory PocketBase: enough of the SDK surface the repository uses.
const db: Record<string, Row[]> = {};
const writes: string[] = [];
let nextId = 1;

function parseFilter(filter: string): { expr: string; params: Record<string, string> } {
  try {
    return JSON.parse(filter);
  } catch {
    // Raw `owner="..."` filters from the full-list reads.
    const owner = /owner="([^"]+)"/.exec(filter)?.[1] ?? "";
    return { expr: "owner = {:owner}", params: { owner } };
  }
}

function matches(row: Row, filter: string) {
  const { expr, params } = parseFilter(filter);
  if (row.owner !== params.owner) return false;
  if (params.date !== undefined && row.date !== params.date) return false;
  if (params.workspace !== undefined) {
    const allowLegacy = expr.includes('workspace_id = ""');
    if (row.workspace_id !== params.workspace && !(allowLegacy && row.workspace_id === "")) return false;
  }
  const idField = /(\w+) = \{:id\}/.exec(expr)?.[1];
  if (idField && row[idField] !== params.id) return false;
  return true;
}

const fakeClient = {
  filter: (expr: string, params: Record<string, string>) => JSON.stringify({ expr, params }),
  collection: (name: string) => ({
    getFullList: async ({ filter }: { filter: string }) => (db[name] ?? []).filter((row) => matches(row, filter)),
    getList: async (_page: number, _perPage: number, { filter }: { filter: string }) => ({
      items: (db[name] ?? []).filter((row) => matches(row, filter)),
    }),
    create: async (payload: Record<string, unknown>) => {
      writes.push(`create:${name}`);
      const row = { ...payload, id: `row_${nextId++}` } as Row;
      (db[name] ??= []).push(row);
      return row;
    },
    update: async (id: string, payload: Record<string, unknown>) => {
      writes.push(`update:${name}`);
      const row = (db[name] ?? []).find((candidate) => candidate.id === id)!;
      Object.assign(row, payload);
      return row;
    },
    delete: async (id: string) => {
      writes.push(`delete:${name}`);
      db[name] = (db[name] ?? []).filter((row) => row.id !== id);
      return true;
    },
  }),
};

vi.mock("@/lib/pocketbase/client", () => ({
  getPocketBaseClient: () => fakeClient,
}));

const { changeRequestFromRow, changeRequestToRow, createPocketBasePersistenceRepository } = await import(
  "@/lib/pocketbase/persistence-repository"
);
const { createDefaultContentBoard } = await import("@/lib/store");

const OWNER = "user_1";
const MAIN = "todo-workspace-main";

function seedPage(date: string, overrides: Partial<Row> = {}) {
  (db.daily_pages ??= []).push({
    id: `page_${date}`,
    owner: OWNER,
    workspace_id: MAIN,
    date,
    markdown: `Notes ${date}`,
    todos_json: [],
    updated_at_client: "2026-10-07 08:00:00.000Z",
    ...overrides,
  });
}

function pageOp(date: string, value: { markdown: string; todos?: unknown[] }, overrides: Partial<SyncOp> = {}): SyncOp {
  const key = `daily_page:${MAIN}:${date}`;
  return {
    key,
    kind: "daily_page",
    type: "upsert",
    record: { key, kind: "daily_page", value: { date, markdown: value.markdown, todos: (value.todos ?? []) as [] } },
    base: { key, kind: "daily_page", value: { date, markdown: `Notes ${date}`, todos: [] } },
    baseUpdatedAtClient: "2026-10-07 08:00:00.000Z",
    updatedAtClient: "2026-10-07T12:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  writes.length = 0;
  nextId = 1;
});

describe("PocketBase repository (server-first)", () => {
  test("loading reads everything and never writes", async () => {
    seedPage("2026-09-23");
    seedPage("2026-09-24");
    const repository = createPocketBasePersistenceRepository();

    const result = await repository.loadServer({ userId: OWNER, now: new Date("2026-10-07T12:00:00Z") });

    expect(writes).toEqual([]);
    expect(result.state.dailyPages["2026-09-24"].markdown).toBe("Notes 2026-09-24");
    expect(Object.keys(result.serverRecords)).toContain(`daily_page:${MAIN}:2026-09-23`);
    // Today's page is synthesized locally (carried over) but not on the server.
    expect(result.state.dailyPages["2026-10-07"]).toBeDefined();
    expect(result.serverRecords[`daily_page:${MAIN}:2026-10-07`]).toBeUndefined();
  });

  test("writes only the record that changed", async () => {
    seedPage("2026-10-06");
    seedPage("2026-10-07");
    const repository = createPocketBasePersistenceRepository();

    const results = await repository.applyOps({
      userId: OWNER,
      ops: [pageOp("2026-10-07", { markdown: "" })],
    });

    expect(results).toEqual([expect.objectContaining({ status: "written" })]);
    expect(writes).toEqual(["update:daily_pages"]);
    expect(db.daily_pages).toHaveLength(2);
    expect(db.daily_pages.find((row) => row.date === "2026-10-07")?.markdown).toBe("");
  });

  test("never deletes a daily page, even when asked", async () => {
    seedPage("2026-10-06");
    const repository = createPocketBasePersistenceRepository();

    const results = await repository.applyOps({
      userId: OWNER,
      ops: [pageOp("2026-10-06", { markdown: "Notes 2026-10-06" }, { type: "delete" })],
    });

    expect(results).toEqual([expect.objectContaining({ status: "skipped" })]);
    expect(db.daily_pages).toHaveLength(1);
  });

  test("merges instead of overwriting when another device changed the page", async () => {
    seedPage("2026-10-07", {
      markdown: "Notes 2026-10-07",
      todos_json: [{ id: "phone", text: "Added on phone", priority: 2, status: "pending", estimatedMinutes: null, createdAt: "x" }],
      updated_at_client: "2026-10-07 11:00:00.000Z",
    });
    const repository = createPocketBasePersistenceRepository();

    const results = await repository.applyOps({
      userId: OWNER,
      ops: [
        pageOp(
          "2026-10-07",
          {
            markdown: "Notes 2026-10-07",
            todos: [{ id: "laptop", text: "Added on laptop", priority: 2, status: "pending", estimatedMinutes: null, createdAt: "x" }],
          },
          {
            base: { key: `daily_page:${MAIN}:2026-10-07`, kind: "daily_page", value: { date: "2026-10-07", markdown: "Notes 2026-10-07", todos: [] } },
          },
        ),
      ],
    });

    expect(results[0].status).toBe("merged");
    const saved = db.daily_pages[0].todos_json as Array<{ id: string }>;
    expect(saved.map((item) => item.id).sort()).toEqual(["laptop", "phone"]);
  });

  test("updates a legacy Main page stored with an empty workspace id instead of duplicating it", async () => {
    seedPage("2026-09-01", { workspace_id: "" });
    const repository = createPocketBasePersistenceRepository();

    await repository.applyOps({ userId: OWNER, ops: [pageOp("2026-09-01", { markdown: "edited" })] });

    expect(db.daily_pages).toHaveLength(1);
    expect(db.daily_pages[0].markdown).toBe("edited");
  });

  test("creates a page the server doesn't have yet", async () => {
    const repository = createPocketBasePersistenceRepository();

    await repository.applyOps({
      userId: OWNER,
      ops: [pageOp("2026-10-07", { markdown: "Carried over" }, { base: null, baseUpdatedAtClient: null })],
    });

    expect(writes).toEqual(["create:daily_pages"]);
    expect(db.daily_pages[0]).toMatchObject({ owner: OWNER, workspace_id: MAIN, markdown: "Carried over" });
  });
});

describe("Content series (PocketBase mapping)", () => {
  const COLUMNS = createDefaultContentBoard().columns;
  const SERIES = { id: "money", title: "Money basics", about: "For students", createdAt: "2026-10-01T00:00:00.000Z" };

  test("reads series from the board and series_id from cards; empty values stay absent", async () => {
    db.content_boards = [
      { id: "board_1", owner: OWNER, columns_json: COLUMNS, series_json: [SERIES, { id: "", title: "broken" }], updated_at_client: "2026-10-07 08:00:00.000Z" },
    ];
    db.content_cards = [
      { id: "c1", owner: OWNER, card_id: "in", column_id: "content-column-inbox", title: "In", position: 0, series_id: "money", updated_at_client: "2026-10-07 08:00:00.000Z" },
      { id: "c2", owner: OWNER, card_id: "out", column_id: "content-column-inbox", title: "Out", position: 1, series_id: "", updated_at_client: "2026-10-07 08:00:00.000Z" },
    ];
    const repository = createPocketBasePersistenceRepository();

    const result = await repository.loadServer({ userId: OWNER, now: new Date("2026-10-07T12:00:00Z") });

    expect(result.state.contentBoard.series).toEqual([SERIES]);
    expect(result.state.contentCards.in.seriesId).toBe("money");
    expect("seriesId" in result.state.contentCards.out).toBe(false);
  });

  test("a board without series_json loads without a series list", async () => {
    db.content_boards = [{ id: "board_1", owner: OWNER, columns_json: COLUMNS, updated_at_client: "2026-10-07 08:00:00.000Z" }];
    const repository = createPocketBasePersistenceRepository();

    const result = await repository.loadServer({ userId: OWNER, now: new Date("2026-10-07T12:00:00Z") });

    expect(result.state.contentBoard.series ?? []).toEqual([]);
  });

  test("writes series_json and series_id (empty string when a card has no series)", async () => {
    const repository = createPocketBasePersistenceRepository();
    const card = { id: "in", columnId: "content-column-inbox", title: "In", notes: "", order: 0, updatedAt: "x" };
    const board = { columns: [], series: [SERIES], updatedAt: "x" };

    await repository.applyOps({
      userId: OWNER,
      ops: [
        { key: "content_board:self", kind: "content_board", type: "upsert", record: { key: "content_board:self", kind: "content_board", value: board }, base: null, baseUpdatedAtClient: null, updatedAtClient: "2026-10-07T12:00:00.000Z" },
        { key: "content_card:in", kind: "content_card", type: "upsert", record: { key: "content_card:in", kind: "content_card", value: card }, base: null, baseUpdatedAtClient: null, updatedAtClient: "2026-10-07T12:00:00.000Z" },
      ] as SyncOp[],
    });

    expect(db.content_boards[0].series_json).toEqual([SERIES]);
    expect(db.content_cards[0].series_id).toBe("");
  });
});

describe("Change requests (PocketBase mapping)", () => {
  const note = {
    id: "app-note_1",
    text: "Add weekly review",
    kind: "improvement" as const,
    status: "open" as const,
    screen: "todos",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
    deletedAt: null,
  };

  test("round-trips a note, and clears deleted_at with an empty string", () => {
    const row = { id: "r1", ...changeRequestToRow(note, OWNER, note.updatedAt) };
    expect(row.deleted_at).toBe("");
    expect(changeRequestFromRow(row)).toEqual(note);
  });

  test("loads notes and refuses to hard-delete one", async () => {
    (db.app_notes ??= []).push({ id: "r1", ...changeRequestToRow(note, OWNER, note.updatedAt) });
    const repository = createPocketBasePersistenceRepository();
    const result = await repository.loadServer({ userId: OWNER, now: new Date("2026-10-07T12:00:00Z") });
    expect(result?.state.changeRequests[note.id]?.text).toBe("Add weekly review");

    const key = `app_note:${note.id}`;
    const record = { key, kind: "app_note" as const, value: note };
    const [outcome] = await repository.applyOps({
      userId: OWNER,
      ops: [{ key, kind: "app_note", type: "delete", record, base: record, baseUpdatedAtClient: null, updatedAtClient: note.updatedAt }],
    });
    expect(outcome.status).toBe("skipped");
    expect(writes).not.toContain("delete:app_notes");
  });
});
