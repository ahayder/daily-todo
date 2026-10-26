import { describe, expect, it } from "vitest";
import {
  buildChange,
  canRedo,
  canUndo,
  changedFields,
  detectAction,
  makeChangeId,
  redoTarget,
  summarizeChange,
  undoTarget,
} from "./change-log";

const NOW = new Date("2026-10-27T05:00:00.000Z");
const task = (extra: Record<string, unknown> = {}) => ({
  id: "t1",
  title: "Send link",
  day: null,
  updatedAt: "2026-10-27T04:00:00.000Z",
  deletedAt: null,
  ...extra,
});

describe("change log", () => {
  it("detects the action from before and after", () => {
    expect(detectAction(null, task())).toBe("create");
    expect(detectAction(task(), task({ day: "2026-10-27" }))).toBe("update");
    expect(detectAction(task(), task({ deletedAt: "x" }))).toBe("delete");
    expect(detectAction(task({ deletedAt: "x" }), task())).toBe("restore");
  });

  it("summarizes in plain language, ignoring updatedAt", () => {
    expect(changedFields(task(), task({ day: "2026-10-27", updatedAt: "later" }))).toEqual(["day"]);
    expect(
      summarizeChange({ entityKind: "task", action: "update", before: task(), after: task({ day: "2026-10-27" }) }),
    ).toBe('Changed task "Send link": day');
    expect(summarizeChange({ entityKind: "follow_up", action: "create", before: null, after: { what: "Keys" } })).toBe(
      'Added follow-up "Keys"',
    );
  });

  it("makes ids that sort in creation order", () => {
    const ids = [makeChangeId(NOW), makeChangeId(NOW), makeChangeId(new Date(NOW.getTime() + 1))];
    expect(ids.toSorted()).toEqual(ids);
  });

  it("undoes an update back to before, and refuses after a newer edit", () => {
    const entry = buildChange({
      batchId: "b",
      entityKind: "task",
      entityId: "t1",
      before: task(),
      after: task({ day: "2026-10-27" }),
      source: "chat",
      now: NOW,
    });
    expect(canUndo(task({ day: "2026-10-27", updatedAt: "whatever" }), entry)).toEqual({ ok: true });
    expect(undoTarget(entry, NOW)).toMatchObject({ day: null, updatedAt: NOW.toISOString() });
    const conflict = canUndo(task({ day: "2026-10-28" }), entry);
    expect(conflict.ok).toBe(false);
  });

  it("undoes a create with a soft delete, but never for records without one", () => {
    const created = buildChange({ batchId: "b", entityKind: "task", entityId: "t1", before: null, after: task(), source: "chat" });
    expect(canUndo(task(), created)).toEqual({ ok: true });
    expect(undoTarget(created, NOW)).toMatchObject({ deletedAt: NOW.toISOString() });

    const card = { id: "c1", title: "Video", updatedAt: "x" };
    const cardCreate = buildChange({ batchId: "b", entityKind: "content_card", entityId: "c1", before: null, after: card, source: "chat" });
    expect(canUndo(card, cardCreate).ok).toBe(false);
  });

  it("redoes only while the record is as the undo left it", () => {
    const original = buildChange({
      batchId: "b",
      entityKind: "task",
      entityId: "t1",
      before: task(),
      after: task({ day: "2026-10-27" }),
      source: "chat",
    });
    const undoState = undoTarget(original, NOW);
    const undo = buildChange({
      batchId: "b2",
      entityKind: "task",
      entityId: "t1",
      before: original.after,
      after: undoState,
      source: "chat",
      action: "undo",
      refChangeId: original.id,
    });
    expect(canRedo(undoState, undo)).toEqual({ ok: true });
    expect(redoTarget(original, NOW)).toMatchObject({ day: "2026-10-27" });
    expect(canRedo(task({ day: "2026-11-01" }), undo).ok).toBe(false);
    expect(canUndo(undoState, undo).ok).toBe(false);
  });
});
