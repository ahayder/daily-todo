"use client";

import { ArrowUp, ArrowUpToLine, ChevronDown, MoreHorizontal, MoveRight, Trash2 } from "lucide-react";
import { useCallback, useMemo, useSyncExternalStore, type KeyboardEvent } from "react";
import { SoftCapBadge } from "@/components/signature/stage-track";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import {
  getColumnForStage,
  getRowSnippet,
  getSectionFill,
  GROWTH_SECTIONS,
  isInCurrentWeek,
  SHELF_STAGE_ORDER,
  type ConveyorStage,
} from "@/lib/content-conveyor";
import { SHOOT_NEXT_SOFT_CAP } from "@/lib/store";
import type { ContentCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SECTION_LABELS, STAGE_LABELS } from "./stage-labels";

const COLLAPSED_STORAGE_KEY = "dailytodo.content-shelf.collapsed";
const DEFAULT_COLLAPSED: Record<ConveyorStage, boolean> = {
  editing: false,
  "shoot-next": false,
  develop: false,
  inbox: false,
  published: true,
};

const collapseListeners = new Set<() => void>();
/** In-memory fallback so collapsing still works when storage is blocked. */
let memoryCollapsedRaw: string | null = null;

function readCollapsedRaw(): string | null {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) ?? memoryCollapsedRaw;
  } catch {
    return memoryCollapsedRaw;
  }
}

