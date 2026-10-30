"use client";

import { useSyncExternalStore } from "react";
import { AreaTabs } from "@/components/blocks/area-tabs";
import { DEFAULT_TIME_ZONE, todayIn, weekdayOf } from "@/lib/memory/dates";
import type { ViewMode } from "@/lib/types";

export function isWorkday(isoDate: string) {
  return !["sat", "sun"].includes(weekdayOf(isoDate));
}

/** Tabs under the Today pill. Standup only shows Mon–Fri; /standup still works on weekends. */
export function TodayTabs({ view }: { view: ViewMode }) {
  // Pages are pre-rendered, so the weekday is only known after mount.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const showStandup = view === "standup" || (mounted && isWorkday(todayIn(DEFAULT_TIME_ZONE)));

  const tabs = [
    { href: "/today", label: "Now", active: view === "today" },
    { href: "/todos", label: "Journal", active: view === "todos" },
    ...(showStandup ? [{ href: "/standup", label: "Standup", active: view === "standup" }] : []),
    { href: "/history", label: "History", active: view === "history" },
  ];

  return <AreaTabs label="Today" tabs={tabs} />;
}
