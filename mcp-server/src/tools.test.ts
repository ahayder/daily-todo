import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTENT_COLUMN_DEVELOP_ID,
  CONTENT_COLUMN_EDITING_ID,
  CONTENT_COLUMN_INBOX_ID,
  CONTENT_COLUMN_PUBLISHED_ID,
  CONTENT_COLUMN_SHOOT_NEXT_ID,
  createDefaultContentBoard,
} from "@/lib/store";
import type { ChangeRequest, ContentBoard, ContentCard } from "@/lib/types";
import { cardToPayload, rowToCard, tokenUserId, type ContentStore } from "./content-store";
import { withHistory } from "./history";
import { createMemoryTestStore } from "./memory-test-store";
import * as memoryTools from "./memory-tools";
import * as tools from "./tools";

function card(id: string, columnId: string, order: number, extra: Partial<ContentCard> = {}): ContentCard {
  return { id, columnId, title: `Card ${id}`, notes: "", order, updatedAt: "2026-01-01T00:00:00.000Z", ...extra };
}

/** In-memory store that records every write, so tests can check what was sent. */
function memoryStore(board: ContentBoard | null, cards: ContentCard[], changeRequests: ChangeRequest[] = []) {
  const state = {
    board,
    cards: Object.fromEntries(cards.map((c) => [c.id, c])) as Record<string, ContentCard>,
    changeRequests: Object.fromEntries(changeRequests.map((n) => [n.id, n])) as Record<string, ChangeRequest>,
    savedCards: [] as string[],
    boardSaves: 0,
  };
  const store: ContentStore = {
    loadBoard: async () => state.board,
    loadCards: async () => ({ ...state.cards }),
    saveBoard: async (next) => {
      state.board = next;
      state.boardSaves += 1;
    },
    saveCard: async (next) => {
      state.cards[next.id] = next;
      state.savedCards.push(next.id);
    },
    loadChangeRequests: async () => ({ ...state.changeRequests }),
    saveChangeRequest: async (next) => {
      state.changeRequests[next.id] = next;
    },
  };
  return { store, state };
}

const board = () => createDefaultContentBoard(new Date("2026-01-01"));

