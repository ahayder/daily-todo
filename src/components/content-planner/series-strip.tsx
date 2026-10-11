"use client";

import { Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSeriesHeadline, type SeriesStats } from "@/lib/content-series";
import type { ContentSeries } from "@/lib/types";

type SeriesStripProps = {
  /** Most recently active first. */
  series: { series: ContentSeries; stats: SeriesStats }[];
  onOpenSeries: (seriesId: string) => void;
  onNewSeries: () => void;
};

/**
 * Quiet row of series chips under "This week": each chip names a series and
 * its one headline count. It never competes with Next up — no lilac, no fill.
 */
export function SeriesStrip({ series, onOpenSeries, onNewSeries }: SeriesStripProps) {
  return (
    <section
      aria-label="Series"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-card px-4 py-2 shadow-[var(--rim)] sm:flex-nowrap"
    >
      <p className="shrink-0 text-[0.8125rem] font-semibold text-muted-foreground">Series</p>
      {series.length > 0 ? (
        <ul className="order-3 -mx-1 flex min-w-0 basis-full gap-2 overflow-x-auto px-1 py-1 sm:order-2 sm:basis-auto sm:flex-1">
          {series.map(({ series: item, stats }) => (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onOpenSeries(item.id)}
                aria-label={`${item.title}, ${getSeriesHeadline(stats)}`}
                className="press inline-flex h-9 max-w-64 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-[0.875rem] text-foreground transition-colors outline-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:h-11"
              >
                <Layers aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-semibold">{item.title}</span>
                <span className="shrink-0 font-mono text-[0.8125rem] text-muted-foreground tabular-nums">
                  · {getSeriesHeadline(stats)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="order-3 min-w-0 basis-full pb-1 text-sm text-muted-foreground sm:order-2 sm:basis-auto sm:flex-1 sm:pb-0">
          Group videos that belong together.
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="order-2 ml-auto text-muted-foreground sm:order-3 pointer-coarse:h-11"
        onClick={onNewSeries}
      >
        <Plus aria-hidden="true" />
        New series
      </Button>
    </section>
  );
}
