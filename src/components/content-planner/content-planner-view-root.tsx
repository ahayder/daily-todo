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
  type ConveyorSection,
  type ConveyorStage,
} from "@/lib/content-conveyor";
import { CONTENT_FONT_SCALE_MAX, CONTENT_FONT_SCALE_MIN } from "@/lib/content-font-scale";
import { CONTENT_COLUMN_INBOX_ID, CONTENT_COLUMN_PUBLISHED_ID, getContentCardsForColumn } from "@/lib/store";
import type { ContentBoard, ContentCard } from "@/lib/types";
import { CaptureBox } from "./capture-box";
import { CardDetail } from "./card-detail";
import { ContentEmptyState } from "./content-empty-state";
import { ContentShelf } from "./content-shelf";
import { IdeasReview } from "./ideas-review";
import { WeekStrip } from "./week-strip";

export type ContentPlannerViewProps = {
  board: ContentBoard;
  cards: Record<string, ContentCard>;
  /** Device-local reading size; scales card text, not chrome. */
  fontScale?: number;
  onDecreaseFontScale?: () => void;
  onIncreaseFontScale?: () => void;
  onAddCard: (columnId: string, title: string, notes?: string, options?: { atTop?: boolean }) => void;
  onUpdateCard: (cardId: string, title: string, notes: string) => void;
  onMoveCard: (cardId: string, targetColumnId: string, targetIndex: number) => void;
  onDeleteCard: (cardId: string) => void;
  onRestoreCard: (card: ContentCard, index: number) => void;
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
  onMoveCard,
  onDeleteCard,
  onRestoreCard,
}: ContentPlannerViewProps) {
  const isSplit = useMediaQuery(MEDIA_QUERIES.split);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ cardId: string; section: ConveyorSection } | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

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

      if (step.nextColumnId === CONTENT_COLUMN_PUBLISHED_ID) {
        // Shipped: let the open card hand over to whatever is next up.
        if (options.focus) {
          setSelectedId(null);
          setIsSheetOpen(false);
        }
      } else if (options.focus) {
        // Keep the card open as it moves stages.
        setSelectedId(cardId);
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
      onMoveCard={onMoveCard}
      onAdvance={(cardId, title, notes) => advanceCard(cardId, title, notes, { focus: true })}
      onDeleteCard={deleteCard}
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
        <PageHeader title="Content" actions={fontControls} />
        <WeekStrip
          shippedThisWeek={shippedThisWeek}
          nextUpCard={nextUpCard}
          onSelectCard={selectCard}
          onAdvanceCard={(cardId) => advanceStoredCard(cardId, { open: true })}
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
