"use client";

import { isTauri } from "@tauri-apps/api/core";
import { Bell, BellOff, CalendarClock, MessageSquare, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/app/app-context";
import { EmptyState } from "@/components/blocks/empty-state";
import { InlineComposer } from "@/components/blocks/inline-composer";
import { PageHeader } from "@/components/blocks/page-header";
import { NowCard } from "@/components/signature/now-card";
import { WashiTag } from "@/components/signature/washi-tag";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { setPingsEnabled, usePingsEnabled } from "@/lib/ping-settings";
import { DEFAULT_TIME_ZONE, todayIn, weekdayOf } from "@/lib/memory/dates";
import { buildHistory } from "@/lib/memory/history-view";
import { getTodayView } from "@/lib/memory/tasks";
import {
  aiChangesToday,
  getNow,
  minutesInZone,
  selectedPlannerPreset,
  shortDuration,
  timeToMinutes,
} from "@/lib/memory/today-screen";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DoTodayMenu } from "./do-today-menu";
import { SectionTitle } from "./section-title";
import { TaskRow } from "./task-row";
import { useHistoryActions } from "./use-history-actions";

const TIME_ZONE = DEFAULT_TIME_ZONE;
const AI_SEEN_KEY = "dailytodo.today.aiSeenChangeId";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function readSeen(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(AI_SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function longDate(day: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

export function TodayView() {
  const { state, sync } = useAppState();
  const readOnly = sync.isReadOnly;
  const clock = useClock();
  const today = todayIn(TIME_ZONE, clock);
  const minutes = minutesInZone(clock, TIME_ZONE);
  const preset = selectedPlannerPreset(state);
  const view = useMemo(
    () => getTodayView({ tasks: state.memory.task, repeats: state.memory.repeat, preset, date: today }),
    [preset, state.memory.repeat, state.memory.task, today],
  );
  const now = getNow(view, minutes);
  const isWorkday = !["sat", "sun"].includes(weekdayOf(today));
  // Pings only exist in the desktop app.
  const [isDesktop] = useState(() => typeof window !== "undefined" && isTauri());
  const pingsEnabled = usePingsEnabled();
  const waiting = [...view.leftovers, ...view.shelf];
  const history = useMemo(() => buildHistory(state, TIME_ZONE), [state]);
  const { act, undo } = useHistoryActions();
  const nowRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLHeadingElement>(null);
  const dayRef = useRef<HTMLHeadingElement>(null);
  const aiRef = useRef<HTMLParagraphElement>(null);
  // Device-local: which AI changes were already looked at ("Looks good").
  const [seen, setSeen] = useState(readSeen);
  const aiRows = aiChangesToday(history, today).filter((row) => row.changeId > seen);

  // After an action removes the control that had focus, keep keyboard users in place.
  const focusSoon = (target: React.RefObject<HTMLElement | null>) =>
    window.requestAnimationFrame(() => (target.current ?? dayRef.current)?.focus());

  const toggle = (task: Task) =>
    task.status === "done"
      ? act({ type: "memory-reopen-task", taskId: task.id }, `Reopened “${task.title}”`)
      : act({ type: "memory-complete-task", taskId: task.id }, `Finished “${task.title}”`);
  const blockName = (blockId: string | null) =>
    view.blocks.find((block) => block.id === blockId)?.title || "today";
  const doToday = (task: Task, blockId: string | null) => {
    act(
      { type: "memory-schedule-task", taskId: task.id, day: today, blockId },
      blockId ? `Put “${task.title}” in ${blockName(blockId)}` : `Planned “${task.title}” for today`,
    );
    focusSoon(shelfRef);
  };
  const pickFromShelf = () => {
    shelfRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    shelfRef.current?.focus({ preventScroll: true });
  };
  const markSeen = () => {
    const newest = aiRows[0]?.changeId ?? seen;
    setSeen(newest);
    try {
      window.localStorage.setItem(AI_SEEN_KEY, newest);
    } catch {
      // Storage unavailable: hidden for this visit only.
    }
  };

  const taskRow = (task: Task, extra?: { meta?: React.ReactNode; action?: React.ReactNode }) => (
    <TaskRow
      key={task.id}
      title={task.title}
      done={task.status === "done"}
      area={task.area}
      source={task.source}
      meta={extra?.meta}
      action={extra?.action}
      disabled={readOnly}
      onToggle={() => toggle(task)}
    />
  );

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pt-4 pb-12 sm:px-6">
        <PageHeader
          title="Today"
          subtitle={`${longDate(today)} · your plan is a guide, not a rule`}
          actions={
            <>
              {isWorkday ? (
                <Button variant="ghost" size="sm" className="pointer-coarse:h-11" render={<Link href="/standup" />}>
                  Standup agenda
                </Button>
              ) : null}
              {isDesktop ? (
                <IconButton
                  label={pingsEnabled ? "Turn desktop pings off" : "Turn desktop pings on"}
                  aria-pressed={pingsEnabled}
                  icon={pingsEnabled ? <Bell /> : <BellOff />}
                  onClick={() => setPingsEnabled(!pingsEnabled)}
                />
              ) : null}
            </>
          }
        />

        {now ? (
          <div ref={nowRef} tabIndex={-1} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <NowCard
            title={now.task ? now.task.title : "Free — your call"}
            meta={`${now.block.title || "Time block"} · ${now.block.start}–${now.block.end}`}
            progress={now.progress}
            remainingLabel={shortDuration(now.minutesLeft)}
            remainingDescription={`${now.minutesLeft} minutes left in this block`}
            next={now.next ? `Next: ${now.next.title || "Time block"} at ${now.next.start}` : undefined}
            actions={
              now.task ? (
                <>
                  <Button
                    disabled={readOnly}
                    onClick={() => {
                      toggle(now.task!);
                      focusSoon(nowRef);
                    }}
                  >
                    Done
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-now-foreground hover:bg-now-foreground/10"
                    disabled={readOnly}
                    onClick={() => {
                      act(
                        { type: "memory-schedule-task", taskId: now.task!.id, day: null },
                        `Moved “${now.task!.title}” to the Shelf`,
                      );
                      focusSoon(nowRef);
                    }}
                  >
                    Not now
                  </Button>
                </>
              ) : waiting.length > 0 ? (
                <Button variant="ghost" className="text-now-foreground hover:bg-now-foreground/10" onClick={pickFromShelf}>
                  Pick from the Shelf
                </Button>
              ) : undefined
            }
          />
          </div>
        ) : null}

        {aiRows.length > 0 ? (
          <section aria-label="New from your AI chats" className="flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-[var(--rim)]">
            <p ref={aiRef} tabIndex={-1} className="flex items-center gap-2 rounded-lg px-2 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MessageSquare aria-hidden="true" className="size-4 text-muted-foreground" />
              {aiRows.length === 1 ? "1 new change from your AI chats" : `${aiRows.length} new changes from your AI chats`}
            </p>
            <ul className="flex flex-col">
              {aiRows.slice(0, 4).map((row) => (
                <li key={row.batchId} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                  <span className="w-11 shrink-0 font-mono text-[0.8125rem] text-muted-foreground tabular-nums">
                    {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(
                      new Date(row.at),
                    )}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-foreground">
                    <span className="text-muted-foreground">{row.who}:</span> {row.text}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="pointer-coarse:h-11"
                    disabled={readOnly}
                    aria-label={`Undo: ${row.text}`}
                    onClick={() => {
                      undo(row.changeId, row.text);
                      focusSoon(aiRef);
                    }}
                  >
                    Undo
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 px-2">
              <Link href="/history" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                See all changes
              </Link>
              <Button variant="ghost" size="sm" onClick={markSeen}>
                Looks good
              </Button>
            </div>
          </section>
        ) : null}

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          <section aria-label="Your day" className="flex flex-col gap-3">
            <SectionTitle hint="from your Daily Planner" headingRef={dayRef}>
              Your day
            </SectionTitle>
            {view.blocks.length === 0 ? (
              <EmptyState
                size="inline"
                icon={<CalendarClock />}
                title="No time blocks for today."
                description="Plan your blocks once in the Daily Planner and they show up here every day."
                action={
                  <Button variant="soft" size="sm" render={<Link href="/planner" />}>
                    Open the Daily Planner
                  </Button>
                }
              />
            ) : (
              <ol className="flex flex-col gap-1">
                {view.blocks.map((block) => {
                  const isNow = now?.block.id === block.id;
                  const isPast = timeToMinutes(block.end) <= minutes;
                  return (
                    <li
                      key={block.id}
                      aria-current={isNow ? "time" : undefined}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl px-2 py-1.5",
                        isNow ? "bg-brand-subtle ring-1 ring-primary/30" : "bg-transparent",
                      )}
                    >
                      <div className="flex items-baseline gap-3 px-2">
                        <span
                          className={cn(
                            "w-28 shrink-0 font-mono text-[0.8125rem] whitespace-nowrap tabular-nums",
                            isNow ? "text-brand-subtle-foreground" : "text-muted-foreground",
                          )}
                        >
                          {block.start}–{block.end}
                        </span>
                        <span className={cn("min-w-0 flex-1 font-semibold", isPast && !isNow ? "text-muted-foreground" : "text-foreground")}>
                          {block.title || "Time block"}
                        </span>
                        {isNow ? (
                          <span className="rounded-full bg-primary px-2 text-[0.8125rem] font-bold text-primary-foreground">Now</span>
                        ) : null}
                      </div>
                      {block.tasks.length > 0 ? (
                        <div className="flex flex-col sm:pl-31">{block.tasks.map((task) => taskRow(task))}</div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}

            {view.today.length > 0 || view.repeats.length > 0 ? (
              <div className="flex flex-col gap-1 pt-2">
                <SectionTitle hint="any time today">Also today</SectionTitle>
                {view.repeats.map((repeat) => (
                  <TaskRow
                    key={repeat.id}
                    title={repeat.title}
                    done={false}
                    area={repeat.area}
                    meta={<span>Repeats{repeat.time ? ` · ${repeat.time}` : ""}</span>}
                    disabled={readOnly}
                    onToggle={() =>
                      act(
                        { type: "memory-complete-repeat", repeatId: repeat.repeatId, day: today },
                        `Finished “${repeat.title}” for today`,
                      )
                    }
                  />
                ))}
                {view.today.map((task) =>
                  taskRow(task, task.repeatId ? { meta: <span>Repeat</span> } : undefined),
                )}
              </div>
            ) : null}
          </section>

          <aside aria-label="Shelf" className="flex flex-col gap-3 rounded-2xl bg-card p-3 shadow-[var(--rim)]">
            <SectionTitle hint="not today, unless you pick it" headingRef={shelfRef}>
              Shelf
            </SectionTitle>
            <InlineComposer
              placeholder="Add to the Shelf…"
              onSubmit={(title) => act({ type: "memory-add-task", title, day: null }, `Added “${title}” to the Shelf`)}
            />
            {waiting.length === 0 ? (
              <EmptyState size="inline" icon={<Sun />} title="The Shelf is clear." description="Things for some other day land here." />
            ) : (
              <div className="flex flex-col">
                {waiting.map((task) =>
                  taskRow(task, {
                    meta: "daysWaiting" in task ? <WashiTag ageDays={task.daysWaiting as number} /> : undefined,
                    action: (
                      <DoTodayMenu
                        title={task.title}
                        blocks={view.blocks.filter((block) => timeToMinutes(block.end) > minutes)}
                        disabled={readOnly}
                        onPick={(blockId) => doToday(task, blockId)}
                      />
                    ),
                  }),
                )}
              </div>
            )}
          </aside>
        </div>

        <p className="px-2 text-sm text-muted-foreground">
          Every change can be undone in{" "}
          <Link href="/history" className="font-semibold text-primary underline-offset-4 hover:underline">
            History
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
