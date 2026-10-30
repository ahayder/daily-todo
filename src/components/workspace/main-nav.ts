import type { ViewMode } from "@/lib/types";
import { isTodayAreaView } from "@/lib/views";

/** The main nav areas: Today · Notes · Memory · Content Planner. Shared by the top nav and the phone tab bar. */
export const MAIN_NAV = [
  {
    key: "today",
    label: "Today",
    href: "/today",
    view: "today",
    // The Daily Planner lives inside Today now ("Edit day plan"), so /planner keeps Today lit.
    isActive: (view: ViewMode) => isTodayAreaView(view) || view === "planner",
  },
  { key: "notes", label: "Notes", href: "/notes", view: "notes", isActive: (view: ViewMode) => view === "notes" },
  {
    key: "memory",
    label: "Memory",
    href: "/memory",
    view: "memory",
    isActive: (view: ViewMode) => view === "memory" || view === "project",
  },
  {
    key: "content",
    label: "Content Planner",
    href: "/content-planner",
    view: "content-planner",
    isActive: (view: ViewMode) => view === "content-planner",
  },
] as const satisfies readonly {
  key: string;
  label: string;
  href: string;
  view: ViewMode;
  isActive: (view: ViewMode) => boolean;
}[];
