import { WEEKDAYS, type LifeArea, type Repeat, type Weekday } from "@/lib/types";
import { weekdayOf } from "./dates";
import { cleanTags, newRecordBase, patchRecord, liveRecords } from "./records";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Weekdays in week order, ignoring anything that isn't one. */
export function cleanWeekdays(days: readonly string[] | undefined): Weekday[] {
  const wanted = new Set((days ?? []).map((day) => day.trim().toLowerCase().slice(0, 3)));
  return WEEKDAYS.filter((day) => wanted.has(day));
}

export function cleanTime(time: string | undefined): string {
  const trimmed = time?.trim() ?? "";
  const padded = /^\d:\d\d$/.test(trimmed) ? `0${trimmed}` : trimmed;
  return TIME_PATTERN.test(padded) ? padded : "";
}

export type RepeatInput = {
  title: string;
  days: string[];
  time?: string;
  area?: LifeArea | null;
  projectId?: string | null;
  whyDecisionId?: string | null;
  tags?: string[];
};

/** A new active repeat, or null without a title or any valid weekday. */
export function createRepeat(input: RepeatInput, now = new Date()): Repeat | null {
  const title = input.title.trim();
  const days = cleanWeekdays(input.days);
  if (!title || days.length === 0) return null;
  return {
    ...newRecordBase("repeat", input.tags, now),
    title,
    area: input.area ?? null,
    days,
    time: cleanTime(input.time),
    projectId: input.projectId ?? null,
    whyDecisionId: input.whyDecisionId ?? null,
    active: true,
  };
}

export function updateRepeat(
  repeats: Record<string, Repeat>,
  repeatId: string,
  updates: Partial<Omit<RepeatInput, "days">> & { days?: string[]; active?: boolean },
  now = new Date(),
): Record<string, Repeat> {
  const days = updates.days ? cleanWeekdays(updates.days) : undefined;
  return patchRecord(
    repeats,
    repeatId,
    {
      ...updates,
      title: updates.title?.trim() || undefined,
      days: days && days.length > 0 ? days : undefined,
      time: updates.time === undefined ? undefined : cleanTime(updates.time),
      tags: updates.tags ? cleanTags(updates.tags) : undefined,
    },
    now,
  );
}

/** Active repeats due on a day, earliest time first ("any time" last). */
export function repeatsForDate(repeats: Record<string, Repeat>, day: string): Repeat[] {
  const weekday = weekdayOf(day);
  return liveRecords(repeats)
    .filter((repeat) => repeat.active && repeat.days.includes(weekday))
    .toSorted((left, right) => (left.time || "99").localeCompare(right.time || "99"));
}
