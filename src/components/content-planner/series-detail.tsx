"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowLeft, MoreHorizontal, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ConfirmDialog } from "@/components/blocks/confirm-dialog";
import { InlineComposer } from "@/components/blocks/inline-composer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import type { ConveyorStage } from "@/lib/content-conveyor";
import { formatSeriesStats, type SeriesStats } from "@/lib/content-series";
import type { ContentCard, ContentSeries } from "@/lib/types";
import { STAGE_LABELS } from "./stage-labels";

const AUTOSAVE_DELAY_MS = 400;

type SeriesDetailProps = {
  /** The open series, or null when closed. */
  series: ContentSeries | null;
  stats: SeriesStats;
  groups: { stage: ConveyorStage; cards: ContentCard[] }[];
  /** `sheet`: phone full screen with Back. `dialog`: centered on wide screens. */
  layout: "sheet" | "dialog";
  typographyStyle?: CSSProperties;
  onClose: () => void;
  onUpdate: (seriesId: string, title: string, about: string) => void;
  onAddIdea: (seriesId: string, title: string) => void;
  onOpenCard: (cardId: string) => void;
  onDelete: (seriesId: string) => void;
};

/**
 * One series: its name, what it is about, how far its videos have come, and
 * every video in it grouped by stage. New ideas added here start in Ideas,
 * already in the series.
 */
export function SeriesDetail({ series, layout, typographyStyle, onClose, ...props }: SeriesDetailProps) {
  const isSheet = layout === "sheet";
  return (
    <DialogPrimitive.Root open={Boolean(series)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogPrimitive.Portal>
        {isSheet ? null : <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs" />}
        <DialogPrimitive.Popup
          style={typographyStyle}
          className={
            isSheet
              ? "fixed inset-0 z-50 flex flex-col bg-background text-foreground outline-none animate-enter"
              : "fixed inset-x-4 top-1/2 z-50 mx-auto flex max-h-[calc(100dvh-4rem)] w-auto max-w-xl -translate-y-1/2 flex-col rounded-2xl bg-popover text-popover-foreground shadow-card outline-none animate-enter"
          }
        >
          {series ? <SeriesBody key={series.id} series={series} isSheet={isSheet} onClose={onClose} {...props} /> : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

type SeriesBodyProps = Omit<SeriesDetailProps, "series" | "layout" | "typographyStyle"> & {
  series: ContentSeries;
  isSheet: boolean;
};

function SeriesBody({ series, stats, groups, isSheet, onClose, onUpdate, onAddIdea, onOpenCard, onDelete }: SeriesBodyProps) {
  const [draft, setDraft] = useState({ title: series.title, about: series.about });
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Autosave: debounced, flushed on blur and on close (unmount).
  const pendingRef = useRef<typeof draft | null>(null);
  const timerRef = useRef<number | null>(null);
  const seriesRef = useRef(series);
  const onUpdateRef = useRef(onUpdate);
  useLayoutEffect(() => {
    seriesRef.current = series;
    onUpdateRef.current = onUpdate;
  });

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    const current = seriesRef.current;
    const title = pending.title.trim() || current.title;
    const about = pending.about.trim();
    if (title === current.title && about === current.about) return;
    onUpdateRef.current(current.id, title, about);
  }, []);

  useEffect(() => flush, [flush]);

  const edit = (next: typeof draft) => {
    setDraft(next);
    pendingRef.current = next;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, AUTOSAVE_DELAY_MS);
  };

  return (
    <>
      <header
        className={
          isSheet
            ? "flex items-center gap-2 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
            : "flex items-center gap-2 px-5 pt-4"
        }
      >
        {isSheet ? <IconButton label="Back to list" icon={<ArrowLeft />} onClick={onClose} /> : null}
        <p className="flex-1 text-[0.8125rem] font-semibold text-muted-foreground" aria-hidden="true">
          Series
        </p>
        <DialogPrimitive.Title className="sr-only">{series.title}</DialogPrimitive.Title>
        <DropdownMenu>
          <DropdownMenuTrigger render={<IconButton label="Series actions" icon={<MoreHorizontal />} />} />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 aria-hidden="true" />
              Delete series
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {isSheet ? null : <IconButton label="Close" icon={<X />} onClick={onClose} />}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-6 sm:px-5">
        <div>
          <label htmlFor={`series-title-${series.id}`} className="sr-only">
            Series name
          </label>
          <textarea
            id={`series-title-${series.id}`}
            rows={1}
            value={draft.title}
            onChange={(event) => edit({ ...draft, title: event.target.value.replace(/\r?\n/g, " ") })}
            onBlur={flush}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            className="field-sizing-content w-full resize-none overflow-hidden rounded-lg bg-transparent py-1 font-heading text-[1.5625em] font-bold leading-normal text-foreground outline-none focus-visible:bg-muted/50"
          />
          <p className="mt-1 min-h-5 font-mono text-[0.8125rem] text-muted-foreground tabular-nums" aria-live="polite">
            {groups.length > 0 ? formatSeriesStats(stats) : ""}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`series-about-${series.id}`} className="text-[0.8125rem] font-semibold text-muted-foreground">
            What this series is about
          </label>
          <textarea
            id={`series-about-${series.id}`}
            rows={2}
            value={draft.about}
            onChange={(event) => edit({ ...draft, about: event.target.value })}
            onBlur={flush}
            placeholder="The big idea, who it's for, what ties the videos together"
            className="field-sizing-content min-h-16 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[0.9375em] leading-[1.7] text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
        </div>

        <InlineComposer
          placeholder="Add an idea to this series…"
          onSubmit={(text) => onAddIdea(series.id, text)}
          className="-mx-1"
        />

        {groups.length > 0 ? (
          groups.map((group) => (
            <section key={group.stage} aria-label={STAGE_LABELS[group.stage]} className="flex flex-col gap-1">
              <h3 className="font-heading text-[0.9375rem] font-bold text-muted-foreground">
                {STAGE_LABELS[group.stage]}
                <span className="ml-2 font-mono text-[0.8125rem] font-normal tabular-nums">{group.cards.length}</span>
              </h3>
              <ul className="flex flex-col">
                {group.cards.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() => onOpenCard(card.id)}
                      className="w-full rounded-lg px-3 py-2 text-left font-heading text-[0.9375em] font-semibold leading-snug text-foreground transition-colors outline-none hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11"
                    >
                      <span className="line-clamp-2">{card.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No videos yet. Add an idea above, or open any card and choose{" "}
            <span className="text-foreground">Add to a series</span>.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={`Delete “${series.title}”?`}
        description="Its videos stay — they just leave the series."
        confirmLabel="Delete series"
        onConfirm={() => {
          pendingRef.current = null;
          onDelete(series.id);
        }}
      />
    </>
  );
}
