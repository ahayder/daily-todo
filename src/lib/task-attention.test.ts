import { describe, expect, test } from "vitest";
import { getAttentionTodos, getTaskAgeDays, getTaskAgeLabel, needsTaskAttention } from "./task-attention";
import type { Todo } from "./types";

const task = (id: string, createdAt: string, extra: Partial<Todo> = {}): Todo => ({
  id, text: id, createdAt, status: "pending", priority: 1, estimatedMinutes: null, ...extra,
});

describe("task attention", () => {
  test("counts calendar boundaries rather than elapsed 24-hour periods", () => {
    expect(getTaskAgeDays(task("late", "2026-03-10T23:59:00"), "2026-03-11")).toBe(1);
    expect(getTaskAgeLabel(1)).toBe("From yesterday");
    expect(getTaskAgeLabel(3)).toBe("3 days waiting");
    expect(getTaskAgeLabel(0)).toBeNull();
  });
  test("ignores invalid dates, future tasks and completed tasks", () => {
    for (const todo of [task("invalid", "invalid"), task("future", "2026-03-12"), task("done", "2026-03-01", { status: "finished" })]) {
      expect(needsTaskAttention(todo, "2026-03-11")).toBe(false);
    }
  });
  test("retains parent context and sorts by the oldest task without mutating the list", () => {
    const todos = [task("yesterday", "2026-03-10"), task("parent", "2026-03-11"), task("child", "2026-03-01", { parentId: "parent" }), task("today", "2026-03-11")];
    expect(getAttentionTodos(todos, "2026-03-11").map(t => t.id)).toEqual(["parent", "child", "yesterday"]);
    expect(todos[0].id).toBe("yesterday");
  });
});
