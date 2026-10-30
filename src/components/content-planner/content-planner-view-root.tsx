"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { AArrowDown, AArrowUp } from "lucide-react";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { PageHeader } from "@/components/blocks/page-header";
import { IconButton } from "@/components/ui/icon-button";
import { showUndoToast, toast } from "@/components/ui/toast";
import { MEDIA_QUERIES, useMediaQuery } from "@/hooks/use-media-query";
import {
  appendSection,
  countShippedThisWeek,
  getColumnForStage,
  getNextStep,
  getNextUpCard,
  getStageForColumn,
  SHELF_STAGE_ORDER,
  WEEKLY_SHIP_GOAL,
  type ConveyorStage,
} from "@/lib/content-conveyor";
import { CONTENT_FONT_SCALE_MAX, CONTENT_FONT_SCALE_MIN } from "@/lib/content-font-scale";
import {
  getCardSeries,
  getSeriesCardsByStage,
  getSeriesList,
  getSeriesStats,
  sortSeriesByActivity,
} from "@/lib/content-series";
import { CONTENT_COLUMN_INBOX_ID, CONTENT_COLUMN_PUBLISHED_ID, getContentCardsForColumn, makeId } from "@/lib/store";
import type { ContentBoard, ContentCard, ContentLinks } from "@/lib/types";
import { CaptureBox } from "./capture-box";
import { CardDetail, type CardFocusTarget } from "./card-detail";
import { ContentEmptyState } from "./content-empty-state";
import { ContentShelf } from "./content-shelf";
import { IdeasReview } from "./ideas-review";
import { SeriesDetail } from "./series-detail";
import { SeriesNameDialog } from "./series-name-dialog";
import { SeriesStrip } from "./series-strip";
import { WeekStrip } from "./week-strip";

export type ContentPlannerViewProps = {
  board: ContentBoard;
  cards: Record<string, ContentCard>;
  /** Device-local reading size; scales card text, not chrome. */
  fontScale?: number;
  onDecreaseFontScale?: () => void;
  onIncreaseFontScale?: () => void;
  onAddCard: (
    columnId: string,
    title: string,
    notes?: string,
    options?: { atTop?: boolean; seriesId?: string },
  ) => void;
  onUpdateCard: (cardId: string, title: string, notes: string) => void;
  onUpdatePublishInfo: (cardId: string, links: ContentLinks, transcript: string) => void;
  onMoveCard: (cardId: string, targetColumnId: string, targetIndex: number) => void;
  onDeleteCard: (cardId: string) => void;
  onRestoreCard: (card: ContentCard, index: number) => void;
  onCreateSeries: (seriesId: string, title: string, cardId?: string) => void;
  onUpdateSeries: (seriesId: string, title: string, about: string) => void;
  onDeleteSeries: (seriesId: string) => void;
  onSetCardSeries: (cardId: string, seriesId: string | null) => void;
};

/**
 * Content Planner — "Focus + Shelf".
 *
 * Top: this week's ship meter and the one card to work on next. Then a capture
 * box. Below, the shelf lists every card as a readable row grouped by stage;
 * the selected card opens beside it (wide screens) or full screen (phones).
 */
