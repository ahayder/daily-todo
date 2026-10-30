"use client";

import { Brain, Clapperboard, FileText, Sun } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore, type Dispatch } from "react";
import type { AppAction } from "@/components/app/app-context";
import { MAIN_NAV } from "@/components/workspace/main-nav";
import type { ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS = { today: Sun, notes: FileText, memory: Brain, content: Clapperboard } as const;

const tabClass =
  "group flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.75rem] font-semibold outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring [&_svg]:size-5";
// The active tab gets a filled pill behind its icon, so it isn't shown by color alone.
const iconClass = "flex h-7 w-12 items-center justify-center rounded-full group-aria-[current=page]:bg-primary/20";
const tabActiveClass = "text-primary";
const tabIdleClass = "text-muted-foreground hover:text-foreground";

type Props = {
  view: ViewMode;
  dispatch: Dispatch<AppAction>;
};

/** Main nav below 768px, at the bottom of the shell. Wider screens use the top pills instead. */
export function MobileTabBar({ view, dispatch }: Props) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // Before mount the synced view isn't known yet, so Today (the home) is highlighted.
  const activeView = mounted ? view : "today";

  return (
    <nav
      aria-label="Main navigation"
      className="shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {MAIN_NAV.map((item) => {
          const Icon = ICONS[item.key];
          const isActive = item.isActive(activeView);
          return (
            <li key={item.key} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(tabClass, isActive ? tabActiveClass : tabIdleClass)}
                onClick={() => dispatch({ type: "set-view", view: item.view })}
              >
                <span className={iconClass}>
                  <Icon aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
