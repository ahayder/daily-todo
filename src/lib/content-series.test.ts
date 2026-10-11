import { describe, expect, test } from "vitest";
import {
  formatSeriesStats,
  getCardSeries,
  getSeriesCardsByStage,
  getSeriesHeadline,
  getSeriesStats,
  sortSeriesByActivity,
} from "@/lib/content-series";
import { buildChatGptClipboard } from "@/lib/content-conveyor";
import {
  addContentSeries,
  CONTENT_COLUMN_DEVELOP_ID,
  CONTENT_COLUMN_EDITING_ID,
  CONTENT_COLUMN_INBOX_ID,
  CONTENT_COLUMN_PUBLISHED_ID,
  CONTENT_COLUMN_SHOOT_NEXT_ID,
  createContentSeries,
  createDefaultContentBoard,
  deleteContentSeries,
  ensureContentPlannerState,
  createInitialState,
  setContentCardSeries,
  unlinkContentSeriesCards,
  updateContentSeries,
} from "@/lib/store";
import type { ContentCard, ContentSeries } from "@/lib/types";

function card(id: string, columnId: string, overrides: Partial<ContentCard> = {}): ContentCard {
  return { id, columnId, title: id, notes: "", order: 0, updatedAt: "2026-10-01T00:00:00.000Z", ...overrides };
}

function series(id: string, overrides: Partial<ContentSeries> = {}): ContentSeries {
  return { id, title: id, about: "", createdAt: "2026-10-01T00:00:00.000Z", ...overrides };
}

const cards = [
  card("a", CONTENT_COLUMN_PUBLISHED_ID, { seriesId: "money" }),
  card("b", CONTENT_COLUMN_PUBLISHED_ID, { seriesId: "money" }),
  card("c", CONTENT_COLUMN_DEVELOP_ID, { seriesId: "money" }),
  card("d", CONTENT_COLUMN_SHOOT_NEXT_ID, { seriesId: "money" }),
  card("e", CONTENT_COLUMN_EDITING_ID, { seriesId: "money" }),
  card("f", CONTENT_COLUMN_INBOX_ID, { seriesId: "money" }),
  card("g", CONTENT_COLUMN_INBOX_ID),
];

describe("series stats", () => {
  test("counts shipped, on the way and ideas for one series only", () => {
    expect(getSeriesStats("money", cards)).toEqual({ shipped: 2, onTheWay: 3, ideas: 1 });
    expect(getSeriesStats("other", cards)).toEqual({ shipped: 0, onTheWay: 0, ideas: 0 });
  });

  test("formats kindly, skipping zero parts", () => {
    expect(formatSeriesStats({ shipped: 2, onTheWay: 3, ideas: 1 })).toBe("2 shipped · 3 on the way · 1 idea");
    expect(formatSeriesStats({ shipped: 0, onTheWay: 0, ideas: 2 })).toBe("2 ideas");
    expect(formatSeriesStats({ shipped: 0, onTheWay: 0, ideas: 0 })).toBe("No videos yet");
  });

  test("headline prefers shipped, then on the way, then ideas", () => {
    expect(getSeriesHeadline({ shipped: 5, onTheWay: 1, ideas: 1 })).toBe("5 shipped");
    expect(getSeriesHeadline({ shipped: 0, onTheWay: 2, ideas: 1 })).toBe("2 on the way");
    expect(getSeriesHeadline({ shipped: 0, onTheWay: 0, ideas: 1 })).toBe("1 idea");
    expect(getSeriesHeadline({ shipped: 0, onTheWay: 0, ideas: 0 })).toBe("new");
  });

  test("groups a series' cards by stage in shelf order", () => {
    const byStage = {
      editing: [cards[4]],
      "shoot-next": [cards[3]],
      develop: [cards[2]],
      inbox: [cards[5], cards[6]],
      published: [cards[0], cards[1]],
    };
    const groups = getSeriesCardsByStage("money", byStage);
    expect(groups.map((group) => group.stage)).toEqual(["editing", "shoot-next", "develop", "inbox", "published"]);
    expect(groups.find((group) => group.stage === "inbox")?.cards.map((item) => item.id)).toEqual(["f"]);
  });

  test("sorts by most recent card activity, then newest series", () => {
    const list = [
      series("old", { createdAt: "2026-01-01T00:00:00.000Z" }),
      series("new", { createdAt: "2026-09-01T00:00:00.000Z" }),
      series("busy", { createdAt: "2026-02-01T00:00:00.000Z" }),
    ];
    const sorted = sortSeriesByActivity(list, [card("x", CONTENT_COLUMN_INBOX_ID, { seriesId: "busy", updatedAt: "2026-10-05T00:00:00.000Z" })]);
    expect(sorted.map((item) => item.id)).toEqual(["busy", "new", "old"]);
  });

  test("a card pointing at a deleted series has no series", () => {
    const board = { ...createDefaultContentBoard(), series: [series("money")] };
    expect(getCardSeries(board, { seriesId: "money" })?.id).toBe("money");
    expect(getCardSeries(board, { seriesId: "gone" })).toBeNull();
    expect(getCardSeries(board, {})).toBeNull();
  });
});

