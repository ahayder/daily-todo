"use client";

import { ArrowLeft, History } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAppState } from "@/components/app/app-context";
import { EmptyState } from "@/components/blocks/empty-state";
import { PageHeader } from "@/components/blocks/page-header";
import { Button } from "@/components/ui/button";
import { addDays, DEFAULT_TIME_ZONE, todayIn } from "@/lib/memory/dates";
import { buildHistory, type HistoryRow } from "@/lib/memory/history-view";
import { cn } from "@/lib/utils";
import { useHistoryActions } from "./use-history-actions";

const TIME_ZONE = DEFAULT_TIME_ZONE;

function dayLabel(day: string, today: string) {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

function timeOf(at: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(at));
}

function Row({
  row,
  disabled,
  onUndo,
  onRedo,
}: {
  row: HistoryRow;
  disabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const undone = row.status === "undone";
  return (
    <li className="flex items-start gap-3 rounded-xl bg-card px-3 py-2.5 shadow-[var(--rim)]">
      <span className="w-11 shrink-0 pt-0.5 font-mono text-[0.8125rem] text-muted-foreground tabular-nums">
        {timeOf(row.at)}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[0.9375rem] leading-[1.7] break-words", undone ? "text-muted-foreground line-through" : "font-semibold text-foreground")}>
          {row.text}
        </p>
        {row.more.length > 0 ? (
          <ul className={cn("mt-0.5 text-sm", undone ? "text-muted-foreground line-through" : "text-foreground")}>
            {row.more.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          {row.who}
          {undone ? " · undone" : ""}
          {row.where ? (
            <>
              {" · "}
              <Link href={row.where.href} className="font-semibold text-primary underline-offset-4 hover:underline">
                {row.where.label}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      {undone ? (
        <Button variant="ghost" size="sm" className="shrink-0 text-primary pointer-coarse:h-11" disabled={disabled} aria-label={`Bring back: ${row.text}`} onClick={onRedo}>
          Bring back
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="shrink-0 pointer-coarse:h-11" disabled={disabled} aria-label={row.count > 1 ? `Undo all ${row.count} changes: ${row.text}` : `Undo: ${row.text}`} onClick={onUndo}>
          {row.count > 1 ? `Undo all ${row.count}` : "Undo"}
        </Button>
      )}
    </li>
  );
}

export function HistoryView() {
  const { state } = useAppState();
  const today = todayIn(TIME_ZONE);
  const days = useMemo(() => buildHistory(state, TIME_ZONE), [state]);
  const { undo, redo, isReadOnly } = useHistoryActions();

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-4 pb-12 sm:px-6">
        <div className="flex flex-col gap-2">
          <Link
            href="/today"
            className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Today
          </Link>
          <PageHeader
            title="History"
            subtitle="Every change, by you and your AI chats. Undo hides a change — nothing is ever deleted, so you can bring it back."
          />
        </div>

        {days.length === 0 ? (
          <EmptyState
            icon={<History />}
            title="No changes yet."
            description="When you or an AI chat adds or changes something, it shows up here."
          />
        ) : (
          days.map((day) => (
            <section key={day.day} aria-labelledby={`history-${day.day}`} className="flex flex-col gap-2">
              <h2 id={`history-${day.day}`} className="px-1 font-heading text-lg font-semibold text-foreground">
                {dayLabel(day.day, today)}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {day.rows.map((row) => (
                  <Row
                    key={row.batchId}
                    row={row}
                    disabled={isReadOnly}
                    onUndo={() => undo(row.changeId, row.text)}
                    onRedo={() => redo(row.changeId, row.text)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
