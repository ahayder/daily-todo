"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Ellipsis,
  Eye,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { ContentCardMarkdown } from "@/components/content-planner/content-card-markdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getContentCardsForColumn } from "@/lib/store";
import type { ContentBoard, ContentCard, ContentColumn } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ContentPlannerViewProps = {
  board: ContentBoard;
  cards: Record<string, ContentCard>;
  onAddColumn: (title: string, subtitle: string) => void;
  onRenameColumn: (columnId: string, title: string) => void;
  onUpdateColumnSubtitle: (columnId: string, subtitle: string) => void;
  onReorderColumns: (activeColumnId: string, overColumnId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddCard: (columnId: string, title: string, notes: string) => void;
  onUpdateCard: (cardId: string, title: string, notes: string) => void;
  onMoveCard: (cardId: string, targetColumnId: string, targetIndex: number) => void;
  onDeleteCard: (cardId: string) => void;
};

type DragData =
  | { type: "column"; columnId: string }
  | { type: "card"; cardId: string; columnId: string };

type CardDropHighlight = {
  columnId: string;
  cardId: string | null;
  edge: "before" | "after" | null;
};

function columnDragId(columnId: string) {
  return `content-column:${columnId}`;
}

function cardDragId(cardId: string) {
  return `content-card:${cardId}`;
}

const contentBoardCollisionDetection: CollisionDetection = (args) => {
  const activeType = (args.active.data.current as DragData | undefined)?.type;
  const availableContainers = args.droppableContainers.filter(
    (container) => container.id !== args.active.id,
  );

  if (activeType === "column") {
    return closestCenter({
      ...args,
      droppableContainers: availableContainers.filter(
        (container) =>
          (container.data.current as DragData | undefined)?.type === "column",
      ),
    });
  }

  if (activeType === "card") {
    const cardContainers = availableContainers.filter(
      (container) =>
        (container.data.current as DragData | undefined)?.type === "card",
    );
    const cardHits = pointerWithin({
      ...args,
      droppableContainers: cardContainers,
    });
    if (cardHits.length > 0) {
      return cardHits;
    }

    const columnContainers = availableContainers.filter(
      (container) =>
        (container.data.current as DragData | undefined)?.type === "column",
    );
    const columnHits = pointerWithin({
      ...args,
      droppableContainers: columnContainers,
    });
    if (columnHits.length > 0) {
      return columnHits;
    }

    return closestCenter({
      ...args,
      droppableContainers: [...cardContainers, ...columnContainers],
    });
  }

  return [];
};

function getCardDropEdge(event: DragOverEvent | DragEndEvent) {
  const overTarget = event.over;
  const over = overTarget?.data.current as DragData | undefined;
  if (!overTarget || over?.type !== "card") return null;

  const translatedRect = event.active.rect.current.translated;
  if (!translatedRect) return "before" as const;

  const activeCenter = translatedRect.top + translatedRect.height / 2;
  const overCenter = overTarget.rect.top + overTarget.rect.height / 2;
  return activeCenter > overCenter ? ("after" as const) : ("before" as const);
}

function getContentCardText(card: Pick<ContentCard, "title" | "notes">): string {
  return card.notes ? `${card.title}\n\n${card.notes}` : card.title;
}

function splitContentCardText(text: string): Pick<ContentCard, "title" | "notes"> | null {
  const normalized = text.trim();
  if (!normalized) return null;

  const [title, ...notes] = normalized.split(/\r?\n/);
  return {
    title: title.trim(),
    notes: notes.join("\n").trim(),
  };
}

export function resolveContentBoardDrop(
  active: DragData | undefined,
  over: DragData | undefined,
  cardsByColumn: Record<string, ContentCard[]>,
  edge: "before" | "after" | null = "before",
):
  | { type: "column"; activeColumnId: string; overColumnId: string }
  | { type: "card"; cardId: string; targetColumnId: string; targetIndex: number }
  | null {
  if (!active || !over) return null;

  if (active.type === "column" && over.type === "column") {
    return {
      type: "column",
      activeColumnId: active.columnId,
      overColumnId: over.columnId,
    };
  }

  if (active.type !== "card") return null;

  const targetColumnId = over.columnId;
  const targetCards = cardsByColumn[targetColumnId] ?? [];
  const overIndex =
    over.type === "card"
      ? targetCards.findIndex((card) => card.id === over.cardId)
      : -1;
  const activeIndex =
    active.columnId === targetColumnId
      ? targetCards.findIndex((card) => card.id === active.cardId)
      : -1;
  let targetIndex = over.type === "card" ? Math.max(0, overIndex) : targetCards.length;

  if (over.type === "card" && edge === "after") {
    targetIndex += 1;
  }
  if (activeIndex >= 0 && activeIndex < targetIndex) {
    targetIndex -= 1;
  }

  return {
    type: "card",
    cardId: active.cardId,
    targetColumnId,
    targetIndex,
  };
}

export function resolveContentBoardDragHighlight(
  active: DragData | undefined,
  over: DragData | undefined,
  edge: "before" | "after" | null = "before",
): CardDropHighlight | null {
  if (active?.type !== "card" || !over) return null;

  return {
    columnId: over.columnId,
    cardId:
      over.type === "card" && over.cardId !== active.cardId
        ? over.cardId
        : null,
    edge:
      over.type === "card" && over.cardId !== active.cardId ? edge : null,
  };
}

function ContentCardItem({
  card,
  isDropTarget,
  dropEdge,
  onView,
  onUpdate,
  onRequestDelete,
}: {
  card: ContentCard;
  isDropTarget: boolean;
  dropEdge: "before" | "after" | null;
  onView: () => void;
  onUpdate: (title: string, notes: string) => void;
  onRequestDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [text, setText] = useState(() => getContentCardText(card));
  const didDragRef = useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: cardDragId(card.id),
    data: {
      type: "card",
      cardId: card.id,
      columnId: card.columnId,
    } satisfies DragData,
  });

  const startEditing = () => {
    setIsCollapsed(false);
    setText(getContentCardText(card));
    setIsEditing(true);
  };

  useEffect(() => {
    if (!isCopied) return;

    const resetCopiedState = window.setTimeout(() => setIsCopied(false), 1500);
    return () => window.clearTimeout(resetCopiedState);
  }, [isCopied]);

  useEffect(() => {
    if (isDragging) {
      didDragRef.current = true;
    }
  }, [isDragging]);

  const copyCard = async () => {
    try {
      await navigator.clipboard.writeText(getContentCardText(card));
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  };

  const save = () => {
    const content = splitContentCardText(text);
    if (!content) {
      setText(getContentCardText(card));
    } else if (
      content.title !== card.title ||
      content.notes !== card.notes
    ) {
      onUpdate(content.title, content.notes);
    }
    setIsEditing(false);
  };

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] shadow-[var(--surface-shadow)] transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--brand)_26%,var(--line))] motion-reduce:transition-none",
        isCollapsed && "min-h-20",
        isDragging && "opacity-40",
        isDropTarget &&
          !isDragging &&
          "border-[var(--brand)] bg-[color:color-mix(in_srgb,var(--brand-soft)_26%,var(--paper-strong))]",
      )}
      data-drop-target={isDropTarget ? "true" : undefined}
      data-testid={`content-card-${card.id}`}
    >
      {isDropTarget && dropEdge ? (
        <span
          aria-hidden="true"
          data-testid={`content-card-drop-${dropEdge}-${card.id}`}
          className={cn(
            "pointer-events-none absolute right-3 left-3 z-20 h-0.5 rounded-full bg-[var(--brand)] shadow-[0_0_0_2px_var(--brand-soft)]",
            dropEdge === "before" ? "top-1" : "bottom-1",
          )}
        />
      ) : null}
      {isEditing ? (
        <textarea
          autoFocus
          aria-label={`Edit card ${card.title}`}
          value={text}
          rows={5}
          maxLength={2000}
          onChange={(event) => setText(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setText(getContentCardText(card));
              setIsEditing(false);
            } else if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey)
            ) {
              event.preventDefault();
              save();
            }
          }}
          className="block min-h-28 max-h-[10.5rem] w-full resize-y overflow-y-auto rounded-2xl border-0 bg-transparent px-4 py-3.5 pr-11 text-sm font-normal leading-6 text-[var(--ink-900)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        />
      ) : (
        <div
          onPointerDownCapture={() => {
            didDragRef.current = false;
          }}
          onClick={(event) => {
            if (didDragRef.current) {
              didDragRef.current = false;
              return;
            }
            if (!(event.target as Element).closest("a")) {
              onView();
            }
          }}
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab overflow-y-auto active:cursor-grabbing",
            !isCollapsed && "min-h-28 max-h-[10.5rem]",
          )}
          data-testid={`content-card-body-${card.id}`}
        >
          <ContentCardMarkdown
            title={card.title}
            notes={isCollapsed ? undefined : card.notes}
            variant="card"
          />
        </div>
      )}

      {!isEditing ? (
        <div
          role="toolbar"
          aria-label={`Card toolbar for ${card.title}`}
          className="flex min-h-10 items-center justify-between border-t border-[color:color-mix(in_srgb,var(--line)_70%,transparent)] px-2 py-1"
          data-testid={`content-card-toolbar-${card.id}`}
        >
          <div className="flex items-center gap-0.5">
            <Popover open={isActionsOpen} onOpenChange={setIsActionsOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`More actions for card ${card.title}`}
                      className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transition-none sm:size-7"
                    >
                      <Ellipsis className="size-4" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  More actions
                </TooltipContent>
              </Tooltip>
              <PopoverContent side="top" align="start" className="w-44 p-1.5">
                <div role="menu" aria-label={`Card actions for ${card.title}`}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsActionsOpen(false);
                      onRequestDelete();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[var(--warn)] transition-colors duration-150 hover:bg-[color:color-mix(in_srgb,var(--warn)_10%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--warn)] motion-reduce:transition-none"
                  >
                    <Trash2 className="size-3.5" />
                    Delete card
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                aria-label={`View card ${card.title}`}
                onClick={onView}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transition-none sm:size-7"
              >
                <Eye className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                View card
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                aria-label={`${isCopied ? "Copied" : "Copy"} card ${card.title}`}
                onClick={copyCard}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-[var(--paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transition-none sm:size-7",
                  isCopied
                    ? "text-[var(--brand)]"
                    : "text-[var(--ink-700)] hover:text-[var(--ink-900)]",
                )}
              >
                {isCopied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {isCopied ? "Copied" : "Copy Markdown"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                aria-label={`Edit card ${card.title}`}
                onClick={startEditing}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transition-none sm:size-7"
              >
                <Pencil className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Edit Markdown
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                aria-label={`${isCollapsed ? "Expand" : "Collapse"} card ${card.title}`}
                aria-expanded={!isCollapsed}
                onClick={() => setIsCollapsed((collapsed) => !collapsed)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transition-none sm:size-7"
              >
                {isCollapsed ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronUp className="size-4" />
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {isCollapsed ? "Expand card" : "Collapse card"}
              </TooltipContent>
            </Tooltip>
            <span className="sr-only" role="status">
              {isCopied ? `Copied card ${card.title}` : null}
            </span>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function InlineCardComposer({
  column,
  isOpen,
  onOpen,
  onClose,
  onSubmit,
}: {
  column: ContentColumn;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSubmit: (title: string, notes: string) => void;
}) {
  const [text, setText] = useState("");

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transition-none"
      >
        <Plus className="size-4" />
        Add card
      </button>
    );
  }

  const submit = () => {
    const content = splitContentCardText(text);
    if (!content) return;
    onSubmit(content.title, content.notes);
    setText("");
  };

  return (
    <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] p-2 shadow-[var(--surface-shadow)]">
      <textarea
        autoFocus
        aria-label={`New card in ${column.title}`}
        value={text}
        rows={5}
        maxLength={2000}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            (event.metaKey || event.ctrlKey)
          ) {
            event.preventDefault();
            submit();
          } else if (event.key === "Escape") {
            setText("");
            onClose();
          }
        }}
        placeholder="Write your card in Markdown…"
        className="min-h-28 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-3 text-sm font-normal leading-6 text-[var(--ink-900)] outline-none placeholder:text-[var(--ink-700)] focus:border-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setText("");
            onClose();
          }}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={submit}
          className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[color:color-mix(in_srgb,var(--brand)_88%,black)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add card
        </button>
      </div>
    </div>
  );
}