describe("content planner MCP tools", () => {
  it("never hard-deletes: no delete actions for content, and the store has no delete method", () => {
    expect(Object.keys(tools).filter((name) => /delete|remove/i.test(name))).toEqual(["setChangeRequestDeletedTool"]);
    const { store } = memoryStore(board(), []);
    expect(Object.keys(store).filter((name) => /delete|remove/i.test(name))).toEqual([]);
  });

  it("never hard-deletes anywhere: the full store and history store have no delete, and delete tools are soft", async () => {
    const { store, state } = createMemoryTestStore();
    const history = withHistory(store, "chat:test");
    expect(Object.keys(store).filter((name) => /delete|remove|destroy|purge/i.test(name))).toEqual([]);
    expect(Object.keys(history).filter((name) => /delete|remove|destroy|purge/i.test(name))).toEqual([]);
    expect(Object.keys(memoryTools).filter((name) => /delete|remove|destroy|purge/i.test(name))).toEqual(["deleteTask"]);

    const ctx = { store: history, timeZone: "UTC", source: "chat:test" };
    const { created } = await memoryTools.addTask(ctx, { title: "Keep me" });
    await memoryTools.deleteTask(ctx, { task: created.id! });
    expect(state.records.task[created.id!]).toMatchObject({ deletedAt: expect.any(String) });
  });

  it("registers only soft-delete tools (server.ts is read as text: importing it starts the server)", () => {
    const source = readFileSync(path.join(__dirname, "server.ts"), "utf8");
    const names = [...source.matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((match) => match[1]);
    expect(names.length).toBeGreaterThan(40);
    expect(names.filter((name) => /delete|remove|destroy|purge/.test(name))).toEqual(["delete_change_request", "delete_task"]);
  });

  it("adds an idea at the top of Ideas and renumbers that column", async () => {
    const { store, state } = memoryStore(board(), [card("a", CONTENT_COLUMN_INBOX_ID, 0)]);
    const result = await tools.addIdea(store, { title: "New video", original_thought: "a thought" });
    const created = state.cards[result.created.id];
    expect(created).toMatchObject({ columnId: CONTENT_COLUMN_INBOX_ID, order: 0, notes: "a thought" });
    expect(state.cards.a.order).toBe(1);
  });

  it("advances a card like the app button: adds the next section and moves to the top", async () => {
    const { store, state } = memoryStore(board(), [
      card("a", CONTENT_COLUMN_INBOX_ID, 0, { notes: "raw idea" }),
      card("d", CONTENT_COLUMN_DEVELOP_ID, 0),
    ]);
    await tools.moveCard(store, { card: "a", to: "next" });
    expect(state.cards.a.columnId).toBe(CONTENT_COLUMN_DEVELOP_ID);
    expect(state.cards.a.order).toBe(0);
    expect(state.cards.d.order).toBe(1);
    expect(state.cards.a.notes).toContain("## ORIGINAL THOUGHT");
    expect(state.cards.a.notes).toContain("## IDEA NOTE");
  });

  it("stamps the publish date on entering Published and clears it on leaving", async () => {
    const { store, state } = memoryStore(board(), [card("a", CONTENT_COLUMN_EDITING_ID, 0)]);
    await tools.moveCard(store, { card: "a", to: "published" });
    expect(state.cards.a.publishedAt).toBeTruthy();
    await tools.moveCard(store, { card: "a", to: "editing" });
    expect(state.cards.a.publishedAt).toBeNull();
  });

  it("only saves cards whose data changed", async () => {
    const { store, state } = memoryStore(board(), [
      card("a", CONTENT_COLUMN_INBOX_ID, 0),
      card("x", CONTENT_COLUMN_EDITING_ID, 0),
    ]);
    await tools.moveCard(store, { card: "a", to: "shoot-next" });
    expect(state.savedCards).toEqual(["a"]);
  });

  it("updates one section and keeps the others", async () => {
    const notes = "## ORIGINAL THOUGHT\n\nkeep me\n\n## IDEA NOTE\n\nold note";
    const { store, state } = memoryStore(board(), [card("a", CONTENT_COLUMN_DEVELOP_ID, 0, { notes })]);
    await tools.updateCard(store, { card: "a", idea_note: "new note" });
    expect(state.cards.a.notes).toContain("keep me");
    expect(state.cards.a.notes).toContain("new note");
    expect(state.cards.a.notes).not.toContain("old note");
  });

  it("cleans ChatGPT citation crumbs out of a pasted shoot card", async () => {
    const { store, state } = memoryStore(board(), [card("a", CONTENT_COLUMN_SHOOT_NEXT_ID, 0)]);
    await tools.updateCard(store, { card: "a", shoot_card: "1. Core message Shoot-Card-Instruction" });
    expect(state.cards.a.notes).toContain("1. Core message");
    expect(state.cards.a.notes).not.toContain("Shoot-Card-Instruction");
  });

  it("refuses to guess when several cards match a title", async () => {
    const { store } = memoryStore(board(), [
      card("a", CONTENT_COLUMN_INBOX_ID, 0, { title: "Morning routine" }),
      card("b", CONTENT_COLUMN_INBOX_ID, 1, { title: "Morning walk" }),
    ]);
    await expect(tools.moveCard(store, { card: "morning", to: "develop" })).rejects.toThrow(/Several cards/);
    await tools.moveCard(store, { card: "morning walk", to: "develop" });
  });

  it("adds a series to the latest board and attaches a card to it", async () => {
    const { store, state } = memoryStore(board(), [card("a", CONTENT_COLUMN_INBOX_ID, 0)]);
    const { created } = await tools.addSeries(store, { title: "Desk setups", about: "Gear" });
    expect(state.board?.series?.map((s) => s.title)).toEqual(["Desk setups"]);
    expect(state.board?.columns).toHaveLength(5);
    await tools.setCardSeries(store, { card: "a", series: "desk" });
    expect(state.cards.a.seriesId).toBe(created.id);
    await tools.setCardSeries(store, { card: "a", series: null });
    expect(state.cards.a.seriesId).toBeUndefined();
  });

  it("rejects a duplicate series title", async () => {
    const { store } = memoryStore(board(), []);
    await tools.addSeries(store, { title: "Desk setups" });
    await expect(tools.addSeries(store, { title: "desk setups" })).rejects.toThrow(/already exists/);
  });

  it("asks the user to open the planner when there is no board yet", async () => {
    const { store, state } = memoryStore(null, []);
    await expect(tools.addSeries(store, { title: "X" })).rejects.toThrow(/Open the Content Planner/);
    expect(state.boardSaves).toBe(0);
  });

  it("merges publish links instead of replacing them", async () => {
    const { store, state } = memoryStore(board(), [
      card("a", CONTENT_COLUMN_PUBLISHED_ID, 0, { links: { youtube: "https://yt/1" } }),
    ]);
    await tools.setPublishInfo(store, { card: "a", links: { tiktok: "https://tt/1" } });
    expect(state.cards.a.links).toEqual({ youtube: "https://yt/1", tiktok: "https://tt/1" });
  });
});

describe("content store record mapping", () => {
  it("round-trips a card through a PocketBase payload", () => {
    const original = card("a", CONTENT_COLUMN_PUBLISHED_ID, 2, {
      publishedAt: "2026-02-01T10:00:00.000Z",
      links: { youtube: "https://yt/1" },
      transcript: "hello",
      seriesId: "s1",
    });
    const row = { id: "rec1", ...cardToPayload(original, "user1") };
    expect(rowToCard(row)).toEqual(original);
  });

  it("reads the user id from a PocketBase auth token", () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const token = (payload: object) => `${encode({ alg: "HS256" })}.${encode(payload)}.sig`;
    expect(tokenUserId(token({ id: "user1", type: "auth", exp: 1 }))).toBe("user1");
    expect(tokenUserId(token({ id: "user1", type: "file" }))).toBeNull();
    expect(tokenUserId("not-a-token")).toBeNull();
  });

  it("clears optional fields with empty values, never omitting them", () => {
    const payload = cardToPayload(card("a", CONTENT_COLUMN_INBOX_ID, 0), "user1");
    expect(payload).toMatchObject({ published_at: "", links: {}, transcript: "", series_id: "" });
  });
});

