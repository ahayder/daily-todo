import { getStageForColumn, SHELF_STAGE_ORDER, type ConveyorStage } from "@/lib/content-conveyor";
import type { ContentBoard, ContentCard, ContentSeries } from "@/lib/types";

/**
 * Content series helpers (pure).
 *
 * A series groups videos that belong together. It is open-ended (no target
 * count, no episode order) and a card is in at most one series. Series never
 * change "Next up", the weekly meter or the stages — they only group and count.
 */

export type SeriesStats = {
  /** Cards in Published. */
  shipped: number;
  /** Cards in Develop, Shoot next or Editing. */
  onTheWay: number;
  /** Cards still in Ideas (the Inbox stage). */
  ideas: number;
};

export function getSeriesList(board: ContentBoard): ContentSeries[] {
  return board.series ?? [];
}

/** The card's series, or null when it has none (or it points at a deleted one). */
export function getCardSeries(board: ContentBoard, card: Pick<ContentCard, "seriesId">): ContentSeries | null {
  if (!card.seriesId) return null;
  return board.series?.find((series) => series.id === card.seriesId) ?? null;
}

export function getSeriesStats(seriesId: string, cards: Iterable<ContentCard>): SeriesStats {
  const stats: SeriesStats = { shipped: 0, onTheWay: 0, ideas: 0 };
  for (const card of cards) {
    if (card.seriesId !== seriesId) continue;
    const stage = getStageForColumn(card.columnId);
    if (stage === "published") stats.shipped += 1;
    else if (stage === "inbox") stats.ideas += 1;
    else if (stage) stats.onTheWay += 1;
  }
  return stats;
}

/** "5 shipped · 2 on the way · 3 ideas" — only the parts that aren't zero. */
export function formatSeriesStats(stats: SeriesStats): string {
  const parts = [
    stats.shipped > 0 ? `${stats.shipped} shipped` : "",
    stats.onTheWay > 0 ? `${stats.onTheWay} on the way` : "",
    stats.ideas > 0 ? `${stats.ideas} ${stats.ideas === 1 ? "idea" : "ideas"}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No videos yet";
}

/** The series' cards grouped by stage, in shelf order (soonest work first). */
export function getSeriesCardsByStage(
  seriesId: string,
  cardsByStage: Record<ConveyorStage, ContentCard[]>,
): { stage: ConveyorStage; cards: ContentCard[] }[] {
  return SHELF_STAGE_ORDER.map((stage) => ({
    stage,
    cards: cardsByStage[stage].filter((card) => card.seriesId === seriesId),
  })).filter((group) => group.cards.length > 0);
}

/**
 * Series with the most recently touched card first; series without cards
 * follow, newest first.
 */
export function sortSeriesByActivity(series: ContentSeries[], cards: Iterable<ContentCard>): ContentSeries[] {
  const lastActivity = new Map<string, string>();
  for (const card of cards) {
    if (!card.seriesId) continue;
    const current = lastActivity.get(card.seriesId);
    if (!current || card.updatedAt > current) lastActivity.set(card.seriesId, card.updatedAt);
  }
  return series.toSorted((left, right) => {
    const leftActivity = lastActivity.get(left.id) ?? "";
    const rightActivity = lastActivity.get(right.id) ?? "";
    if (leftActivity !== rightActivity) return rightActivity.localeCompare(leftActivity);
    return right.createdAt.localeCompare(left.createdAt);
  });
}

/** The one number a series chip shows: shipped first, else what's moving, else ideas. */
export function getSeriesHeadline(stats: SeriesStats): string {
  if (stats.shipped > 0) return `${stats.shipped} shipped`;
  if (stats.onTheWay > 0) return `${stats.onTheWay} on the way`;
  if (stats.ideas > 0) return `${stats.ideas} ${stats.ideas === 1 ? "idea" : "ideas"}`;
  return "new";
}
