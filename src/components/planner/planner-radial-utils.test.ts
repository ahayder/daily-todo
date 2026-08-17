import { describe, expect, test } from "vitest";
import {
  assignPlannerEventLanes,
  buildPlannerAllocationSegments,
  formatPlannerDuration,
  getPlannerArcPath,
  getPlannerPurposeScheduledMinutes,
  snapPlannerMinute,
} from "@/components/planner/planner-radial-utils";
import type { PlannerEvent, PlannerPurpose } from "@/lib/types";

const purpose: PlannerPurpose = {
  id: "purpose-office",
  title: "Office work",
  color: "teal",
  targetMinutes: 480,
  role: "primary",
  notes: "",
};

function event(id: string, startMinutes: number, endMinutes: number): PlannerEvent {
  return {
    id,
    purposeId: purpose.id,
    dayKey: "monday",
    title: purpose.title,
    color: purpose.color,
    notes: "",
    startMinutes,
    endMinutes,
  };
}

describe("planner radial utilities", () => {
  test("places overlapping slices in separate radial lanes and reuses free lanes", () => {
    const layouts = assignPlannerEventLanes([
      event("later", 780, 900),
      event("first", 540, 720),
      event("overlap", 600, 690),
    ]);

    expect(layouts.map(({ event: item, lane }) => [item.id, lane])).toEqual([
      ["first", 0],
      ["overlap", 1],
      ["later", 0],
    ]);
  });

  test("builds the allocation pie from primary purposes only", () => {
    const family: PlannerPurpose = {
      ...purpose,
      id: "purpose-family",
      title: "Family",
      targetMinutes: 240,
      color: "gold",
    };
    const learning: PlannerPurpose = {
      ...purpose,
      id: "purpose-learning",
      title: "Learning",
      targetMinutes: 120,
      role: "secondary",
      color: "lavender",
    };

    const segments = buildPlannerAllocationSegments([purpose, family, learning]);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ startMinutes: 0, endMinutes: 480 });
    expect(segments[1]).toMatchObject({ startMinutes: 480, endMinutes: 720 });
  });

  test("reports totals, snaps dragging, and creates a closed arc path", () => {
    const events = [event("morning", 540, 720), event("afternoon", 780, 1080)];

    expect(getPlannerPurposeScheduledMinutes(events, purpose.id)).toBe(480);
    expect(formatPlannerDuration(495)).toBe("8h 15m");
    expect(snapPlannerMinute(548)).toBe(555);
    expect(getPlannerArcPath(540, 720, 160, 210)).toMatch(/^M .+ Z$/);
  });
});
