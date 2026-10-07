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

const { createPocketBasePersistenceRepository } = await import("@/lib/pocketbase/persistence-repository");

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
