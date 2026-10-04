import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type NowCardProps = {
  /** What this minute is for. */
  title: ReactNode;
  /** e.g. "14:00–15:30" or "Focus · 25 min". */
  meta?: ReactNode;
  /** 0–1 share of the block/timer already used; drives the ring. */
  progress: number;
  /** Center of the ring, e.g. "38m" — short, DM Mono. */
  remainingLabel: string;
  /** Screen-reader sentence, e.g. "38 minutes left". */
  remainingDescription: string;
  /** "Next: Lunch at 15:30". */
  next?: ReactNode;
  /** Up to two actions (Pause / Done). */
  actions?: ReactNode;
  /** `block`: planner NOW; `task`: focus timer; `mini`: compact chip-like row. */
  variant?: "block" | "task" | "mini";
  className?: string;
};

const RING = 2 * Math.PI * 22;

/**
 * The signature "what is this minute for" card: deep lilac block where only the ring glows.
 * Off-plan / overtime is silent — never a warning color.
 */
export function NowCard({
  title,
  meta,
  progress,
  remainingLabel,
  remainingDescription,
  next,
  actions,
  variant = "block",
  className,
}: NowCardProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const mini = variant === "mini";

  return (
    <section
      aria-label="Now"
      className={cn(
        "grid items-center rounded-xl bg-now text-now-foreground shadow-card ring-1 ring-now-bar/35",
        mini ? "grid-cols-[40px_minmax(0,1fr)] gap-3 px-3 py-2" : "grid-cols-[60px_minmax(0,1fr)] gap-4 px-4.5 py-4",
        className,
      )}
    >
      <div className={cn("relative", mini ? "size-10" : "size-15")}>
        <svg viewBox="0 0 52 52" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="26" cy="26" r="22" fill="none" strokeWidth="5" className="stroke-now-foreground/15" />
          <circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * clamped}
            className="stroke-now-bar transition-[stroke-dashoffset] duration-[1000ms] ease-linear motion-reduce:transition-none"
          />
        </svg>
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 grid place-items-center font-mono font-medium tabular-nums",
            mini ? "text-[0.8125rem]" : "text-sm",
          )}
        >
          {remainingLabel}
        </span>
        <span className="sr-only">{remainingDescription}</span>
      </div>

      <div className="min-w-0">
        {!mini ? (
          <p className="mb-0.5 inline-flex rounded-full bg-now-bar/20 px-2 font-heading text-[0.8125rem] font-bold">Now</p>
        ) : null}
        <p className={cn("font-heading font-semibold", mini ? "truncate text-sm leading-snug" : "text-lg leading-tight")}>{title}</p>
        {meta ? <p className="font-mono text-[0.8125rem] text-now-muted tabular-nums">{meta}</p> : null}
        {next && !mini ? <p className="mt-1 text-sm text-now-muted">{next}</p> : null}
        {actions && !mini ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
