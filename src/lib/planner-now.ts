import type { PlannerDayKey, PlannerEvent } from "@/lib/types";

export const MINUTES_PER_DAY = 24 * 60;

/**
 * The redesigned planner only uses three day templates. Every weekday shares the
 * `monday` template, while Saturday and Sunday each keep their own. `tuesday`
 * through `friday` are intentionally never read or written by the new UI.
 */
export type PlannerTemplateKey = Extract<PlannerDayKey, "monday" | "saturday" | "sunday">;

export type PlannerTemplateTab = {
  key: PlannerTemplateKey;
  label: string;
};

export const PLANNER_TEMPLATE_TABS: PlannerTemplateTab[] = [
  { key: "monday", label: "Weekday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

/** Map a real calendar date to the ideal-day template that governs it. */
export function dayKeyForDate(date: Date): PlannerTemplateKey {
  const day = date.getDay();
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "monday";
}

/** Minutes elapsed since midnight for a given date, clamped to a single day. */
export function minutesOfDay(date: Date): number {
  return Math.min(MINUTES_PER_DAY, Math.max(0, date.getHours() * 60 + date.getMinutes()));
}

/** Events ordered as they occur through the day. */
export function sortEventsByStart(events: PlannerEvent[]): PlannerEvent[] {
  return [...events].sort(
    (a, b) =>
      a.startMinutes - b.startMinutes ||
      a.endMinutes - b.endMinutes ||
      a.id.localeCompare(b.id),
  );
}

/** The block covering `minutesNow` (start ≤ now < end), or null when in a gap. */
export function getCurrentBlock(
  events: PlannerEvent[],
  minutesNow: number,
): PlannerEvent | null {
  const ordered = sortEventsByStart(events);
  let current: PlannerEvent | null = null;
  for (const event of ordered) {
    if (event.startMinutes <= minutesNow && minutesNow < event.endMinutes) {
      current = event;
    }
  }
  return current;
}

/** The next block that starts strictly after `minutesNow`, or null if none remain. */
export function getNextBlock(
  events: PlannerEvent[],
  minutesNow: number,
): PlannerEvent | null {
  const ordered = sortEventsByStart(events);
  for (const event of ordered) {
    if (event.startMinutes > minutesNow) {
      return event;
    }
  }
  return null;
}

/** Whole minutes remaining in a block relative to now (never negative). */
export function minutesLeft(block: PlannerEvent, minutesNow: number): number {
  return Math.max(0, Math.round(block.endMinutes - minutesNow));
}

/** How far through a block we are, as a 0–1 fraction for a progress bar. */
export function progressFraction(block: PlannerEvent, minutesNow: number): number {
  const span = block.endMinutes - block.startMinutes;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (minutesNow - block.startMinutes) / span));
}
