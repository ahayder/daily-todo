"use client";

import { Check, Layers, LogOut, Plus, SquareArrowOutUpRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContentSeries } from "@/lib/types";

type CardSeriesPickerProps = {
  cardTitle: string;
  current: ContentSeries | null;
  series: ContentSeries[];
  onSelect: (seriesId: string | null) => void;
  onNewSeries: () => void;
  onOpenSeries: (seriesId: string) => void;
};

/**
 * The card's series as a quiet chip: "Money basics" or "Add to a series".
 * One series per card; choosing another moves it, "Leave series" clears it.
 */
export function CardSeriesPicker({ cardTitle, current, series, onSelect, onNewSeries, onOpenSeries }: CardSeriesPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={current ? `Series: ${current.title}. Change series for ${cardTitle}` : `Add ${cardTitle} to a series`}
        className="press inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[0.8125rem] text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:bg-muted pointer-coarse:h-11"
      >
        {current ? (
          <>
            <Layers aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate font-semibold text-foreground">{current.title}</span>
          </>
        ) : (
          <>
            <Plus aria-hidden="true" className="size-4 shrink-0" />
            Add to a series
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {series.length > 0 ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[0.8125rem]">Series</DropdownMenuLabel>
              {series.map((item) => (
                <DropdownMenuItem key={item.id} onClick={() => onSelect(item.id)}>
                  {item.id === current?.id ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <Layers aria-hidden="true" className="text-muted-foreground" />
                  )}
                  <span className="truncate">{item.title}</span>
                  {item.id === current?.id ? <span className="sr-only">(current)</span> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={onNewSeries}>
          <Plus aria-hidden="true" />
          New series…
        </DropdownMenuItem>
        {current ? (
          <>
            <DropdownMenuItem onClick={() => onOpenSeries(current.id)}>
              <SquareArrowOutUpRight aria-hidden="true" />
              Open series
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSelect(null)}>
              <LogOut aria-hidden="true" />
              Leave series
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