describe("change request MCP tools", () => {
  const note = (id: string, text: string, extra: Partial<ChangeRequest> = {}): ChangeRequest => ({
    id,
    text,
    kind: "idea",
    status: "open",
    screen: "todos",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    deletedAt: null,
    ...extra,
  });

  it("adds a note from chat and lists open notes newest first", async () => {
    const { store } = memoryStore(board(), [], [note("n1", "Old one")]);
    await tools.addChangeRequest(store, { text: "Weekly review", kind: "improvement" });
    const { notes } = await tools.listChangeRequests(store);
    expect(notes.map((n) => n.text)).toEqual(["Weekly review", "Old one"]);
    expect(notes[0]).toMatchObject({ kind: "improvement", screen: "chat" });
  });

  it("soft-deletes and restores, keeping the note on the server", async () => {
    const { store, state } = memoryStore(board(), [], [note("n1", "Bigger timer")]);
    await tools.setChangeRequestDeletedTool(store, { note: "bigger", deleted: true });
    expect(state.changeRequests.n1.deletedAt).not.toBeNull();
    expect((await tools.listChangeRequests(store)).total).toBe(0);
    expect((await tools.listChangeRequests(store, { include_deleted: true })).total).toBe(1);
    await tools.setChangeRequestDeletedTool(store, { note: "n1", deleted: false });
    expect(state.changeRequests.n1.deletedAt).toBeNull();
  });

  it("updates status and filters by it", async () => {
    const { store } = memoryStore(board(), [], [note("n1", "A"), note("n2", "B")]);
    await tools.updateChangeRequestTool(store, { note: "n1", status: "done" });
    expect((await tools.listChangeRequests(store)).notes.map((n) => n.id)).toEqual(["n2"]);
    expect((await tools.listChangeRequests(store, { status: "done" })).notes.map((n) => n.id)).toEqual(["n1"]);
  });

  it("refuses to guess between notes with similar text", async () => {
    const { store } = memoryStore(board(), [], [note("n1", "Timer sound"), note("n2", "Timer color")]);
    await expect(tools.getChangeRequest(store, "timer")).rejects.toThrow(/Several change requests/);
  });
});