function subscribeCollapsed(onChange: () => void) {
  collapseListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    collapseListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Device-local group collapse — a convenience, never synced. */
function useCollapsedGroups() {
  const raw = useSyncExternalStore(subscribeCollapsed, readCollapsedRaw, () => null);
  const collapsed = useMemo<Record<ConveyorStage, boolean>>(() => {
    if (!raw) return DEFAULT_COLLAPSED;
    try {
      return { ...DEFAULT_COLLAPSED, ...(JSON.parse(raw) as Partial<Record<ConveyorStage, boolean>>) };
    } catch {
      return DEFAULT_COLLAPSED;
    }
  }, [raw]);

  const toggle = useCallback(
    (stage: ConveyorStage) => {
      memoryCollapsedRaw = JSON.stringify({ ...collapsed, [stage]: !collapsed[stage] });
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, memoryCollapsedRaw);
      } catch {
        // Storage unavailable — the in-memory copy covers this session.
      }
      collapseListeners.forEach((listener) => listener());
    },
    [collapsed],
  );

  return [collapsed, toggle] as const;
}

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const SHORT_DATE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function shippedLabel(publishedAt: string | null | undefined, now: Date) {
  if (!publishedAt) return null;
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Shipped ${isInCurrentWeek(publishedAt, now) ? WEEKDAY.format(date) : SHORT_DATE.format(date)}`;
}

type ContentShelfProps = {
  cardsByStage: Record<ConveyorStage, ContentCard[]>;
  selectedCardId: string | null;
  shippedThisWeek: number;
  onSelectCard: (cardId: string) => void;
  onMoveCard: (cardId: string, targetColumnId: string, targetIndex: number) => void;
  onDeleteCard: (cardId: string) => void;
  onReviewIdeas: () => void;
};

/**
 * The shelf: every card as a wide, readable row grouped by stage — soonest work
 * first. Rows show the title, the part of the card being worked on, and which
 * sections are filled, so the whole pipeline reads at a glance.
 */
export function ContentShelf({
  cardsByStage,
  selectedCardId,
  shippedThisWeek,
  onSelectCard,
  onMoveCard,
  onDeleteCard,
  onReviewIdeas,
}: ContentShelfProps) {
  const [collapsed, toggleCollapsed] = useCollapsedGroups();
  const now = new Date();

  // Arrow keys move between rows (focus only — Enter/click opens).
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const target = event.target as HTMLElement;
    if (!target.matches("[data-shelf-row]")) return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-shelf-row]"));
    const index = rows.indexOf(target);
    const next = rows[event.key === "ArrowDown" ? index + 1 : index - 1];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <div className="flex flex-col gap-5" onKeyDown={handleKeyDown}>
      {SHELF_STAGE_ORDER.map((stage) => {
        const cards = cardsByStage[stage];
        const isCollapsed = collapsed[stage];
        const groupId = `shelf-group-${stage}`;
        return (
          <section key={stage} aria-labelledby={`${groupId}-label`} className="flex flex-col gap-1">
            <div className="flex min-h-9 items-center gap-2 pr-1">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-controls={groupId}
                onClick={() => toggleCollapsed(stage)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pl-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11"
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn("size-4 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")}
                />
                <h2 id={`${groupId}-label`} className="font-heading text-base font-bold text-foreground">
                  {STAGE_LABELS[stage]}
                </h2>
                {stage === "shoot-next" ? (
                  <SoftCapBadge count={cards.length} cap={SHOOT_NEXT_SOFT_CAP} noun="cards in Shoot next" />
                ) : (
                  <span className="font-mono text-[0.8125rem] text-muted-foreground tabular-nums">
                    {cards.length}
                  </span>
                )}
                {stage === "published" && shippedThisWeek > 0 ? (
                  <span className="text-[0.8125rem] text-muted-foreground">· {shippedThisWeek} this week</span>
                ) : null}
              </button>
              {stage === "inbox" && cards.length > 1 ? (
                <Button variant="ghost" size="sm" className="pointer-coarse:h-11 pointer-coarse:px-4" onClick={onReviewIdeas}>
                  Review
                </Button>
              ) : null}
            </div>

            {!isCollapsed ? (
              <ul id={groupId} className="flex flex-col gap-1">
                {cards.length === 0 ? (
                  stage === "inbox" ? (
                    <li className="rounded-xl px-4 py-2 text-sm text-muted-foreground">
                      No ideas waiting. Capture one above.
                    </li>
                  ) : null
                ) : (
                  cards.map((card, index) => (
                    <ShelfRow
                      key={card.id}
                      card={card}
                      stage={stage}
                      index={index}
                      isSelected={card.id === selectedCardId}
                      shipped={stage === "published" ? shippedLabel(card.publishedAt, now) : null}
                      onSelect={() => onSelectCard(card.id)}
                      onMoveCard={onMoveCard}
                      onDelete={() => onDeleteCard(card.id)}
                    />
                  ))
                )}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

type ShelfRowProps = {
  card: ContentCard;
  stage: ConveyorStage;
  index: number;
  isSelected: boolean;
  shipped: string | null;
  onSelect: () => void;
  onMoveCard: (cardId: string, targetColumnId: string, targetIndex: number) => void;
  onDelete: () => void;
};

function ShelfRow({ card, stage, index, isSelected, shipped, onSelect, onMoveCard, onDelete }: ShelfRowProps) {
  const snippet = getRowSnippet(card);
  const fill = getSectionFill(card.notes);
  const filledLabels = GROWTH_SECTIONS.filter((name) => fill[name]).map((name) => SECTION_LABELS[name]);

  return (
    <li
      className={cn(
        "group/row relative flex items-start rounded-xl transition-colors",
        isSelected ? "bg-muted" : "hover:bg-card",
      )}
    >
      {isSelected ? (
        <span aria-hidden="true" className="absolute top-3 bottom-3 left-0 w-1 rounded-full bg-primary" />
      ) : null}
      <button
        type="button"
        data-shelf-row
        data-card-id={card.id}
        aria-current={isSelected ? "true" : undefined}
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl py-2.5 pr-2 pl-4 text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="line-clamp-2 font-heading text-[0.9375em] font-semibold leading-snug text-foreground">
          {card.title}
        </span>
        {snippet ? (
          <span className="line-clamp-2 text-[0.875em] leading-[1.7] text-muted-foreground">{snippet}</span>
        ) : null}
        <span className="mt-0.5 flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <span className="flex items-center gap-1" aria-hidden="true">
            {GROWTH_SECTIONS.map((name) => (
              <span
                key={name}
                className={cn("size-2 rounded-full", fill[name] ? "bg-foreground/60" : "border border-input")}
              />
            ))}
          </span>
          <span className="sr-only">
            {filledLabels.length > 0 ? `Written: ${filledLabels.join(", ")}` : "Nothing written yet"}
          </span>
          {shipped ? <span>{shipped}</span> : null}
        </span>
      </button>
      <RowMenu card={card} stage={stage} index={index} onMoveCard={onMoveCard} onDelete={onDelete} />
    </li>
  );
}

type RowMenuProps = {
  card: ContentCard;
  stage: ConveyorStage;
  index: number;
  onMoveCard: (cardId: string, targetColumnId: string, targetIndex: number) => void;
  onDelete: () => void;
};

/** Card actions that are rare by design: reorder, skip/return a stage, delete. */
export function RowMenu({ card, stage, index, onMoveCard, onDelete }: RowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            label={`More for ${card.title}`}
            icon={<MoreHorizontal />}
            className="mt-2 mr-1.5 opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:mt-0.5 pointer-coarse:opacity-100"
          />
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <CardMoveItems card={card} stage={stage} index={index} onMoveCard={onMoveCard} />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          Delete card
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Shared "Move up / Move to top / Move to stage" items for row + detail menus. */
export function CardMoveItems({
  card,
  stage,
  index,
  onMoveCard,
}: Omit<RowMenuProps, "onDelete">) {
  return (
    <>
      <DropdownMenuItem disabled={index === 0} onClick={() => onMoveCard(card.id, card.columnId, 0)}>
        <ArrowUpToLine aria-hidden="true" />
        Move to top
      </DropdownMenuItem>
      <DropdownMenuItem disabled={index === 0} onClick={() => onMoveCard(card.id, card.columnId, index - 1)}>
        <ArrowUp aria-hidden="true" />
        Move up
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <MoveRight aria-hidden="true" />
          Move to stage
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {(["inbox", "develop", "shoot-next", "editing", "published"] as const)
            .filter((target) => target !== stage)
            .map((target) => (
              <DropdownMenuItem key={target} onClick={() => onMoveCard(card.id, getColumnForStage(target), 0)}>
                {STAGE_LABELS[target]}
              </DropdownMenuItem>
            ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}
