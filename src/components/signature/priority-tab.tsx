import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

const STICKER: Record<Priority, { symbol: string; className: string }> = {
  1: { symbol: "!!", className: "bg-p1 text-p1-on" },
  2: { symbol: "!", className: "bg-p2 text-p2-on" },
  3: { symbol: "~", className: "bg-p3 text-p3-on" },
};

/** Soft group background that pairs with a PriorityTab. */
export const PRIORITY_GROUP_SURFACE: Record<Priority, string> = {
  1: "bg-p1-soft",
  2: "bg-p2-soft",
  3: "bg-p3-soft",
};

type PriorityTabProps = {
  priority: Priority;
  /** The word from the active label set, e.g. "Must do". Never omit: color is never the only signal. */
  label: string;
  count?: number;
  className?: string;
};

/** Pastel sticker tab for a priority group header: symbol + word (+ count). */
export function PriorityTab({ priority, label, count, className }: PriorityTabProps) {
  const sticker = STICKER[priority];
  return (
    <span
      className={cn(
        "inline-flex h-7 w-fit items-center gap-1.5 rounded-full px-3 font-heading text-sm font-semibold",
        sticker.className,
        className,
      )}
    >
      <span aria-hidden="true" className="font-mono text-[0.8125rem]">
        {sticker.symbol}
      </span>
      {label}
      {count !== undefined ? <span className="font-mono text-[0.8125rem] tabular-nums opacity-80">{count}</span> : null}
    </span>
  );
}
