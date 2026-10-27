"use client";

import Link from "next/link";
import { WashiTag } from "@/components/signature/washi-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { projectHref, type DecisionItem, type WaitingItem } from "@/lib/memory/memory-screen";
import type { DecisionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Shared pieces of the Memory, Project and Standup pages. */

export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  agreed: "Agreed",
  proposed: "Proposed",
  yours: "Yours",
};

export function shortDate(day: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day.slice(0, 10)}T00:00:00Z`),
  );
}

/** One decision: status, title, why, date, source, tags and what it led to. */
export function DecisionCard({
  item,
  disabled,
  onMarkAgreed,
  showProject = true,
}: {
  item: DecisionItem;
  disabled: boolean;
  onMarkAgreed: () => void;
  showProject?: boolean;
}) {
  const { decision, replacedBy, project, links } = item;
  const replaced = replacedBy !== null;
  return (
    <article
      className={cn(
        "flex flex-col gap-1.5 rounded-xl bg-card px-4 py-3 shadow-[var(--rim)]",
        replaced && "opacity-75",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <Badge variant="secondary">{DECISION_STATUS_LABEL[decision.status]}</Badge>
        <h3
          className={cn(
            "min-w-0 flex-1 text-[0.9375rem] leading-[1.6] font-semibold break-words",
            replaced ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {decision.title}
        </h3>
        <span className="font-mono text-[0.8125rem] text-muted-foreground tabular-nums">
          {shortDate(decision.decidedOn ?? decision.createdAt)}
        </span>
      </div>
      {decision.why ? <p className="text-sm leading-[1.7] text-foreground/85">{decision.why}</p> : null}
      {replaced ? <p className="text-sm text-muted-foreground">You changed this: now “{replacedBy}”</p> : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted-foreground">
        {decision.tags.map((tag) => (
          <span key={tag} className="font-semibold">
            #{tag}
          </span>
        ))}
        {showProject && project ? (
          <Link href={projectHref(project.id)} className="font-semibold text-primary underline-offset-4 hover:underline">
            {project.name}
          </Link>
        ) : null}
        {links.length > 0 ? <span>→ {links.join(" · ")}</span> : null}
        {decision.source ? <span className="ml-auto">{decision.source}</span> : null}
      </div>
      {decision.status === "proposed" && !replaced ? (
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 pointer-coarse:h-11" disabled={disabled} onClick={onMarkAgreed}>
            Mark agreed
          </Button>
        </div>
      ) : null}
    </article>
  );
}

/** Who the user is waiting on, by person, with a "Resolved" button per item. */
export function WaitingList({
  groups,
  disabled,
  onResolve,
}: {
  groups: { who: string; items: WaitingItem[] }[];
  disabled: boolean;
  onResolve: (item: WaitingItem) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.who} className="flex flex-col gap-1.5">
          <h3 className="px-1 text-sm font-semibold text-muted-foreground">{group.who}</h3>
          <ul className="flex flex-col gap-1.5">
            {group.items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 rounded-xl bg-card px-3 py-2.5 shadow-[var(--rim)]">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] leading-[1.6] break-words text-foreground">{item.what}</p>
                  {item.daysWaiting > 0 ? (
                    <div className="mt-1">
                      <WashiTag ageDays={item.daysWaiting} />
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 pointer-coarse:h-11"
                  disabled={disabled}
                  aria-label={`Resolved: ${item.what}`}
                  onClick={() => onResolve(item)}
                >
                  Resolved
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
