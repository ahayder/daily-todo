import type { ViewMode } from "@/lib/types";

/** Pages that fill the width and have no Todos/Notes sidebar (so no sidebar toggle either). */
const FULL_WIDTH_VIEWS: ViewMode[] = [
  "today",
  "history",
  "memory",
  "project",
  "standup",
  "planner",
  "content-planner",
];

export function isFullWidthView(view: ViewMode) {
  return FULL_WIDTH_VIEWS.includes(view);
}

/** Views that live under the Today area: Now, Journal (the daily pages), Standup, History. */
const TODAY_AREA_VIEWS: ViewMode[] = ["today", "todos", "standup", "history"];

export function isTodayAreaView(view: ViewMode) {
  return TODAY_AREA_VIEWS.includes(view);
}
