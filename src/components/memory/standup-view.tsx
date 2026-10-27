"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppState } from "@/components/app/app-context";
import { DEFAULT_TIME_ZONE, todayIn } from "@/lib/memory/dates";
import { DECISION_STATUS_LABEL } from "@/components/memory/memory-parts";
import { projectHref } from "@/lib/memory/memory-screen";
import { STANDUP_TIME } from "@/lib/memory/pings";
import { buildStandupAgenda } from "@/lib/memory/standup";
import { cn } from "@/lib/utils";
import { shortDate } from "./memory-parts";

const TICKS_KEY = "dailytodo.standup.ticks";

type Item = { id: string; text: string; note?: string; href?: string };
type Section = { title: string; empty: string; items: Item[] };

/** Ticks are a meeting aid for this device and this day only, not data. */
function readTicks(date: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const saved = JSON.parse(window.localStorage.getItem(TICKS_KEY) ?? "{}") as { date?: string; ids?: string[] };
    return new Set(saved.date === date ? (saved.ids ?? []) : []);
  } catch {
    return new Set();
  }
}

function writeTicks(date: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(TICKS_KEY, JSON.stringify({ date, ids: [...ids] }));
  } catch {
    // Storage unavailable: ticks last for this visit only.
  }
}

export function StandupView() {
  const { state } = useAppState();
  const today = todayIn(DEFAULT_TIME_ZONE);
  const [ticks, setTicks] = useState(() => readTicks(today));
  const agenda = useMemo(
    () => buildStandupAgenda(today, state.memory, { timeZone: DEFAULT_TIME_ZONE, area: "job" }),
    [state.memory, today],
  );

  const sections: Section[] = [
    {
      title: "What I did",
      empty: `Nothing marked done since ${shortDate(agenda.since)}.`,
      items: [
        ...agenda.whatIDid.tasks.map((task) => ({ id: task.id, text: task.title, note: "Done" })),
        ...agenda.whatIDid.decisions.map((decision) => ({
          id: decision.id,
          text: decision.title,
          note: `Agreed${decision.source ? ` · ${decision.source}` : ""}`,
        })),
      ],
    },
    {
      title: "Today",
      empty: "No job tasks planned for today yet.",
      items: agenda.today.map((task) => ({
        id: task.id,
        text: task.title,
        note: task.day && task.day < today ? `From ${shortDate(task.day)}` : undefined,
      })),
    },
    {
      title: "Waiting on others",
      empty: "You’re not waiting on anyone.",
      items: agenda.waitingOnOthers.flatMap((group) =>
        group.items.map((item) => ({
          id: item.id,
          text: `${group.who}: ${item.what}`,
          note: item.since ? `Waiting since ${shortDate(item.since)}` : undefined,
        })),
      ),
    },
    {
      title: "Open proposals",
      empty: "No proposals waiting for an answer.",
      items: agenda.openProposals.map((decision) => ({
        id: decision.id,
        text: decision.title,
        note: `${DECISION_STATUS_LABEL[decision.status]}${decision.source ? ` · ${decision.source}` : ""}`,
      })),
    },
    {
      title: "Next",
      empty: "No next steps saved on your projects.",
      items: agenda.next.map((entry) => {
        const project = Object.values(state.memory.project).find((item) => item.name === entry.project);
        return {
          id: `next:${entry.project}`,
          text: `${entry.project}: ${entry.nextStep}`,
          href: project ? projectHref(project.id) : undefined,
        };
      }),
    },
  ];

  const toggle = (id: string) => {
    const next = new Set(ticks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTicks(next);
    writeTicks(today, next);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 pb-12 sm:px-6">
        <div className="flex flex-col gap-2">
          <Link
            href="/today"
            className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Today
          </Link>
          <h1 className="font-heading text-xl leading-tight font-bold text-foreground sm:text-2xl">
            Standup · {shortDate(today)}, {STANDUP_TIME}
          </h1>
          <p className="text-sm text-muted-foreground">
            Built from your job tasks, decisions and follow-ups since {shortDate(agenda.since)}. Tick things off as you talk.
          </p>
        </div>

        {sections.map((section) => (
          <section key={section.title} aria-labelledby={`standup-${section.title}`} className="flex flex-col gap-2">
            <h2 id={`standup-${section.title}`} className="px-1 font-heading text-lg font-semibold text-foreground">
              {section.title}
            </h2>
            {section.items.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">{section.empty}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {section.items.map((item) => {
                  const done = ticks.has(item.id);
                  return (
                    <li key={item.id} className="flex items-start gap-3 rounded-xl bg-card px-3 py-2.5 shadow-[var(--rim)]">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={done ? `Untick “${item.text}”` : `Tick “${item.text}” as talked about`}
                        onClick={() => toggle(item.id)}
                        className={cn(
                          "relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:size-7 pointer-coarse:after:absolute pointer-coarse:after:-inset-2",
                          done ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary",
                        )}
                      >
                        {done ? <Check aria-hidden="true" className="size-3.5" /> : null}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[0.9375rem] leading-[1.6] break-words",
                            done ? "text-muted-foreground line-through" : "font-semibold text-foreground",
                          )}
                        >
                          {item.href ? (
                            <Link href={item.href} className="underline-offset-4 hover:underline">
                              {item.text}
                            </Link>
                          ) : (
                            item.text
                          )}
                        </p>
                        {item.note ? <p className="text-[0.8125rem] text-muted-foreground">{item.note}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}

        <section className="flex flex-col gap-1 rounded-2xl border border-dashed border-input px-4 py-3.5">
          <p className="font-semibold text-foreground">After the meeting</p>
          <p className="text-sm leading-[1.7] text-foreground/85">
            Paste the transcript into Claude or ChatGPT and say “file today’s standup”. It saves the summary, decisions,
            tasks and follow-ups here, and you’ll see them on Today with Undo.
          </p>
        </section>
      </div>
    </div>
  );
}
