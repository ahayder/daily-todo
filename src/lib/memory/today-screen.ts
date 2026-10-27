import type { AppState, PlannerPreset } from "@/lib/types";
import type { HistoryDay, HistoryRow } from "./history-view";
import type { TodayBlock, TodayView } from "./tasks";

/** Pure helpers for the Today screen. */

/** The Daily Planner week the user picked, else the newest (same rule as the MCP server). */
export function selectedPlannerPreset(state: Pick<AppState, "plannerPresets" | "uiState">): PlannerPreset | null {
  const selected = state.uiState.selectedPlannerPresetId;
  if (selected && state.plannerPresets[selected]) return state.plannerPresets[selected];
  return (
    Object.values(state.plannerPresets).toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ??
    null
  );
}

/** Minutes since midnight in a time zone. */
export function minutesInZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(now)
    .reduce<Record<string, string>>((all, part) => ({ ...all, [part.type]: part.value }), {});
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export type NowState = {
  block: TodayBlock;
  /** The first open task in the block; null = "Free — your call". */
  task: TodayBlock["tasks"][number] | null;
  minutesLeft: number;
  /** 0–1 of the block already used. */
  progress: number;
  next: TodayBlock | null;
};

/** The block happening right now, if any. */
export function getNow(view: TodayView, minutes: number): NowState | null {
  const index = view.blocks.findIndex(
    (block) => timeToMinutes(block.start) <= minutes && minutes < timeToMinutes(block.end),
  );
  if (index === -1) return null;
  const block = view.blocks[index];
  const start = timeToMinutes(block.start);
  const end = timeToMinutes(block.end);
  return {
    block,
    task: block.tasks.find((task) => task.status === "open") ?? null,
    minutesLeft: end - minutes,
    progress: end > start ? (minutes - start) / (end - start) : 1,
    next: view.blocks[index + 1] ?? null,
  };
}

/** "38m", "1h", "1h45" — short, for the Now ring. */
export function shortDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

/** Today's changes made by AI chats (not by the user), newest first, still in effect. */
export function aiChangesToday(history: HistoryDay[], today: string): HistoryRow[] {
  return (history.find((day) => day.day === today)?.rows ?? []).filter(
    (row) => row.who !== "You" && row.status === "live",
  );
}
