import type { PlannerEvent, PlannerPurpose } from "@/lib/types";

export const MINUTES_PER_DAY = 24 * 60;
export const PLANNER_SNAP_MINUTES = 15;

export type PlannerEventLane = {
  event: PlannerEvent;
  lane: number;
};

export type PlannerAllocationSegment = {
  purpose: PlannerPurpose;
  startMinutes: number;
  endMinutes: number;
};

export function clampPlannerMinute(value: number, maximum = MINUTES_PER_DAY): number {
  return Math.min(maximum, Math.max(0, Math.round(value)));
}

export function snapPlannerMinute(value: number): number {
  return clampPlannerMinute(
    Math.round(value / PLANNER_SNAP_MINUTES) * PLANNER_SNAP_MINUTES,
  );
}

export function getPlannerEventDuration(event: Pick<PlannerEvent, "startMinutes" | "endMinutes">) {
  return Math.max(0, event.endMinutes - event.startMinutes);
}

export function getPlannerPurposeScheduledMinutes(
  events: PlannerEvent[],
  purposeId: string,
): number {
  return events.reduce(
    (total, event) =>
      event.purposeId === purposeId ? total + getPlannerEventDuration(event) : total,
    0,
  );
}

export function formatPlannerDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (!hours) return `${remainingMinutes}m`;
  if (!remainingMinutes) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatPlannerTime(minutes: number): string {
  const safeMinutes = Math.min(MINUTES_PER_DAY, Math.max(0, Math.round(minutes)));
  if (safeMinutes === MINUTES_PER_DAY) return "12:00 AM";
  const hours24 = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export function plannerMinutesToInputValue(minutes: number): string {
  const safeMinutes = Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round(minutes)));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function plannerInputValueToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return clampPlannerMinute(hours * 60 + minutes, MINUTES_PER_DAY - 1);
}

export function assignPlannerEventLanes(events: PlannerEvent[]): PlannerEventLane[] {
  const laneEndMinutes: number[] = [];
  return [...events]
    .sort(
      (left, right) =>
        left.startMinutes - right.startMinutes ||
        left.endMinutes - right.endMinutes ||
        left.id.localeCompare(right.id),
    )
    .map((event) => {
      let lane = laneEndMinutes.findIndex((endMinutes) => endMinutes <= event.startMinutes);
      if (lane === -1) lane = laneEndMinutes.length;
      laneEndMinutes[lane] = event.endMinutes;
      return { event, lane };
    });
}

export function buildPlannerAllocationSegments(
  purposes: PlannerPurpose[],
): PlannerAllocationSegment[] {
  const primaryPurposes = purposes.filter(
    (purpose) => purpose.role === "primary" && purpose.targetMinutes > 0,
  );
  const totalMinutes = primaryPurposes.reduce(
    (total, purpose) => total + purpose.targetMinutes,
    0,
  );
  const displayTotal = Math.max(MINUTES_PER_DAY, totalMinutes);
  let cursor = 0;

  return primaryPurposes.map((purpose) => {
    const displayMinutes = (purpose.targetMinutes / displayTotal) * MINUTES_PER_DAY;
    const segment = {
      purpose,
      startMinutes: cursor,
      endMinutes: cursor + displayMinutes,
    };
    cursor += displayMinutes;
    return segment;
  });
}

export function getPlannerPoint(minutes: number, radius: number) {
  const angle = (minutes / MINUTES_PER_DAY) * Math.PI * 2 - Math.PI / 2;
  return {
    x: 300 + Math.cos(angle) * radius,
    y: 300 + Math.sin(angle) * radius,
  };
}

export function getPlannerArcPath(
  startMinutes: number,
  endMinutes: number,
  innerRadius: number,
  outerRadius: number,
): string {
  const duration = Math.max(1, Math.min(MINUTES_PER_DAY - 0.01, endMinutes - startMinutes));
  const safeEnd = startMinutes + duration;
  const outerStart = getPlannerPoint(startMinutes, outerRadius);
  const outerEnd = getPlannerPoint(safeEnd, outerRadius);
  const innerEnd = getPlannerPoint(safeEnd, innerRadius);
  const innerStart = getPlannerPoint(startMinutes, innerRadius);
  const largeArc = duration > MINUTES_PER_DAY / 2 ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function getDefaultPlannerSliceRange(events: PlannerEvent[]) {
  const latestEnd = events.reduce(
    (latest, event) => Math.max(latest, event.endMinutes),
    9 * 60,
  );
  const startMinutes = Math.min(latestEnd, MINUTES_PER_DAY - 60);
  return { startMinutes, endMinutes: startMinutes + 60 };
}
