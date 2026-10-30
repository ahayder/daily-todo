import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AreaTab = { href: string; label: ReactNode; active: boolean };

type AreaTabsProps = {
  /** Accessible name for the row, e.g. "Today". */
  label: string;
  tabs: AreaTab[];
  className?: string;
};

/** Page-level links between the screens of one nav area (Now / Journal / Standup / History). Each tab is a real route. */
export function AreaTabs({ label, tabs, className }: AreaTabsProps) {
  return (
    <nav aria-label={label} className={cn("flex", className)}>
      <ul className="inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-[color,background-color,box-shadow] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring pointer-coarse:h-11",
                tab.active
                  ? "bg-card text-foreground shadow-card ring-1 ring-primary/50"
                  : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
