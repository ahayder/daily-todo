import { WEEKDAYS, type Weekday } from "@/lib/types";

/**
 * Day helpers for the external brain. "Today" is the user's day in their own
 * time zone (USER_TIMEZONE on the MCP server), not the server's.
 */

export const DEFAULT_TIME_ZONE = "Asia/Dhaka";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value: string): boolean {
  return DAY_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** The calendar day (YYYY-MM-DD) of a moment in a time zone. */
export function dayInZone(moment: Date | string, timeZone: string): string {
  const date = typeof moment === "string" ? new Date(moment) : moment;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function todayIn(timeZone: string, now = new Date()): string {
  return dayInZone(now, timeZone);
}

export function weekdayOf(day: string): Weekday {
  // getUTCDay: 0 = Sunday.
  return WEEKDAYS[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7];
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function minutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
