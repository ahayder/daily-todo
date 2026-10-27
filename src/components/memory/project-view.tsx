"use client";

import { ArrowLeft, FolderSearch } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/app/app-context";
import { EmptyState } from "@/components/blocks/empty-state";
import { WashiTag } from "@/components/signature/washi-tag";
import { DoTodayMenu } from "@/components/today/do-today-menu";
import { SectionTitle } from "@/components/today/section-title";
import { LifeAreaChip, TaskRow } from "@/components/today/task-row";
import { useFocusSoon } from "@/components/today/use-focus-soon";
import { useHistoryActions } from "@/components/today/use-history-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_TIME_ZONE, todayIn } from "@/lib/memory/dates";
import { nextStepTask, projectView } from "@/lib/memory/memory-screen";
import { getTodayView } from "@/lib/memory/tasks";
import { minutesInZone, selectedPlannerPreset, timeToMinutes } from "@/lib/memory/today-screen";
import type { Project, Task } from "@/lib/types";
import { DecisionCard, shortDate, WaitingList } from "./memory-parts";

const TIME_ZONE = DEFAULT_TIME_ZONE;

const STATUS_WORDS: Record<Project["status"], string> = { active: "Active", paused: "Paused", done: "Done" };

function EditStanding({
  project,
  onSave,
  onCancel,
}: {
  project: Project;
  onSave: (updates: { state: string; nextStep: string }) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState(project.state);
  const [nextStep, setNextStep] = useState(project.nextStep);
  const dirty = state !== project.state || nextStep !== project.nextStep;
  const save = () => onSave({ state: state.trim(), nextStep: nextStep.trim() });
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          save();
        } else if (event.key === "Escape" && !dirty) {
          // Esc only closes an untouched form; typed text is never thrown away silently.
          onCancel();
        }
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="project-state" className="text-[0.8125rem] font-semibold text-muted-foreground">
          Where it stands
        </label>
        <Textarea id="project-state" autoFocus value={state} onChange={(event) => setState(event.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="project-next" className="text-[0.8125rem] font-semibold text-muted-foreground">
          Next small step
        </label>
        <Input id="project-next" value={nextStep} onChange={(event) => setNextStep(event.target.value)} />
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">⌘/Ctrl+Enter saves.{dirty ? " Cancel throws away your changes." : ""}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="pointer-coarse:h-11" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="pointer-coarse:h-11">
          Save
        </Button>
      </div>
    </form>
  );
}

function ProjectPage({ projectId }: { projectId: string }) {
  const { state, sync } = useAppState();
  const { act, isReadOnly } = useHistoryActions();
  const [editing, setEditing] = useState(false);
  const focusSoon = useFocusSoon();
  const standingRef = useRef<HTMLHeadingElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const tasksRef = useRef<HTMLHeadingElement>(null);
  const decisionsRef = useRef<HTMLHeadingElement>(null);
  const waitingRef = useRef<HTMLHeadingElement>(null);
  const now = new Date();
  const today = todayIn(TIME_ZONE, now);
  const minutes = minutesInZone(now, TIME_ZONE);
  const preset = selectedPlannerPreset(state);
  const view = useMemo(
    () => projectView({ memory: state.memory, changeLog: state.changeLog, preset, projectId, today }),
    [preset, projectId, state.changeLog, state.memory, today],
  );
  const blocks = useMemo(
    () =>
      getTodayView({ tasks: state.memory.task, repeats: state.memory.repeat, preset, date: today }).blocks.filter(
        (block) => timeToMinutes(block.end) > minutes,
      ),
    [minutes, preset, state.memory.repeat, state.memory.task, today],
  );

  if (!view && sync.indicator === "loading") {
    return (
      <p role="status" className="mx-auto w-full max-w-6xl px-6 pt-6 text-sm text-muted-foreground">
        Loading the project…
      </p>
    );
  }

  if (!view) {
    return (
      <EmptyState
        icon={<FolderSearch />}
        title="This project isn’t here."
        description="It may not have synced to this device yet, or the link is old."
        action={
          <Link href="/memory" className={buttonVariants({ variant: "soft", size: "sm" })}>
                  Back to Memory
                </Link>
        }
      />
    );
  }

  const { project } = view;
  const stepTask = nextStepTask(view);
  const toggle = (task: Task) =>
    task.status === "done"
      ? act({ type: "memory-reopen-task", taskId: task.id }, `Reopened “${task.title}”`)
      : act({ type: "memory-complete-task", taskId: task.id }, `Finished “${task.title}”`);
  const doToday = (task: Task, blockId: string | null) => {
    act({ type: "memory-schedule-task", taskId: task.id, day: today, blockId }, `Planned “${task.title}” for today`);
    focusSoon(tasksRef);
  };
  const doStepToday = () => {
    focusSoon(standingRef);
    if (stepTask) {
      act({ type: "memory-schedule-task", taskId: stepTask.id, day: today, blockId: null }, `Planned “${stepTask.title}” for today`);
      return;
    }
    act(
      { type: "memory-add-task", title: project.nextStep, day: today, projectId: project.id, area: project.area },
      `Put “${project.nextStep}” on Today`,
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-4 pb-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/memory"
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Memory
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-xl leading-tight font-bold break-words text-foreground sm:text-2xl">{project.name}</h1>
          <LifeAreaChip area={project.area} />
          {project.status !== "active" ? (
            <span className="text-sm text-muted-foreground">· {STATUS_WORDS[project.status]}</span>
          ) : null}
        </div>
      </div>

      <section aria-label="Where it stands" className="flex flex-col gap-2 rounded-2xl bg-card px-5 py-4 shadow-[var(--rim)]">
        {editing ? (
          <EditStanding
            project={project}
            onCancel={() => {
              setEditing(false);
              focusSoon(editRef);
            }}
            onSave={(updates) => {
              act({ type: "memory-update-project", projectId: project.id, updates }, `Updated “${project.name}”`);
              setEditing(false);
              focusSoon(editRef);
            }}
          />
        ) : (
          <>
            <h2
              ref={standingRef}
              tabIndex={-1}
              className="w-fit rounded-md text-[0.8125rem] font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Where it stands now
            </h2>
            <p className="font-heading text-lg leading-snug font-semibold break-words text-foreground">
              {project.state || "Not written yet — tell your AI, or add it here."}
            </p>
            {project.nextStep ? (
              <p className="text-[0.9375rem] leading-[1.7] break-words text-foreground/85">Next small step: {project.nextStep}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {project.nextStep ? (
                stepTask?.onToday ? (
                  <Link href="/today" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                    {stepTask.where} →
                  </Link>
                ) : (
                  <Button className="pointer-coarse:h-11" disabled={isReadOnly} onClick={doStepToday}>
                    Do today
                  </Button>
                )
              ) : null}
              <Button
                ref={editRef}
                variant="ghost"
                size="sm"
                className="pointer-coarse:h-11"
                disabled={isReadOnly}
                onClick={() => setEditing(true)}
              >
                Edit where it stands
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="pointer-coarse:h-11"
                disabled={isReadOnly}
                onClick={() =>
                  act(
                    {
                      type: "memory-update-project",
                      projectId: project.id,
                      updates: { status: project.status === "active" ? "paused" : "active" },
                    },
                    project.status === "active" ? `Paused “${project.name}”` : `Picked up “${project.name}” again`,
                  )
                }
              >
                {project.status === "active" ? "Pause project" : "Make active again"}
              </Button>
              {project.area === "job" ? (
                <Link href="/standup" className="ml-auto text-sm font-semibold text-primary underline-offset-4 hover:underline">
                  Today’s standup agenda →
                </Link>
              ) : null}
            </div>
          </>
        )}
      </section>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        <section aria-label="Tasks" className="flex flex-col gap-3">
          <SectionTitle hint="open first, then done" headingRef={tasksRef}>
            Tasks
          </SectionTitle>
          {view.open.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">No open tasks for this project.</p>
          ) : (
            <div className="flex flex-col">
              {view.open.map((task) => (
                <TaskRow
                  key={task.id}
                  title={task.title}
                  done={false}
                  area={null}
                  source={task.source}
                  disabled={isReadOnly}
                  onToggle={() => toggle(task)}
                  meta={
                    <>
                      <span>{task.where}</span>
                      {task.daysWaiting > 0 ? <WashiTag ageDays={task.daysWaiting} /> : null}
                    </>
                  }
                  action={
                    task.onToday ? undefined : (
                      <DoTodayMenu
                        title={task.title}
                        blocks={blocks}
                        disabled={isReadOnly}
                        onPick={(blockId) => doToday(task, blockId)}
                      />
                    )
                  }
                />
              ))}
            </div>
          )}
          {view.done.length > 0 ? (
            <details className="px-2">
              <summary className="cursor-pointer rounded-md text-sm font-semibold text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-ring">
                Done ({view.done.length})
              </summary>
              <div className="mt-1 flex flex-col">
                {view.done.map((task) => (
                  <TaskRow
                    key={task.id}
                    title={task.title}
                    done
                    area={null}
                    disabled={isReadOnly}
                    onToggle={() => toggle(task)}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <aside className="flex flex-col gap-6">
          <section aria-label="Decisions" className="flex flex-col gap-2">
            <SectionTitle headingRef={decisionsRef}>Decisions</SectionTitle>
            {view.decisions.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">No decisions yet.</p>
            ) : (
              view.decisions.map((item) => (
                <DecisionCard
                  key={item.decision.id}
                  item={item}
                  showProject={false}
                  disabled={isReadOnly}
                  onMarkAgreed={() => {
                    act(
                      { type: "memory-set-decision-status", decisionId: item.decision.id, status: "agreed" },
                      `Marked “${item.decision.title}” agreed`,
                    );
                    focusSoon(decisionsRef);
                  }}
                />
              ))
            )}
          </section>

          {view.waiting.length > 0 ? (
            <section aria-label="Waiting on others" className="flex flex-col gap-2">
              <SectionTitle headingRef={waitingRef}>Waiting on others</SectionTitle>
              <WaitingList
                groups={view.waiting}
                disabled={isReadOnly}
                onResolve={(item) => {
                  act({ type: "memory-resolve-follow-up", followUpId: item.id }, `Resolved “${item.what}”`);
                  focusSoon(waitingRef);
                }}
              />
            </section>
          ) : null}

          {view.meetings.length > 0 ? (
            <section aria-label="Meetings" className="flex flex-col gap-2">
              <SectionTitle>Meetings</SectionTitle>
              <ul className="flex flex-col gap-1.5">
                {view.meetings.map((meeting) => (
                  <li key={meeting.id}>
                    <details className="rounded-xl bg-card px-4 py-2.5 shadow-[var(--rim)]">
                      <summary className="cursor-pointer rounded-md outline-none focus-visible:outline-2 focus-visible:outline-ring">
                        <span className="font-semibold text-foreground">{meeting.title}</span>
                        <span className="ml-2 text-[0.8125rem] text-muted-foreground">
                          {meeting.date ? shortDate(meeting.date) : ""}
                          {meeting.people.length ? ` · ${meeting.people.join(", ")}` : ""}
                        </span>
                      </summary>
                      <p className="mt-2 text-sm leading-[1.7] break-words whitespace-pre-wrap text-foreground/85">
                        {meeting.summary || "No summary saved."}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-label="Timeline" className="flex flex-col gap-2">
            <SectionTitle hint="from History">Timeline</SectionTitle>
            {view.timeline.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">No changes yet.</p>
            ) : (
              <ol className="flex flex-col gap-1 px-2">
                {view.timeline.map((item) => (
                  <li key={item.id} className="flex gap-3 text-sm">
                    <span className="w-16 shrink-0 font-mono text-[0.8125rem] text-muted-foreground tabular-nums">
                      {shortDate(item.at).replace(/^\w+ /, "")}
                    </span>
                    <span className="min-w-0 break-words text-foreground/85">
                      {item.text} <span className="text-muted-foreground">· {item.who}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function ProjectFromQuery() {
  const projectId = useSearchParams().get("id") ?? "";
  return <ProjectPage key={projectId} projectId={projectId} />;
}

export function ProjectView() {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      {/* useSearchParams needs a Suspense boundary in the static desktop build. */}
      <Suspense fallback={null}>
        <ProjectFromQuery />
      </Suspense>
    </div>
  );
}