function ContentColumnView({
  column,
  cards,
  isCardDropTarget,
  dropTargetCardId,
  dropTargetEdge,
  canDelete,
  deleteDisabledReason,
  isComposerOpen,
  onOpenComposer,
  onCloseComposer,
  onAddCard,
  onViewCard,
  onUpdateCard,
  onRequestDeleteCard,
  onRename,
  onUpdateSubtitle,
  onRequestDelete,
}: {
  column: ContentColumn;
  cards: ContentCard[];
  isCardDropTarget: boolean;
  dropTargetCardId: string | null;
  dropTargetEdge: "before" | "after" | null;
  canDelete: boolean;
  deleteDisabledReason: string | null;
  isComposerOpen: boolean;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onAddCard: (title: string, notes: string) => void;
  onViewCard: (cardId: string) => void;
  onUpdateCard: (cardId: string, title: string, notes: string) => void;
  onRequestDeleteCard: (cardId: string) => void;
  onRename: (title: string) => void;
  onUpdateSubtitle: (subtitle: string) => void;
  onRequestDelete: () => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isEditingSubtitle, setIsEditingSubtitle] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [subtitle, setSubtitle] = useState(column.subtitle);
  const didDragRef = useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: columnDragId(column.id),
    data: {
      type: "column",
      columnId: column.id,
    } satisfies DragData,
  });

  useEffect(() => {
    if (isDragging) {
      didDragRef.current = true;
    }
  }, [isDragging]);

  const saveTitle = () => {
    const normalized = title.trim();
    if (normalized) {
      onRename(normalized);
    } else {
      setTitle(column.title);
    }
    setIsRenaming(false);
  };

  const saveSubtitle = () => {
    onUpdateSubtitle(subtitle.trim());
    setIsEditingSubtitle(false);
  };

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex max-h-full w-[calc(100vw-1.5rem)] shrink-0 snap-center flex-col rounded-2xl border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_72%,var(--paper))] p-3 shadow-[var(--surface-shadow)] transition-colors duration-150 motion-reduce:transition-none sm:w-[300px] sm:snap-none md:w-[320px]",
        isDragging && "opacity-40",
        isOver && !isDragging && "border-[var(--brand)] ring-2 ring-[var(--brand-soft)]",
        isCardDropTarget &&
          "border-[var(--brand)] bg-[color:color-mix(in_srgb,var(--brand-soft)_38%,var(--paper))] ring-2 ring-[var(--brand-soft)]",
      )}
      data-card-drop-target={isCardDropTarget ? "true" : undefined}
      data-testid={`content-column-${column.id}`}
    >
      <header className="mb-3 flex items-start gap-2 px-1">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              autoFocus
              aria-label={`Rename column ${column.title}`}
              value={title}
              maxLength={60}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveTitle();
                } else if (event.key === "Escape") {
                  setTitle(column.title);
                  setIsRenaming(false);
                }
              }}
              className="h-8 w-full rounded-lg border border-[var(--brand)] bg-[var(--paper)] px-2 text-sm font-semibold text-[var(--ink-900)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            />
          ) : (
            <button
              type="button"
              aria-label={`Rename column ${column.title}`}
              onPointerDownCapture={() => {
                didDragRef.current = false;
              }}
              onClick={() => {
                if (didDragRef.current) {
                  didDragRef.current = false;
                  return;
                }
                setIsRenaming(true);
              }}
              className="block w-full cursor-grab truncate rounded-lg px-1 py-1 text-left text-sm font-semibold text-[var(--ink-900)] transition-colors duration-150 hover:bg-[var(--paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              {column.title}
            </button>
          )}

          {isEditingSubtitle ? (
            <input
              autoFocus
              aria-label={`Edit subtitle for ${column.title}`}
              value={subtitle}
              maxLength={120}
              onChange={(event) => setSubtitle(event.target.value)}
              onBlur={saveSubtitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveSubtitle();
                } else if (event.key === "Escape") {
                  setSubtitle(column.subtitle);
                  setIsEditingSubtitle(false);
                }
              }}
              placeholder="Column subtitle"
              className="mt-1 h-7 w-full rounded-lg border border-[var(--brand)] bg-[var(--paper)] px-2 text-xs text-[var(--ink-700)] outline-none placeholder:text-[var(--ink-700)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            />
          ) : (
            <button
              type="button"
              aria-label={
                column.subtitle
                  ? `Edit subtitle for ${column.title}`
                  : `Add subtitle to ${column.title}`
              }
              onClick={() => setIsEditingSubtitle(true)}
              className="mt-0.5 block w-full truncate rounded-lg px-1 py-0.5 text-left text-xs font-normal text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              {column.subtitle || "Add a subtitle"}
            </button>
          )}
        </div>

        <span className="mt-1 rounded-full bg-[var(--paper)] px-2 py-0.5 font-mono text-[11px] text-[var(--ink-700)]">
          {cards.length}
        </span>

        <Popover open={isActionsOpen} onOpenChange={setIsActionsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`More actions for column ${column.title}`}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transition-none sm:size-7"
                >
                  <Ellipsis className="size-4" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              More actions
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="bottom" align="end" className="w-52 p-1.5">
            <div role="menu" aria-label={`Column actions for ${column.title}`}>
              <button
                type="button"
                role="menuitem"
                disabled={!canDelete}
                aria-disabled={!canDelete}
                onClick={() => {
                  setIsActionsOpen(false);
                  onRequestDelete();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-[var(--warn)] transition-colors duration-150 hover:bg-[color:color-mix(in_srgb,var(--warn)_10%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--warn)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
              >
                <Trash2 className="size-3.5" />
                Delete column
              </button>
              {deleteDisabledReason ? (
                <p className="px-2.5 pt-1 pb-1.5 text-xs leading-4 text-[var(--ink-700)]">
                  {deleteDisabledReason}
                </p>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </header>

      <div className="min-h-20 flex-1 overflow-y-auto px-0.5 pb-1">
        <SortableContext
          items={cards.map((card) => cardDragId(card.id))}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {cards.map((card) => (
              <ContentCardItem
                key={card.id}
                card={card}
                isDropTarget={dropTargetCardId === card.id}
                dropEdge={dropTargetCardId === card.id ? dropTargetEdge : null}
                onView={() => onViewCard(card.id)}
                onUpdate={(title, notes) =>
                  onUpdateCard(card.id, title, notes)
                }
                onRequestDelete={() => onRequestDeleteCard(card.id)}
              />
            ))}
            {cards.length === 0 ? (
              <div className="grid min-h-20 place-items-center rounded-xl border border-dashed border-[var(--line)] px-3 text-center text-xs text-[var(--ink-700)]">
                Drop cards here
              </div>
            ) : null}
          </div>
        </SortableContext>
      </div>

      <div className="mt-2 border-t border-[color:color-mix(in_srgb,var(--line)_70%,transparent)] pt-2">
        <InlineCardComposer
          column={column}
          isOpen={isComposerOpen}
          onOpen={onOpenComposer}
          onClose={onCloseComposer}
          onSubmit={onAddCard}
        />
      </div>
    </section>
  );
}

export function ContentPlannerView({
  board,
  cards,
  onAddColumn,
  onRenameColumn,
  onUpdateColumnSubtitle,
  onReorderColumns,
  onDeleteColumn,
  onAddCard,
  onUpdateCard,
  onMoveCard,
  onDeleteCard,
}: ContentPlannerViewProps) {
  const [composerColumnId, setComposerColumnId] = useState<string | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newColumnSubtitle, setNewColumnSubtitle] = useState("");
  const [viewingCardId, setViewingCardId] = useState<string | null>(null);
  const [isEditingViewingCard, setIsEditingViewingCard] = useState(false);
  const [viewingCardText, setViewingCardText] = useState("");
  const [pendingDeleteCardId, setPendingDeleteCardId] = useState<string | null>(null);
  const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [cardDropHighlight, setCardDropHighlight] = useState<CardDropHighlight | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const cardsByColumn = useMemo(
    () =>
      Object.fromEntries(
        board.columns.map((column) => [
          column.id,
          getContentCardsForColumn(cards, column.id),
        ]),
      ) as Record<string, ContentCard[]>,
    [board.columns, cards],
  );
  const viewingCard = viewingCardId ? cards[viewingCardId] ?? null : null;
  const pendingDeleteCard = pendingDeleteCardId ? cards[pendingDeleteCardId] ?? null : null;
  const pendingDeleteColumn =
    board.columns.find((column) => column.id === pendingDeleteColumnId) ?? null;
  const totalCards = Object.keys(cards).length;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag((event.active.data.current as DragData | undefined) ?? null);
    setCardDropHighlight(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const edge = getCardDropEdge(event);
    const nextHighlight = resolveContentBoardDragHighlight(
      event.active.data.current as DragData | undefined,
      event.over?.data.current as DragData | undefined,
      edge,
    );
    setCardDropHighlight((current) =>
      current?.columnId === nextHighlight?.columnId &&
      current?.cardId === nextHighlight?.cardId &&
      current?.edge === nextHighlight?.edge
        ? current
        : nextHighlight,
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    setCardDropHighlight(null);
    if (!event.over) return;

    const active = event.active.data.current as DragData | undefined;
    const over = event.over.data.current as DragData | undefined;
    if (!active || !over) return;

    const drop = resolveContentBoardDrop(
      active,
      over,
      cardsByColumn,
      getCardDropEdge(event),
    );
    if (!drop) return;

    if (drop.type === "column") {
      onReorderColumns(drop.activeColumnId, drop.overColumnId);
      return;
    }

    onMoveCard(drop.cardId, drop.targetColumnId, drop.targetIndex);
  };

  const submitColumn = () => {
    const normalized = newColumnTitle.trim();
    if (!normalized) return;
    onAddColumn(normalized, newColumnSubtitle.trim());
    setNewColumnTitle("");
    setNewColumnSubtitle("");
    setIsAddingColumn(false);
  };

  const startEditingViewingCard = () => {
    if (!viewingCard) return;
    setViewingCardText(getContentCardText(viewingCard));
    setIsEditingViewingCard(true);
  };

  const cancelEditingViewingCard = () => {
    setViewingCardText(viewingCard ? getContentCardText(viewingCard) : "");
    setIsEditingViewingCard(false);
  };

  const saveViewingCard = () => {
    if (!viewingCard) return;
    const content = splitContentCardText(viewingCardText);
    if (!content) return;
    if (
      content.title !== viewingCard.title ||
      content.notes !== viewingCard.notes
    ) {
      onUpdateCard(viewingCard.id, content.title, content.notes);
    }
    setIsEditingViewingCard(false);
  };

  return (
    <section
      data-testid="content-planner-view"
      className="flex h-full min-h-0 flex-col bg-[var(--paper)]"
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_92%,var(--paper))] px-3 py-3 sm:px-4 sm:py-4 md:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-[var(--ink-900)] sm:text-xl">Content Planner</h1>
            <span className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 font-mono text-[11px] text-[var(--ink-700)]">
              {totalCards} {totalCards === 1 ? "card" : "cards"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--ink-700)]">
            Shape ideas into published work, one calm step at a time.
          </p>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={contentBoardCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveDrag(null);
          setCardDropHighlight(null);
        }}
      >
        <div
          aria-label="Content workflow board"
          className="min-h-0 flex-1 snap-x snap-mandatory scroll-px-3 overflow-x-auto overflow-y-hidden overscroll-x-contain p-3 sm:snap-none sm:scroll-px-4 sm:p-4 md:scroll-px-6 md:p-6"
          role="region"
        >
          <SortableContext
            items={board.columns.map((column) => columnDragId(column.id))}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex h-full min-w-max items-start gap-3">
              {board.columns.map((column) => {
                const columnCards = cardsByColumn[column.id] ?? [];
                const deleteDisabledReason =
                  board.columns.length <= 1
                    ? "The board needs at least one column."
                    : columnCards.length > 0
                      ? "Move or delete this column’s cards first."
                      : null;

                return (
                  <ContentColumnView
                    key={column.id}
                    column={column}
                    cards={columnCards}
                    isCardDropTarget={cardDropHighlight?.columnId === column.id}
                    dropTargetCardId={
                      cardDropHighlight?.columnId === column.id
                        ? cardDropHighlight.cardId
                        : null
                    }
                    dropTargetEdge={
                      cardDropHighlight?.columnId === column.id
                        ? cardDropHighlight.edge
                        : null
                    }
                    canDelete={!deleteDisabledReason}
                    deleteDisabledReason={deleteDisabledReason}
                    isComposerOpen={composerColumnId === column.id}
                    onOpenComposer={() => setComposerColumnId(column.id)}
                    onCloseComposer={() => setComposerColumnId(null)}
                    onAddCard={(title, notes) => {
                      onAddCard(column.id, title, notes);
                      setComposerColumnId(null);
                    }}
                    onViewCard={setViewingCardId}
                    onUpdateCard={onUpdateCard}
                    onRequestDeleteCard={setPendingDeleteCardId}
                    onRename={(title) => onRenameColumn(column.id, title)}
                    onUpdateSubtitle={(subtitle) =>
                      onUpdateColumnSubtitle(column.id, subtitle)
                    }
                    onRequestDelete={() => setPendingDeleteColumnId(column.id)}
                  />
                );
              })}

              <div className="w-[calc(100vw-1.5rem)] shrink-0 snap-center sm:w-[280px] sm:snap-none">
                {isAddingColumn ? (
                  <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_72%,var(--paper))] p-3 shadow-[var(--surface-shadow)]">
                    <input
                      autoFocus
                      aria-label="New column title"
                      value={newColumnTitle}
                      maxLength={60}
                      onChange={(event) => setNewColumnTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitColumn();
                        } else if (event.key === "Escape") {
                          setNewColumnTitle("");
                          setIsAddingColumn(false);
                        }
                      }}
                      placeholder="Column title"
                      className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 text-sm text-[var(--ink-900)] outline-none placeholder:text-[var(--ink-700)] focus:border-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                    />
                    <input
                      aria-label="New column subtitle"
                      value={newColumnSubtitle}
                      maxLength={120}
                      onChange={(event) => setNewColumnSubtitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitColumn();
                        } else if (event.key === "Escape") {
                          setNewColumnTitle("");
                          setNewColumnSubtitle("");
                          setIsAddingColumn(false);
                        }
                      }}
                      placeholder="Subtitle (optional)"
                      className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 text-sm text-[var(--ink-900)] outline-none placeholder:text-[var(--ink-700)] focus:border-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewColumnTitle("");
                          setNewColumnSubtitle("");
                          setIsAddingColumn(false);
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!newColumnTitle.trim()}
                        onClick={submitColumn}
                        className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[color:color-mix(in_srgb,var(--brand)_88%,black)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add column
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingColumn(true)}
                    className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_52%,var(--paper))] px-4 py-3 text-sm font-semibold text-[var(--ink-700)] transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--brand)_28%,var(--line))] hover:bg-[var(--paper-strong)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  >
                    <Plus className="size-4" />
                    Add column
                  </button>
                )}
              </div>
            </div>
          </SortableContext>
        </div>

        <DragOverlay>
          {activeDrag?.type === "card" && cards[activeDrag.cardId] ? (
            <div className="w-[calc(100vw-2rem)] max-w-[290px] rounded-2xl border border-[var(--brand)] bg-[var(--paper-strong)] px-4 py-3.5 shadow-[var(--surface-shadow)]">
              <ContentCardMarkdown
                title={cards[activeDrag.cardId].title}
                notes={cards[activeDrag.cardId].notes}
              />
            </div>
          ) : activeDrag?.type === "column" ? (
            <div className="w-[calc(100vw-2rem)] max-w-[300px] rounded-2xl border border-[var(--brand)] bg-[var(--paper-strong)] px-4 py-3 text-sm font-semibold text-[var(--ink-900)] shadow-[var(--surface-shadow)]">
              {board.columns.find((column) => column.id === activeDrag.columnId)?.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog
        open={Boolean(viewingCard)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingCardId(null);
            setIsEditingViewingCard(false);
            setViewingCardText("");
          }
        }}
      >
        {viewingCard ? (
          <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-3xl overflow-y-auto p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-5">
            <DialogHeader>
              <DialogTitle>Card preview</DialogTitle>
              <DialogDescription>
                Read the complete rendered Markdown card or edit it directly.
              </DialogDescription>
            </DialogHeader>
            <div
              className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] focus-within:border-[var(--brand)]"
              data-testid="content-card-preview-surface"
            >
              {isEditingViewingCard ? (
                <textarea
                  autoFocus
                  aria-label={`Edit card ${viewingCard.title} in preview`}
                  value={viewingCardText}
                  rows={12}
                  maxLength={2000}
                  onChange={(event) => setViewingCardText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      cancelEditingViewingCard();
                    } else if (
                      event.key === "Enter" &&
                      (event.metaKey || event.ctrlKey)
                    ) {
                      event.preventDefault();
                      saveViewingCard();
                    }
                  }}
                  className="block min-h-[42dvh] max-h-[55dvh] w-full resize-y overflow-y-auto border-0 bg-transparent p-4 text-sm font-normal leading-6 text-[var(--ink-900)] outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)] sm:min-h-72 sm:max-h-[70vh]"
                />
              ) : (
                <>
                  <div className="min-h-[42dvh] max-h-[55dvh] overflow-y-auto p-4 pr-12 sm:min-h-72 sm:max-h-[70vh]">
                    <ContentCardMarkdown
                      title={viewingCard.title}
                      notes={viewingCard.notes}
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={`Edit card ${viewingCard.title} from preview`}
                      onClick={startEditingViewingCard}
                      className="absolute top-2.5 right-2.5 inline-flex size-8 items-center justify-center rounded-lg bg-[var(--paper-strong)] text-[var(--ink-700)] shadow-[var(--surface-shadow)] transition-colors duration-150 hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transition-none"
                    >
                      <Pencil className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      Edit card
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
            {isEditingViewingCard ? (
              <DialogFooter className="sm:justify-end">
                <button
                  type="button"
                  onClick={cancelEditingViewingCard}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transition-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!viewingCardText.trim()}
                  onClick={saveViewingCard}
                  className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[color:color-mix(in_srgb,var(--brand)_88%,black)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                >
                  Save changes
                </button>
              </DialogFooter>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDeleteCard)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteCardId(null);
        }}
      >
        <AlertDialogContent className="alert-dialog-content">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold text-[var(--ink-900)]">
              Delete this card?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--ink-700)]">
              “{pendingDeleteCard?.title}” will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="alert-dialog-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="alert-dialog-action--danger"
              onClick={() => {
                if (!pendingDeleteCard) return;
                onDeleteCard(pendingDeleteCard.id);
                setPendingDeleteCardId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDeleteColumn)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteColumnId(null);
        }}
      >
        <AlertDialogContent className="alert-dialog-content">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold text-[var(--ink-900)]">
              Delete this column?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--ink-700)]">
              “{pendingDeleteColumn?.title}” will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="alert-dialog-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="alert-dialog-action--danger"
              onClick={() => {
                if (!pendingDeleteColumn) return;
                onDeleteColumn(pendingDeleteColumn.id);
                setPendingDeleteColumnId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