describe("series store", () => {
  test("creates, renames and deletes a series on the board", () => {
    const created = createContentSeries({ id: "s1", title: "  Money basics ", about: " for students " });
    expect(created).toMatchObject({ id: "s1", title: "Money basics", about: "for students" });
    expect(createContentSeries({ title: "   " })).toBeNull();

    let board = addContentSeries(createDefaultContentBoard(), created!);
    expect(board.series).toHaveLength(1);
    expect(addContentSeries(board, created!)).toBe(board);

    board = updateContentSeries(board, "s1", { title: "Money 101", about: "for students" });
    expect(board.series?.[0].title).toBe("Money 101");
    expect(updateContentSeries(board, "s1", { title: " ", about: "" })).toBe(board);

    board = deleteContentSeries(board, "s1");
    // No empty list left behind, so it matches how the server reads it back.
    expect(board.series).toBeUndefined();
  });

  test("a card is in at most one series and can leave it", () => {
    const start = { a: card("a", CONTENT_COLUMN_INBOX_ID) };
    const inMoney = setContentCardSeries(start, "a", "money");
    expect(inMoney.a.seriesId).toBe("money");
    expect(setContentCardSeries(inMoney, "a", "money")).toBe(inMoney);
    const moved = setContentCardSeries(inMoney, "a", "travel");
    expect(moved.a.seriesId).toBe("travel");
    const left = setContentCardSeries(moved, "a", null);
    expect("seriesId" in left.a).toBe(false);
  });

  test("deleting a series unlinks its cards and deletes none", () => {
    const record = Object.fromEntries(cards.map((item) => [item.id, item]));
    const next = unlinkContentSeriesCards(record, "money");
    expect(Object.keys(next)).toHaveLength(cards.length);
    expect(Object.values(next).some((item) => item.seriesId)).toBe(false);
  });

  test("board normalization keeps the series list", () => {
    const state = createInitialState("2026-10-11");
    const withSeries = {
      ...state,
      contentBoard: { ...state.contentBoard, columns: state.contentBoard.columns.slice(0, 2), series: [series("money")] },
    };
    expect(ensureContentPlannerState(withSeries).contentBoard.series).toEqual([series("money")]);
  });
});

describe("Copy for ChatGPT with a series", () => {
  test("adds the series name and what it is about", () => {
    const payload = buildChatGptClipboard(
      CONTENT_COLUMN_INBOX_ID,
      { title: "Budget in 5 minutes", notes: "Use 3 buckets." },
      { title: "Money basics", about: "Simple money habits for students" },
    );
    expect(payload).toContain("Title: Budget in 5 minutes\n\nSeries: Money basics\nSimple money habits for students");
  });

  test("leaves the payload unchanged without a series", () => {
    const card = { title: "Budget in 5 minutes", notes: "Use 3 buckets." };
    expect(buildChatGptClipboard(CONTENT_COLUMN_INBOX_ID, card, null)).toBe(buildChatGptClipboard(CONTENT_COLUMN_INBOX_ID, card));
  });
});
