import { describe, expect, it } from "vitest";
import { buildChange } from "@/lib/change-log";
import { createDecision } from "@/lib/memory/decisions";
import { createFollowUp } from "@/lib/memory/follow-ups";
import { createMeeting } from "@/lib/memory/meetings";
import { createProject } from "@/lib/memory/projects";
import { createRepeat } from "@/lib/memory/repeats";
import { createTask } from "@/lib/memory/tasks";
import type { MemoryKind, MemoryKindMap } from "@/lib/types";
import { changeToPayload, memoryRecordToPayload, rowToChange, rowToMemoryRecord } from "./memory-store";

const NOW = new Date("2026-10-27T05:00:00.000Z");

/** PocketBase returns dates with a space instead of "T". */
function asPocketBaseRow(payload: Record<string, unknown>) {
  const row: Record<string, unknown> = { id: "rec1" };
  for (const [key, value] of Object.entries(payload)) {
    row[key] = typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.replace("T", " ") : value;
  }
  return row as Record<string, unknown> & { id: string };
}

describe("memory store record mapping", () => {
  const samples: { [K in MemoryKind]: MemoryKindMap[K] } = {
    task: { ...createTask({ title: "T", day: "2026-10-27", blockId: "b", tags: ["x"] }, NOW)!, doneAt: NOW.toISOString() },
    decision: createDecision({ title: "D", people: ["Brian"], status: "agreed", decidedOn: "2026-10-27" }, NOW)!,
    project: createProject({ name: "P", area: "job", nextStep: "n" }, NOW)!,
    meeting: createMeeting({ title: "M", date: "2026-10-27", summary: "s", people: ["A"] }, NOW)!,
    follow_up: createFollowUp({ what: "W", who: "Brian", since: "2026-10-27" }, NOW)!,
    repeat: { ...createRepeat({ title: "R", days: ["mon"], time: "07:00" }, NOW)!, active: false },
  };

  for (const kind of Object.keys(samples) as MemoryKind[]) {
    it(`round-trips a ${kind} through PocketBase, with dates normalized`, () => {
      const record = samples[kind];
      const row = asPocketBaseRow(memoryRecordToPayload(kind, record, "user1"));
      expect(rowToMemoryRecord(kind, row)).toEqual(record);
    });
  }

  it("clears optional fields with empty values instead of omitting them", () => {
    const payload = memoryRecordToPayload("task", createTask({ title: "T" }, NOW)!, "user1");
    expect(payload).toMatchObject({ day: "", block_id: "", project_id: "", deleted_at: "", done_at: "", tags_json: [] });
  });

  it("round-trips a change log entry", () => {
    const entry = buildChange({ batchId: "b", entityKind: "task", entityId: "t", before: null, after: { title: "T" }, source: "chat", now: NOW });
    expect(rowToChange(asPocketBaseRow(changeToPayload(entry, "user1")))).toEqual(entry);
  });
});
