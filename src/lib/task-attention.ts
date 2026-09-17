import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Todo } from "./types";

/** Age on the displayed page, measured in local calendar days. */
export function getTaskAgeDays(todo: Todo, date: string): number {
  const age = differenceInCalendarDays(parseISO(date), parseISO(todo.createdAt));
  return Number.isFinite(age) ? Math.max(0, age) : 0;
}

export function needsTaskAttention(todo: Todo, date: string): boolean {
  return todo.status !== "finished" && getTaskAgeDays(todo, date) >= 1;
}

export function getTaskAgeLabel(age: number): string | null {
  return age < 1 ? null : age === 1 ? "From yesterday" : `${age} days waiting`;
}

/** Keep ancestors visible so an older subtask never loses its context. */
export function getAttentionTodos(todos: Todo[], date: string): Todo[] {
  const byId = new Map(todos.map((todo) => [todo.id, todo]));
  const ages = new Map<string, number>();
  for (const todo of todos) {
    if (!needsTaskAttention(todo, date)) continue;
    const age = getTaskAgeDays(todo, date);
    let current: Todo | undefined = todo;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      ages.set(current.id, Math.max(ages.get(current.id) ?? 0, age));
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return todos.filter((todo) => ages.has(todo.id)).sort(
    (a, b) => ages.get(b.id)! - ages.get(a.id)!,
  );
}
