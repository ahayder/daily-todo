import { describe, expect, it } from "vitest";
import type { ChangeRequest, ContentCard } from "@/lib/types";
import {
  cardToPayload,
  changeRequestToPayload,
  rowToBoard,
  rowToCard,
  rowToChangeRequest,
  tokenUserId,
} from "./content-store";

// Pure row mappers only; the PocketBase-backed store is never touched in tests.

describe("content card rows", () => {
  const card: ContentCard = {
    id: "card_1",
    columnId: "idea",
    title: "Remote work in 2027",
    notes: "outline",
    order: 2,
    updatedAt: "2026-02-01T00:00:00.000Z",
    publishedAt: "2026-02-10T00:00:00.000Z",
    links: { youtube: "https://youtube.com/watch?v=1" },
    seriesId: "series_1",
  };

  it("round-trips through the PocketBase payload", () => {
    const row = { id: "row_1", ...cardToPayload(card, "user_1") };
    expect(rowToCard(row)).toEqual(card);
  });

  it("clears optional fields with empty values (never omits them)", () => {
    const payload = cardToPayload({ ...card, publishedAt: null, links: undefined, seriesId: undefined }, "user_1");
    expect(payload).toMatchObject({ published_at: "", links: {}, transcript: "", series_id: "" });
  });

  it("skips rows missing the id, column or title", () => {
    expect(rowToCard({ id: "row_1", column_id: "idea", title: "x" })).toBeNull();
    expect(rowToCard({ id: "row_1", card_id: "c", title: "x" })).toBeNull();
    expect(rowToCard({ id: "row_1", card_id: "c", column_id: "idea" })).toBeNull();
  });

  it("cleans bad positions, links and dates", () => {
    const parsed = rowToCard({
      id: "row_1",
      card_id: "c",
      column_id: "idea",
      title: "x",
      position: -3.7,
      links: { youtube: "  ", unknown: "https://x" },
      published_at: "not a date",
    });
    expect(parsed?.order).toBe(0);
    expect(parsed?.links).toBeUndefined();
    expect(parsed?.publishedAt).toBeNull();
  });
});

describe("board rows", () => {
  it("keeps only valid series and tolerates missing columns", () => {
    const board = rowToBoard({
      id: "row_1",
      columns_json: null,
      series_json: [{ id: "s1", title: " Visas " }, { id: "", title: "bad" }, "junk"],
      updated_at_client: "2026-02-01T00:00:00.000Z",
    });
    expect(board.columns).toEqual([]);
    expect(board.series?.map((series) => series.title)).toEqual(["Visas"]);
  });
});

describe("change request rows", () => {
  const note: ChangeRequest = {
    id: "cr_1",
    text: "Make the Today tab faster",
    kind: "idea",
    status: "done",
    screen: "today",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    deletedAt: "2026-01-03T00:00:00.000Z",
  };

  it("round-trips, keeping the soft-delete date", () => {
    const row = { id: "row_1", ...changeRequestToPayload(note, "user_1") };
    expect(rowToChangeRequest(row)).toEqual(note);
  });

  it("falls back to safe values for unknown kind and status", () => {
    const parsed = rowToChangeRequest({ id: "row_1", note_id: "cr_2", kind: "weird", status: "??" });
    expect(parsed).toMatchObject({ kind: "idea", status: "open", deletedAt: null });
  });

  it("skips rows without a note id", () => {
    expect(rowToChangeRequest({ id: "row_1" })).toBeNull();
  });
});

describe("tokenUserId", () => {
  const encode = (payload: object) =>
    `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

  it("reads the user id from an auth token", () => {
    expect(tokenUserId(encode({ id: "user_1", type: "auth" }))).toBe("user_1");
  });

  it("rejects non-auth tokens and garbage", () => {
    expect(tokenUserId(encode({ id: "user_1", type: "file" }))).toBeNull();
    expect(tokenUserId("not-a-token")).toBeNull();
  });
});
