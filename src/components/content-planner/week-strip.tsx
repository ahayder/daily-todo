"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNextStep, getShootIntent, getStageForColumn, isShootStage, WEEKLY_SHIP_GOAL } from "@/lib/content-conveyor";
import type { ContentCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { STAGE_LABELS } from "./stage-labels";

type WeekStripProps = {
  shippedThisWeek: number;
  nextUpCard: ContentCard | null;
  onSelectCard: (cardId: string) => void;
  onAdvanceCard: (cardId: string) => void;
};

function shippedMessage(count: number) {
  if (count === 0) return `0 of ${WEEKLY_SHIP_GOAL} shipped — the week is wide open`;
  if (count < WEEKLY_SHIP_GOAL) return `${count} of ${WEEKLY_SHIP_GOAL} shipped`;
  if (count === WEEKLY_SHIP_GOAL) return "Week goal met — anything more is a bonus";
  return `${count} shipped — bonus week`;
}

/**
 * "This week" strip: a kind weekly ship meter (no streaks) plus the one card to
 * work on next with its single next step. The pick is a default, not a choice
 * the user has to make.
 */
export function WeekStrip({ shippedThisWeek, nextUpCard, onSelectCard, onAdvanceCard }: WeekStripProps) {
  const dots = Math.max(WEEKLY_SHIP_GOAL + 1, shippedThisWeek);
  const nextStep = nextUpCard ? getNextStep(nextUpCard.columnId) : null;
  const stage = nextUpCard ? getStageForColumn(nextUpCard.columnId) : null;
  const intent = nextUpCard && isShootStage(stage) ? getShootIntent(nextUpCard.notes) : "";

  return (
    <section
      aria-label="This week"
      className="flex flex-col gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--rim)] sm:flex-row sm:items-center sm:gap-6"
    >
      <div className="flex shrink-0 flex-col gap-1">
        <p className="text-[0.8125rem] font-semibold text-muted-foreground">This week</p>
        <div className="flex items-center gap-2.5">
          <ol aria-hidden="true" className="flex items-center gap-1.5">
            {Array.from({ length: dots }, (_, index) => {
              const filled = index < shippedThisWeek;
              const bonus = index >= WEEKLY_SHIP_GOAL;
              return (
                <li
                  key={index}
                  className={cn(
                    "size-3 rounded-full transition-colors",
                    filled ? "bg-primary" : bonus ? "border border-dashed border-input" : "border border-input",
                  )}
                />
              );
            })}
          </ol>
          <p className="text-sm text-foreground" aria-live="polite">
            {shippedMessage(shippedThisWeek)}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 border-border sm:border-l sm:pl-6">
        {nextUpCard && nextStep && stage ? (
          <>
            <button
              type="button"
              onClick={() => onSelectCard(nextUpCard.id)}
              className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="block text-[0.8125rem] text-muted-foreground">
                Next up · {STAGE_LABELS[stage]}
              </span>
              <span className="block truncate font-heading text-[0.9375rem] font-semibold leading-snug text-foreground">
                {nextUpCard.title}
              </span>
              {intent ? (
                <span className="line-clamp-2 text-[0.875rem] leading-[1.7] text-muted-foreground">{intent}</span>
              ) : null}
            </button>
            <Button
              variant="soft"
              className="pointer-coarse:h-11 pointer-coarse:px-4"
              onClick={() => onAdvanceCard(nextUpCard.id)}
            >
              {nextStep.label}
              <ArrowRight aria-hidden="true" />
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing in progress. When an idea feels ready, press <span className="text-foreground">Develop this</span> on it.
          </p>
        )}
      </div>
    </section>
  );
}
