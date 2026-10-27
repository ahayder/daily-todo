"use client";

import { Brain, Lightbulb, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useAppState } from "@/components/app/app-context";
import { EmptyState } from "@/components/blocks/empty-state";
import { PageHeader } from "@/components/blocks/page-header";
import { SectionTitle } from "@/components/today/section-title";
import { LifeAreaChip } from "@/components/today/task-row";
import { useFocusSoon } from "@/components/today/use-focus-soon";
import { useHistoryActions } from "@/components/today/use-history-actions";
import { Input } from "@/components/ui/input";
import { DEFAULT_TIME_ZONE, todayIn } from "@/lib/memory/dates";
import {
  decisionLog,
  decisionTags,
  projectGroups,
  projectHref,
  waitingByPerson,
} from "@/lib/memory/memory-screen";
import { searchMemory, type SearchHit } from "@/lib/memory/search";
import type { MemoryData, MemoryKind, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DecisionCard, shortDate, WaitingList } from "./memory-parts";

const KIND_TITLES: Record<MemoryKind, string> = {
  project: "Projects",
  decision: "Decisions",
  task: "Tasks",
  meeting: "Meeting notes",
  follow_up: "Waiting on others",
  repeat: "Repeats",
};
const KIND_ORDER: MemoryKind[] = ["project", "decision", "task", "meeting", "follow_up", "repeat"];

function hitProjectId(hit: SearchHit, memory: MemoryData): string | null {
  const record = memory[hit.kind][hit.id] as { projectId?: string | null } | undefined;
  return record?.projectId ?? null;
}

/** Where a search hit lives: its project page when it has one, else Today for tasks and repeats. */
function hitHref(hit: SearchHit, memory: MemoryData): string | null {
  if (hit.kind === "project") return projectHref(hit.id);
  const projectId = hitProjectId(hit, memory);
  if (projectId) return projectHref(projectId);
  return hit.kind === "task" || hit.kind === "repeat" ? "/today" : null;
}

/** Project name and date, so look-alike results ("Standup" ×3) can be told apart. */
function hitMeta(hit: SearchHit, memory: MemoryData): string {
  const projectId = hitProjectId(hit, memory);
  const project = projectId ? memory.project[projectId]?.name : null;
  const meeting = hit.kind === "meeting" ? memory.meeting[hit.id]?.date : null;
  return [project, shortDate(meeting || hit.updatedAt)].filter(Boolean).join(" · ");
}

