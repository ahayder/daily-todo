"use client";

import { useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function columnDragId(columnId: string) {
  return `content-column:${columnId}`;
}

function cardDragId(cardId: string) {
  return `content-card:${cardId}`;
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
  return {
    type: "card",
    cardId: active.cardId,
    targetColumnId,
    targetIndex:
      over.type === "card"
        ? Math.max(
            0,
            targetCards.findIndex((card) => card.id === over.cardId),
          )
        : targetCards.length,
  };
}

function ContentCardItem({
  card,
  onView,
  onUpdate,
  onRequestDelete,
}: {
  card: ContentCard;
  onView: () => void;
  onUpdate: (title: string, notes: string) => void;
  onRequestDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [text, setText] = useState(() => getContentCardText(card));
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
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
        "group relative max-h-[10.5rem] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] shadow-[var(--surface-shadow)] transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--brand)_26%,var(--line))] motion-reduce:transition-none",
        isDragging && "opacity-40",
        isOver && !isDragging && "ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--paper)]",
      )}
      data-testid={`content-card-${card.id}`}
    >
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
          onClick={(event) => {
            if (!(event.target as Element).closest("a")) {
              onView();
            }
          }}
          {...listeners}
          className={cn(
            "cursor-grab overflow-y-auto rounded-2xl px-4 py-3.5 pr-20 pb-11 active:cursor-grabbing",
            isCollapsed ? "min-h-24" : "min-h-28 max-h-[10.5rem]",
          )}
          data-testid={`content-card-body-${card.id}`}
        >
          <ContentCardMarkdown
            title={card.title}
            notes={isCollapsed ? undefined : card.notes}
          />
        </div>
      )}

      {!isEditing ? (
        <Tooltip>
          <TooltipTrigger
            aria-label={`${isCollapsed ? "Expand" : "Collapse"} card ${card.title}`}
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            className="absolute top-2.5 right-2.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] motion-reduce:transition-none"
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
      ) : null}

      <Tooltip>
        <TooltipTrigger
          aria-label={`View card ${card.title}`}
          onClick={onView}
          className="absolute right-[4.5rem] bottom-2.5 inline-flex size-7 items-center justify-center rounded-lg text-[var(--ink-700)] opacity-0 transition-all duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] group-hover:opacity-100 motion-reduce:transition-none"
        >
          <Eye className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          View card
        </TooltipContent>
      </Tooltip>

      {!isEditing ? (
        <Tooltip>
          <TooltipTrigger
            aria-label={`Edit card ${card.title}`}
            onClick={startEditing}
            className="absolute right-10 bottom-2.5 inline-flex size-7 items-center justify-center rounded-lg text-[var(--ink-700)] opacity-0 transition-all duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] group-hover:opacity-100 motion-reduce:transition-none"
          >
            <Pencil className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Edit Markdown
          </TooltipContent>
        </Tooltip>
      ) : null}

      <Tooltip>
        <TooltipTrigger
          aria-label={`Delete card ${card.title}`}
          onClick={onRequestDelete}
          className="absolute right-2.5 bottom-2.5 inline-flex size-7 items-center justify-center rounded-lg text-[var(--ink-700)] opacity-0 transition-all duration-150 hover:bg-[color:color-mix(in_srgb,var(--warn)_10%,transparent)] hover:text-[var(--warn)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--warn)] group-hover:opacity-100 motion-reduce:transition-none"
        >
          <Trash2 className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Delete card
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          aria-label={`Move card ${card.title}`}
          className="absolute top-2.5 right-10 inline-flex size-7 cursor-grab items-center justify-center rounded-lg text-[var(--ink-700)] opacity-0 transition-all duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] active:cursor-grabbing group-hover:opacity-100 motion-reduce:transition-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Drag to move card
        </TooltipContent>
      </Tooltip>
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
  const [title, setTitle] = useState(column.title);
  const [subtitle, setSubtitle] = useState(column.subtitle);
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
        "flex max-h-full w-[300px] shrink-0 flex-col rounded-2xl border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_72%,var(--paper))] p-3 shadow-[var(--surface-shadow)] md:w-[320px]",
        isDragging && "opacity-40",
        isOver && !isDragging && "border-[var(--brand)] ring-2 ring-[var(--brand-soft)]",
      )}
      data-testid={`content-column-${column.id}`}
    >
      <header className="mb-3 flex items-start gap-2 px-1">
        <Tooltip>
          <TooltipTrigger
            aria-label={`Move column ${column.title}`}
            className="inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Drag to reorder column
          </TooltipContent>
        </Tooltip>

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
              onClick={() => setIsRenaming(true)}
              className="block w-full truncate rounded-lg px-1 py-1 text-left text-sm font-semibold text-[var(--ink-900)] transition-colors duration-150 hover:bg-[var(--paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
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

        <Tooltip>
          <TooltipTrigger
            aria-label={`Delete column ${column.title}`}
            aria-disabled={!canDelete}
            onClick={() => {
              if (canDelete) onRequestDelete();
            }}
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
              canDelete
                ? "text-[var(--ink-700)] hover:bg-[color:color-mix(in_srgb,var(--warn)_10%,transparent)] hover:text-[var(--warn)]"
                : "cursor-not-allowed text-[var(--ink-700)] opacity-35",
            )}
          >
            <Trash2 className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-52 text-xs">
            {deleteDisabledReason ?? "Delete column"}
          </TooltipContent>
        </Tooltip>
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
  const [pendingDeleteCardId, setPendingDeleteCardId] = useState<string | null>(null);
  const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    if (!event.over) return;

    const active = event.active.data.current as DragData | undefined;
    const over = event.over.data.current as DragData | undefined;
    if (!active || !over) return;

    const drop = resolveContentBoardDrop(active, over, cardsByColumn);
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

  return (
    <section
      data-testid="content-planner-view"
      className="flex h-full min-h-0 flex-col bg-[var(--paper)]"
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_92%,var(--paper))] px-4 py-4 md:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-[var(--ink-900)]">Content Planner</h1>
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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6">
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

              <div className="w-[280px] shrink-0">
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
            <div className="w-[290px] rounded-2xl border border-[var(--brand)] bg-[var(--paper-strong)] px-4 py-3.5 shadow-[var(--surface-shadow)]">
              <ContentCardMarkdown
                title={cards[activeDrag.cardId].title}
                notes={cards[activeDrag.cardId].notes}
              />
            </div>
          ) : activeDrag?.type === "column" ? (
            <div className="w-[300px] rounded-2xl border border-[var(--brand)] bg-[var(--paper-strong)] px-4 py-3 text-sm font-semibold text-[var(--ink-900)] shadow-[var(--surface-shadow)]">
              {board.columns.find((column) => column.id === activeDrag.columnId)?.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog
        open={Boolean(viewingCard)}
        onOpenChange={(open) => {
          if (!open) setViewingCardId(null);
        }}
      >
        {viewingCard ? (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Card preview</DialogTitle>
              <DialogDescription>
                Read the complete rendered Markdown card.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
              <ContentCardMarkdown
                title={viewingCard.title}
                notes={viewingCard.notes}
              />
            </div>
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