export function ContentPlannerView({
  board,
  cards,
  fontScale = 1,
  onDecreaseFontScale,
  onIncreaseFontScale,
  onAddCard,
  onUpdateCard,
  onUpdatePublishInfo,
  onMoveCard,
  onDeleteCard,
  onRestoreCard,
  onCreateSeries,
  onUpdateSeries,
  onDeleteSeries,
  onSetCardSeries,
}: ContentPlannerViewProps) {
  const isSplit = useMediaQuery(MEDIA_QUERIES.split);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ cardId: string; section: CardFocusTarget } | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);
  /** Naming a new series; `cardId` joins it right away (from a card's picker). */
  const [newSeriesFor, setNewSeriesFor] = useState<{ cardId?: string } | null>(null);

  const cardsByStage = useMemo(
    () =>
      Object.fromEntries(
        SHELF_STAGE_ORDER.map((stage) => [stage, getContentCardsForColumn(cards, getColumnForStage(stage))]),
      ) as Record<ConveyorStage, ContentCard[]>,
    [cards],
  );
  const cardList = useMemo(() => Object.values(cards), [cards]);
  const shippedThisWeek = countShippedThisWeek(cardList, new Date());
  const nextUpCard = getNextUpCard((columnId) => cardsByStage[getStageForColumn(columnId) ?? "inbox"] ?? []);
  const hasColumns = board.columns.length > 0;
  const seriesList = getSeriesList(board);
  const sortedSeries = useMemo(
    () =>
      sortSeriesByActivity(getSeriesList(board), cardList).map((series) => ({
        series,
        stats: getSeriesStats(series.id, cardList),
      })),
    [board, cardList],
  );
  const seriesNames = useMemo(
    () => new Map(getSeriesList(board).map((series) => [series.id, series.title])),
    [board],
  );
  const openSeries = seriesList.find((series) => series.id === openSeriesId) ?? null;

  // Wide screens always show a card: the chosen one, else the Next up card,
  // else the first card on the shelf.
  const selectedCard =
    (selectedId ? cards[selectedId] : undefined) ??
    (isSplit
      ? (nextUpCard ?? SHELF_STAGE_ORDER.map((stage) => cardsByStage[stage][0]).find(Boolean) ?? null)
      : null);
  const selectedIndex = selectedCard
    ? cardsByStage[getStageForColumn(selectedCard.columnId) ?? "inbox"].findIndex((card) => card.id === selectedCard.id)
    : -1;

  const selectCard = useCallback(
    (cardId: string) => {
      setSelectedId(cardId);
      if (!isSplit) setIsSheetOpen(true);
    },
    [isSplit],
  );

  const deleteCard = useCallback(
    (cardId: string) => {
      const card = cards[cardId];
      if (!card) return;
      const index = getContentCardsForColumn(cards, card.columnId).findIndex((item) => item.id === cardId);
      onDeleteCard(cardId);
      if (cardId === selectedId) setIsSheetOpen(false);
      showUndoToast({
        title: `Deleted “${card.title}”`,
        onUndo: () => onRestoreCard(card, Math.max(0, index)),
      });
    },
    [cards, onDeleteCard, onRestoreCard, selectedId],
  );

  /** One press: save, add the next section, move to the next stage's top. */
  const advanceCard = useCallback(
    (cardId: string, title: string, notes: string, options: { open?: boolean; focus?: boolean } = {}) => {
      const card = cards[cardId];
      const step = card ? getNextStep(card.columnId) : null;
      if (!card || !step) return;
      const nextNotes = step.sectionToAdd ? appendSection(notes, step.sectionToAdd).trim() : notes;
      if (title !== card.title || nextNotes !== card.notes) onUpdateCard(cardId, title, nextNotes);
      onMoveCard(cardId, step.nextColumnId, 0);

      if (options.focus) {
        // Keep the card open as it moves stages.
        setSelectedId(cardId);
      }
      // Shipped: open on the link fields so they can be pasted right away.
      if (step.nextColumnId === CONTENT_COLUMN_PUBLISHED_ID && (options.open || options.focus)) {
        setFocusRequest({ cardId, section: "LINKS" });
        if (options.open) selectCard(cardId);
      }
      // Show where to type next: open the card on its new, empty section.
      if (step.sectionToAdd && (options.open || options.focus)) {
        setFocusRequest({ cardId, section: step.sectionToAdd });
        if (options.open) selectCard(cardId);
      }
      if (step.nextColumnId === CONTENT_COLUMN_PUBLISHED_ID) {
        const shipped = shippedThisWeek + 1;
        toast.add({
          title: "Shipped!",
          description:
            shipped >= WEEKLY_SHIP_GOAL
              ? `${shipped} this week — goal met.`
              : `${shipped} of ${WEEKLY_SHIP_GOAL} this week.`,
        });
      }
    },
    [cards, onMoveCard, onUpdateCard, selectCard, shippedThisWeek],
  );

  const advanceStoredCard = useCallback(
    (cardId: string, options: { open?: boolean } = {}) => {
      const card = cards[cardId];
      if (card) advanceCard(cardId, card.title, card.notes, options);
    },
    [advanceCard, cards],
  );

  const clearFocusRequest = useCallback(() => setFocusRequest(null), []);

  const typographyStyle = useMemo(
    () => ({ fontSize: `${Math.max(0.5, Math.min(2, fontScale))}rem` }) as CSSProperties,
    [fontScale],
  );

  const detail = selectedCard ? (
    <CardDetail
      key={selectedCard.id}
      card={selectedCard}
      index={Math.max(0, selectedIndex)}
      layout={isSplit ? "pane" : "sheet"}
      focusSection={focusRequest?.cardId === selectedCard.id ? focusRequest.section : null}
      onFocusHandled={clearFocusRequest}
      onBack={isSplit ? undefined : () => setIsSheetOpen(false)}
      onUpdateCard={onUpdateCard}
      onUpdatePublishInfo={onUpdatePublishInfo}
      onMoveCard={onMoveCard}
      onAdvance={(cardId, title, notes) => advanceCard(cardId, title, notes, { focus: true })}
      onDeleteCard={deleteCard}
      seriesList={seriesList}
      cardSeries={getCardSeries(board, selectedCard)}
      onSetSeries={onSetCardSeries}
      onNewSeries={(cardId) => setNewSeriesFor({ cardId })}
      onOpenSeries={setOpenSeriesId}
    />
  ) : null;

  const fontControls =
    onDecreaseFontScale && onIncreaseFontScale ? (
      <div className="flex items-center gap-1 md:hidden">
        <IconButton
          label="Smaller text"
          icon={<AArrowDown />}
          onClick={onDecreaseFontScale}
          disabled={fontScale <= CONTENT_FONT_SCALE_MIN}
        />
        <IconButton
          label="Larger text"
          icon={<AArrowUp />}
          onClick={onIncreaseFontScale}
          disabled={fontScale >= CONTENT_FONT_SCALE_MAX}
        />
      </div>
    ) : null;

  return (
    <section
      data-testid="content-planner-view"
      data-layout={isSplit ? "split" : "stack"}
      className="h-full min-h-0 overflow-y-auto bg-background lg:overflow-hidden"
      style={typographyStyle}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-4 pb-10 sm:px-6 lg:h-full lg:pb-4">
        <PageHeader title="Content Planner" actions={fontControls} />
        <WeekStrip
          shippedThisWeek={shippedThisWeek}
          nextUpCard={nextUpCard}
          onSelectCard={selectCard}
          onAdvanceCard={(cardId) => advanceStoredCard(cardId, { open: true })}
        />
        <SeriesStrip
          series={sortedSeries}
          onOpenSeries={setOpenSeriesId}
          onNewSeries={() => setNewSeriesFor({})}
        />
        <CaptureBox
          onCapture={(title, notes) => {
            if (hasColumns) onAddCard(CONTENT_COLUMN_INBOX_ID, title, notes, { atTop: true });
          }}
        />

        {cardList.length === 0 ? (
          <ContentEmptyState />
        ) : (
          <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
            <nav aria-label="Content cards" className="lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <ContentShelf
                cardsByStage={cardsByStage}
                selectedCardId={selectedCard?.id ?? null}
                shippedThisWeek={shippedThisWeek}
                onSelectCard={selectCard}
                onMoveCard={onMoveCard}
                onDeleteCard={deleteCard}
                onReviewIdeas={() => setIsReviewOpen(true)}
                seriesNames={seriesNames}
              />
            </nav>
            {isSplit ? <div className="min-h-0">{detail}</div> : null}
          </div>
        )}
      </div>

      {!isSplit ? (
        <DialogPrimitive.Root open={isSheetOpen && Boolean(selectedCard)} onOpenChange={setIsSheetOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Popup
              aria-label={selectedCard?.title ?? "Card"}
              className="fixed inset-0 z-50 bg-background text-foreground outline-none animate-enter"
              style={typographyStyle}
            >
              {detail}
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      ) : null}

      <SeriesDetail
        series={openSeries}
        stats={openSeries ? getSeriesStats(openSeries.id, cardList) : { shipped: 0, onTheWay: 0, ideas: 0 }}
        groups={openSeries ? getSeriesCardsByStage(openSeries.id, cardsByStage) : []}
        layout={isSplit ? "dialog" : "sheet"}
        typographyStyle={typographyStyle}
        onClose={() => setOpenSeriesId(null)}
        onUpdate={onUpdateSeries}
        onAddIdea={(seriesId, title) => {
          if (hasColumns) onAddCard(CONTENT_COLUMN_INBOX_ID, title, undefined, { atTop: true, seriesId });
        }}
        onOpenCard={(cardId) => {
          setOpenSeriesId(null);
          selectCard(cardId);
        }}
        onDelete={(seriesId) => {
          onDeleteSeries(seriesId);
          setOpenSeriesId(null);
        }}
      />

      <SeriesNameDialog
        open={newSeriesFor !== null}
        onOpenChange={(open) => {
          if (!open) setNewSeriesFor(null);
        }}
        onCreate={(title) => {
          const seriesId = makeId("content-series");
          const cardId = newSeriesFor?.cardId;
          onCreateSeries(seriesId, title, cardId);
          // From the strip, open the new series so its "about" can be written.
          if (!cardId) setOpenSeriesId(seriesId);
        }}
      />

      <IdeasReview
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        ideas={cardsByStage.inbox}
        onDevelop={(cardId) => advanceStoredCard(cardId)}
        onDelete={deleteCard}
      />
    </section>
  );
}