/** Snippets come from markdown summaries: drop list bullets and stray dates. */
function cleanSnippet(snippet: string): string {
  return snippet
    .replace(/(^|\s)[-*•]\s+/g, "$1")
    .replace(/\(\d{4}-\d{2}-\d{2}\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const STATUS_WORDS: Record<Project["status"], string | null> = { active: null, paused: "Paused", done: "Done" };

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={projectHref(project.id)}
      className="flex flex-col gap-1.5 rounded-xl bg-card px-4 py-3 shadow-[var(--rim)] transition-colors outline-none hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-heading text-base font-semibold break-words text-foreground">
          {project.name}
          {STATUS_WORDS[project.status] ? (
            <span className="ml-2 font-sans text-[0.8125rem] font-normal text-muted-foreground">
              {STATUS_WORDS[project.status]}
            </span>
          ) : null}
        </span>
        <LifeAreaChip area={project.area} />
      </span>
      {project.state ? <span className="text-sm leading-[1.6] text-foreground/85">{project.state}</span> : null}
      {project.nextStep ? (
        <span className="text-[0.8125rem] text-muted-foreground">Next: {project.nextStep}</span>
      ) : null}
    </Link>
  );
}

export function MemoryView() {
  const { state, sync } = useAppState();
  const { act, isReadOnly } = useHistoryActions();
  const focusSoon = useFocusSoon();
  const decisionsRef = useRef<HTMLHeadingElement>(null);
  const waitingRef = useRef<HTMLHeadingElement>(null);
  const loading = sync.indicator === "loading";
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const today = todayIn(DEFAULT_TIME_ZONE);
  const memory = state.memory;

  const groups = useMemo(() => projectGroups(memory), [memory]);
  const tags = useMemo(() => decisionTags(memory), [memory]);
  const decisions = useMemo(() => decisionLog(memory, { tag: tag ?? undefined }), [memory, tag]);
  const waiting = useMemo(() => waitingByPerson(memory, today), [memory, today]);
  const hits = useMemo(() => (query.trim() ? searchMemory(memory, query, { limit: 60 }) : []), [memory, query]);
  const searching = query.trim().length > 0;
  const isEmpty = groups.active.length + groups.other.length + decisions.length + waiting.length === 0 && !tag;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-4 pb-12 sm:px-6">
        <div className="flex flex-col gap-3">
          <PageHeader
            title="Memory"
            subtitle="Where your projects stand and what you decided. Or ask your AI: “What did I decide about…?”"
          />
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="memory-search" className="sr-only">
              Search your memory
            </label>
            <Input
              id="memory-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search decisions, projects, meetings…"
              className="h-11 rounded-xl bg-card pl-10 text-[0.9375rem]"
            />
          </div>
        </div>

        {searching ? (
          <section aria-label="Search results" className="flex flex-col gap-4">
            <p role="status" className="px-1 text-sm text-muted-foreground">
              {hits.length === 0
                ? "Nothing matches. Try fewer words, or ask your AI."
                : `${hits.length} ${hits.length === 1 ? "match" : "matches"}`}
            </p>
            {KIND_ORDER.map((kind) => {
              const list = hits.filter((hit) => hit.kind === kind);
              if (list.length === 0) return null;
              return (
                <div key={kind} className="flex flex-col gap-1.5">
                  <h2 className="px-1 font-heading text-lg font-semibold text-foreground">{KIND_TITLES[kind]}</h2>
                  <ul className="flex flex-col gap-1.5">
                    {list.map((hit) => {
                      const href = hitHref(hit, memory);
                      const body = (
                        <>
                          <span className="block text-[0.9375rem] font-semibold break-words text-foreground">{hit.label}</span>
                          {hit.snippet && cleanSnippet(hit.snippet) !== hit.label ? (
                            <span className="block text-sm leading-[1.7] break-words text-foreground/80">
                              {cleanSnippet(hit.snippet)}
                            </span>
                          ) : null}
                          <span className="block text-[0.8125rem] text-muted-foreground">{hitMeta(hit, memory)}</span>
                        </>
                      );
                      return (
                        <li key={`${hit.kind}:${hit.id}`}>
                          {href ? (
                            <Link
                              href={href}
                              className="block rounded-xl bg-card px-4 py-2.5 shadow-[var(--rim)] outline-none hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              {body}
                            </Link>
                          ) : (
                            <div className="rounded-xl bg-card px-4 py-2.5 shadow-[var(--rim)]">{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        ) : loading && isEmpty ? (
          <p role="status" className="px-1 text-sm text-muted-foreground">
            Loading your memory…
          </p>
        ) : isEmpty ? (
          <EmptyState
            icon={<Brain />}
            title="Nothing remembered yet."
            description="Tell your AI chat “remember that we decided…” or “file today’s standup”, and it shows up here."
          />
        ) : (
          <>
            {groups.active.length + groups.other.length > 0 ? (
              <section aria-label="Projects" className="flex flex-col gap-3">
                <SectionTitle hint="where each one stands">Projects</SectionTitle>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.active.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
                {groups.other.length > 0 ? (
                  <details className="group px-1">
                    <summary className="cursor-pointer rounded-md text-sm font-semibold text-muted-foreground outline-none focus-visible:outline-2 focus-visible:outline-ring">
                      Paused and done ({groups.other.length})
                    </summary>
                    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {groups.other.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                      ))}
                    </div>
                  </details>
                ) : null}
              </section>
            ) : null}

            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
              <section aria-label="Decisions" className="flex flex-col gap-3">
                <SectionTitle hint="newest first" headingRef={decisionsRef}>
                  Decisions
                </SectionTitle>
                {tags.length > 0 ? (
                  <div role="group" aria-label="Filter decisions by tag" className="flex flex-wrap gap-1.5 px-1">
                    {[null, ...tags].map((value) => (
                      <button
                        key={value ?? "all"}
                        type="button"
                        aria-pressed={tag === value}
                        onClick={() => setTag(value)}
                        className={cn(
                          "h-8 rounded-full border px-3 text-[0.8125rem] font-semibold transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:h-11",
                          tag === value
                            ? "border-primary bg-brand-subtle text-brand-subtle-foreground"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {value ? `#${value}` : "All"}
                      </button>
                    ))}
                  </div>
                ) : null}
                {decisions.length === 0 ? (
                  <EmptyState
                    size="inline"
                    icon={<Lightbulb />}
                    title={tag ? "No decisions with this tag." : "No decisions yet."}
                    description="Decisions your AI saves show up here, newest first."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {decisions.map((item) => (
                      <DecisionCard
                        key={item.decision.id}
                        item={item}
                        disabled={isReadOnly}
                        onMarkAgreed={() => {
                          act(
                            { type: "memory-set-decision-status", decisionId: item.decision.id, status: "agreed" },
                            `Marked “${item.decision.title}” agreed`,
                          );
                          focusSoon(decisionsRef);
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section aria-label="Waiting on others" className="flex flex-col gap-3">
                <SectionTitle hint="by person" headingRef={waitingRef}>
                  Waiting on others
                </SectionTitle>
                {waiting.length === 0 ? (
                  <p className="px-2 text-sm text-muted-foreground">Nobody — nothing you’re waiting on.</p>
                ) : (
                  <WaitingList
                    groups={waiting}
                    disabled={isReadOnly}
                    projectName={(item) => (item.projectId ? (memory.project[item.projectId]?.name ?? null) : null)}
                    onResolve={(item) => {
                      act({ type: "memory-resolve-follow-up", followUpId: item.id }, `Resolved “${item.what}”`);
                      focusSoon(waitingRef);
                    }}
                  />
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
