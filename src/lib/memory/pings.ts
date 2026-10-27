import { weekdayOf } from "./dates";
import type { TodayView } from "./tasks";
import { timeToMinutes } from "./today-screen";

/**
 * Gentle desktop pings. Kind by design: weekdays only, inside work hours,
 * one ping per moment, and none while the app is in front (the Now card
 * already shows it). The caller remembers which ping ids were sent.
 */

export const PING_DAY_START = 8 * 60;
export const PING_DAY_END = 18 * 60;
export const STANDUP_TIME = "16:00";
export const STANDUP_HEADS_UP_MINUTES = 10;
/** A ping still fires if the app checks a little late (timers drift, laptop wakes). */
export const PING_GRACE_MINUTES = 3;

export type Ping = { id: string; title: string; body: string };

function isWorkday(day: string) {
  const weekday = weekdayOf(day);
  return weekday !== "sat" && weekday !== "sun";
}

const within = (minutes: number, at: number) => minutes >= at && minutes < at + PING_GRACE_MINUTES;

export function duePings(input: {
  view: TodayView;
  minutes: number;
  sent: ReadonlySet<string>;
  appFocused: boolean;
}): Ping[] {
  const { view, minutes } = input;
  if (input.appFocused || !isWorkday(view.date)) return [];
  if (minutes < PING_DAY_START || minutes >= PING_DAY_END) return [];

  const pings: Ping[] = [];
  for (const block of view.blocks) {
    const task = block.tasks.find((item) => item.status === "open");
    if (!task || !within(minutes, timeToMinutes(block.start))) continue;
    pings.push({
      id: `block:${view.date}:${block.id}`,
      title: `${block.title || "Next block"} starts now`,
      body: task.title,
    });
  }

  const standup = timeToMinutes(STANDUP_TIME) - STANDUP_HEADS_UP_MINUTES;
  if (within(minutes, standup)) {
    pings.push({
      id: `standup:${view.date}`,
      title: `Standup in ${STANDUP_HEADS_UP_MINUTES} min`,
      body: "Your agenda is ready in DailyTodo.",
    });
  }

  return pings.filter((ping) => !input.sent.has(ping.id));
}
