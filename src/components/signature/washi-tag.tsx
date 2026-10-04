import { CornerDownRight } from "lucide-react";
import { getTaskAgeLabel } from "@/lib/task-attention";
import { cn } from "@/lib/utils";

type WashiTagProps = {
  /** Calendar days the task has been carried (from `getTaskAgeDays`). Renders nothing below 1. */
  ageDays: number;
  className?: string;
};

/**
 * Washi-tape margin note for carried-over tasks: "From yesterday" / "3 days waiting".
 * Grows in weight, never in color — carryover is never red. One per row, hidden when the task is done.
 */
export function WashiTag({ ageDays, className }: WashiTagProps) {
  const label = getTaskAgeLabel(ageDays);
  if (!label) return null;

  return (
    <span
      className={cn(
        "washi-tape inline-flex shrink-0 items-center gap-1 bg-washi px-2.5 py-px text-[0.8125rem] text-washi-foreground",
        ageDays >= 3 ? "font-bold" : "font-semibold",
        className,
      )}
    >
      <CornerDownRight aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}
