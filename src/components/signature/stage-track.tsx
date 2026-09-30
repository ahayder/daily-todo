import { Fragment } from "react";
import type { ConveyorStage } from "@/lib/content-conveyor";
import { cn } from "@/lib/utils";

const STAGES: { id: ConveyorStage; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "develop", label: "Develop" },
  { id: "shoot-next", label: "Shoot next" },
  { id: "published", label: "Published" },
];

type StageTrackProps = {
  /** Stage id from `getStageForColumn` — never derived from editable column titles. */
  current: ConveyorStage | null;
  className?: string;
};

/** Content Conveyor breadcrumb: past = ink, current = stamped, future = dimmed. */
export function StageTrack({ current, className }: StageTrackProps) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === current);

  return (
    <ol aria-label="Content stage" className={cn("flex flex-wrap items-center gap-1.5 text-[0.8125rem]", className)}>
      {STAGES.map((stage, index) => {
        const state = index < currentIndex ? "past" : index === currentIndex ? "current" : "future";
        return (
          <Fragment key={stage.id}>
            {index > 0 ? (
              <li aria-hidden="true" className="text-muted-foreground">
                ›
              </li>
            ) : null}
            <li
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "rounded-full border px-2 py-0.5 font-semibold",
                state === "current" &&
                  "animate-stamp border-transparent bg-primary text-primary-foreground shadow-[2px_2px_0_var(--brand-subtle-foreground)] dark:shadow-[2px_2px_0_var(--brand-subtle)]",
                state === "past" && "border-input text-foreground",
                state === "future" && "border-dashed border-input text-muted-foreground",
              )}
            >
              {stage.label}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

type SoftCapBadgeProps = {
  count: number;
  cap: number;
  /** e.g. "cards in Shoot next". */
  noun: string;
  className?: string;
};

/** Gentle limit meter: tints past the cap, never blocks and never turns red. */
export function SoftCapBadge({ count, cap, noun, className }: SoftCapBadgeProps) {
  const over = count > cap;
  return (
    <span
      aria-label={`${count} of ${cap} ${noun}`}
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 font-mono text-[0.8125rem] tabular-nums transition-colors",
        over ? "bg-p2 text-p2-on" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {count}/{cap}
    </span>
  );
}
