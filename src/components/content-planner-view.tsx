"use client";

import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  ContentIdea,
  ContentIdeaScriptStep,
  ContentIdeaStatus,
  ContentPlannerDensity,
  ContentPlannerLayout,
  ContentPlannerViewMode,
} from "@/lib/types";

export type { ContentPlannerDensity, ContentPlannerLayout, ContentPlannerViewMode };

type FilterOption = {
  label: string;
  value: string;
};

type StateSetter<T> = Dispatch<SetStateAction<T>>;

export type ContentPlannerControls = {
  layout: ContentPlannerLayout;
  setLayout: StateSetter<ContentPlannerLayout>;
  density: ContentPlannerDensity;
  setDensity: StateSetter<ContentPlannerDensity>;
  viewMode: ContentPlannerViewMode;
  setViewMode: StateSetter<ContentPlannerViewMode>;
  showLlmPanel: boolean;
  setShowLlmPanel: StateSetter<boolean>;
  statusFilter: string;
  setStatusFilter: StateSetter<string>;
  pillarFilter: string;
  setPillarFilter: StateSetter<string>;
  channelFilter: string;
  setChannelFilter: StateSetter<string>;
  tagFilter: string;
  setTagFilter: StateSetter<string>;
  searchQuery: string;
  setSearchQuery: StateSetter<string>;
};

type ContentPlannerViewProps = {
  ideas?: ContentIdea[];
  selectedIdeaId?: string | null;
  controls?: ContentPlannerControls;
  onSelectIdea?: (ideaId: string) => void;
  onGenerateIdeas?: (prompt: string) => void | Promise<void>;
  onUpdateIdea?: (ideaId: string, updates: Partial<ContentIdea>) => void;
  onSetIdeaStatus?: (ideaId: string, status: ContentIdeaStatus) => void;
  onAddPillarOption?: (value: string) => void;
  onRemovePillarOption?: (value: string) => void;
  onAddPlatformOption?: (value: string) => void;
  onRemovePlatformOption?: (value: string) => void;
  onAddTag?: (ideaId: string, tag: string) => void;
  onRemoveTag?: (ideaId: string, tag: string) => void;
  onRunAiAction?: (ideaId: string, action: string) => void | Promise<void>;
  onSetActiveHook?: (ideaId: string, hookId: string | null) => void;
  onRemoveHook?: (ideaId: string, hookId: string) => void;
  onAddScriptStep?: (ideaId: string, step: ContentIdeaScriptStep) => void;
  onMoveScriptStep?: (ideaId: string, stepId: string, targetIndex: number) => void;
  isGenerating?: boolean;
  activeAiIdeaId?: string | null;
  savedPillars?: string[];
  savedPlatforms?: string[];
};

const QUICK_PROMPTS = [
  "Brainstorm N ideas",
  "From one topic",
  "Rewrite hook",
  "Outline script",
  "Rank my ideas",
  "Voice memo → ideas",
];

const AI_QUICK_ACTIONS = [
  "Score against audience",
  "Suggest tags",
  "Outline script",
  "Repurpose for LinkedIn",
];

const STATUS_ORDER: ContentIdeaStatus[] = [
  "inbox",
  "curating",
  "outlined",
  "scripted",
  "published",
  "archived",
];

const STATUS_LABELS: Record<ContentIdeaStatus, string> = {
  inbox: "Inbox",
  curating: "Curating",
  outlined: "Outlined",
  scripted: "Scripted",
  published: "Published",
  archived: "Archived",
};

const STATUS_STYLES: Record<
  ContentIdeaStatus,
  { pillClassName: string; railClassName: string }
> = {
  inbox: {
    pillClassName:
      "border-[color:color-mix(in_srgb,var(--line)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--paper)_72%,var(--paper-strong))] text-[var(--ink-700)]",
    railClassName: "bg-[color:color-mix(in_srgb,var(--line)_78%,transparent)]",
  },
  curating: {
    pillClassName:
      "border-[color:color-mix(in_srgb,var(--brand)_26%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand-soft)_72%,var(--paper-strong))] text-[var(--ink-900)]",
    railClassName: "bg-[color:color-mix(in_srgb,var(--brand)_42%,var(--line))]",
  },
  outlined: {
    pillClassName:
      "border-[color:color-mix(in_srgb,var(--priority-2)_34%,var(--line))] bg-[color:color-mix(in_srgb,var(--priority-2-soft)_80%,var(--paper-strong))] text-[color:color-mix(in_srgb,var(--priority-2)_74%,var(--ink-900))]",
    railClassName: "bg-[color:color-mix(in_srgb,var(--priority-2)_56%,var(--line))]",
  },
  scripted: {
    pillClassName:
      "border-[color:color-mix(in_srgb,var(--brand)_28%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand-soft)_80%,var(--paper-strong))] text-[var(--brand)]",
    railClassName: "bg-[color:color-mix(in_srgb,var(--brand)_62%,var(--line))]",
  },
  published: {
    pillClassName:
      "border-[color:color-mix(in_srgb,var(--priority-3)_34%,var(--line))] bg-[color:color-mix(in_srgb,var(--priority-3-soft)_78%,var(--paper-strong))] text-[color:color-mix(in_srgb,var(--priority-3)_82%,var(--ink-900))]",
    railClassName: "bg-[color:color-mix(in_srgb,var(--priority-3)_64%,var(--line))]",
  },
  archived: {
    pillClassName:
      "border-[color:color-mix(in_srgb,var(--line)_90%,transparent)] bg-[color:color-mix(in_srgb,var(--paper)_68%,var(--paper-strong))] text-[var(--ink-500)]",
    railClassName: "bg-[color:color-mix(in_srgb,var(--line)_70%,transparent)]",
  },
};

function titleCaseStatus(status: ContentIdeaStatus) {
  return STATUS_LABELS[status];
}

function buildStatusOptions(): FilterOption[] {
  return [{ label: "All", value: "all" }].concat(
    STATUS_ORDER.map((status) => ({ label: titleCaseStatus(status), value: status })),
  );
}

function buildOptions(ideas: readonly ContentIdea[], getValue: (idea: ContentIdea) => string | string[]) {
  const counts = new Map<string, number>();

  ideas.forEach((idea) => {
    const values = getValue(idea);
    const list = Array.isArray(values) ? values : [values];
    list.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
    .map(([label]) => ({ label, value: label }));
}

function formatCountLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function scoreBreakdownLabel(idea: ContentIdea) {
  return `hook · ${idea.scoreBreakdown.hook} / proof · ${idea.scoreBreakdown.proof} / fit · ${idea.scoreBreakdown.fit}`;
}

function matchesSearch(idea: ContentIdea, searchQuery: string) {
  if (!searchQuery.trim()) return true;
  const needle = searchQuery.trim().toLowerCase();
  return [idea.hook, idea.premise, idea.tags.join(" "), idea.pillar, idea.channels.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function matchesTag(idea: ContentIdea, activeTag: string) {
  return activeTag === "all" || idea.tags.includes(activeTag);
}

function matchesChannel(idea: ContentIdea, activeChannel: string) {
  return activeChannel === "all" || idea.channels.includes(activeChannel);
}

function matchesPillar(idea: ContentIdea, activePillar: string) {
  return activePillar === "all" || idea.pillar === activePillar;
}

function statusPill(status: ContentIdeaStatus) {
  return STATUS_STYLES[status];
}

export function ContentPlannerView({
  ideas = [],
  selectedIdeaId = null,
  controls,
  onSelectIdea,
  onGenerateIdeas,
  onUpdateIdea,
  onSetIdeaStatus,
  onAddPillarOption,
  onRemovePillarOption,
  onAddPlatformOption,
  onRemovePlatformOption,
  onAddTag,
  onRemoveTag,
  onRunAiAction,
  onSetActiveHook,
  onRemoveHook,
  onAddScriptStep,
  onMoveScriptStep,
  isGenerating = false,
  activeAiIdeaId = null,
  savedPillars = [],
  savedPlatforms = [],
}: ContentPlannerViewProps) {
  const [localLayout] = useState<ContentPlannerLayout>("split");
  const [localDensity, setLocalDensity] = useState<ContentPlannerDensity>("comfortable");
  const [localViewMode, setLocalViewMode] = useState<ContentPlannerViewMode>("list");
  const [localShowLlmPanel, setLocalShowLlmPanel] = useState(true);
  const [localStatusFilter] = useState<string>("all");
  const [localPillarFilter] = useState<string>("all");
  const [localChannelFilter] = useState<string>("all");
  const [localTagFilter] = useState<string>("all");
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [prompt, setPrompt] = useState("Brainstorm 10 ideas about indie hackers shipping AI tools");
  const [pendingTag, setPendingTag] = useState("");

  const layout = controls?.layout ?? localLayout;
  const density = controls?.density ?? localDensity;
  const viewMode = controls?.viewMode ?? localViewMode;
  const showLlmPanel = controls?.showLlmPanel ?? localShowLlmPanel;
  const statusFilter = controls?.statusFilter ?? localStatusFilter;
  const pillarFilter = controls?.pillarFilter ?? localPillarFilter;
  const channelFilter = controls?.channelFilter ?? localChannelFilter;
  const tagFilter = controls?.tagFilter ?? localTagFilter;
  const searchQuery = controls?.searchQuery ?? localSearchQuery;
  const setDensity = controls?.setDensity ?? setLocalDensity;
  const setViewMode = controls?.setViewMode ?? setLocalViewMode;
  const setShowLlmPanel = controls?.setShowLlmPanel ?? setLocalShowLlmPanel;
  const setSearchQuery = controls?.setSearchQuery ?? setLocalSearchQuery;

  const ideasByMetaFilters = useMemo(
    () =>
      ideas.filter(
        (idea) =>
          matchesPillar(idea, pillarFilter) &&
          matchesChannel(idea, channelFilter) &&
          matchesTag(idea, tagFilter) &&
          matchesSearch(idea, searchQuery),
      ),
    [channelFilter, ideas, pillarFilter, searchQuery, tagFilter],
  );

  const filteredIdeas = useMemo(
    () =>
      ideasByMetaFilters
        .filter((idea) => (statusFilter === "all" ? true : idea.status === statusFilter))
        .toSorted((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt)),
    [ideasByMetaFilters, statusFilter],
  );

  const groupedIdeas = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        ideas: filteredIdeas.filter((idea) => idea.status === status),
      })),
    [filteredIdeas],
  );

  const selectedIdea =
    filteredIdeas.find((idea) => idea.id === selectedIdeaId) ??
    ideas.find((idea) => idea.id === selectedIdeaId) ??
    filteredIdeas[0] ??
    ideas[0] ??
    null;
  const totalIdeas = ideas.length;
  const draftingCount = ideas.filter((idea) => idea.status === "curating" || idea.status === "outlined").length;
  const scriptedCount = ideas.filter((idea) => idea.status === "scripted").length;
  const effectiveView = layout === "kanban" ? "kanban" : viewMode;
  const showRightPane = layout !== "kanban" && Boolean(selectedIdea);

  return (
    <section
      data-testid="content-planner-view"
      className={cn(
        "flex h-full min-h-0 flex-col bg-[var(--paper)]",
        density === "compact" && "content-planner--compact",
      )}
    >
      <div className="border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_94%,transparent)] px-4 py-4 md:px-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-[var(--ink-900)] md:text-xl">Content Planner</h1>
              <span className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 font-mono text-[11px] text-[var(--ink-700)]">
                {totalIdeas} ideas · {draftingCount} drafting · {scriptedCount} scripted
              </span>
            </div>

            <div className="rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--line)_86%,var(--brand))] bg-[var(--paper)] p-3 shadow-[var(--surface-shadow)]">
              <label className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand)]">
                  ✦
                </div>
                <textarea
                  aria-label="Generate ideas prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="min-h-[64px] flex-1 resize-none bg-transparent font-mono text-sm leading-6 text-[var(--ink-700)] outline-none"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((quickPrompt) => (
                <button
                  key={quickPrompt}
                  type="button"
                  onClick={() => setPrompt(quickPrompt)}
                  className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--brand)_26%,var(--line))] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                >
                  {quickPrompt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:items-end">
              <button
                type="button"
                disabled={isGenerating || !prompt.trim()}
                onClick={() => void onGenerateIdeas?.(prompt.trim())}
                className="rounded-lg border border-[var(--brand)] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[color:color-mix(in_srgb,var(--brand)_90%,black)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
              >
              {isGenerating ? "Generating…" : "Generate →"}
            </button>
            <button
              type="button"
              onClick={() => setShowLlmPanel(!showLlmPanel)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              {showLlmPanel ? "Hide AI panel" : "Show AI panel"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "content-planner-panes flex-1 min-h-0",
          layout === "split" && "content-planner-panes--split",
          layout === "kanban" && "content-planner-panes--kanban",
          layout === "detail-right" && "content-planner-panes--detail-right",
          !showRightPane && "content-planner-panes--right-hidden",
        )}
      >
        <section className="content-planner-pane-center min-h-0 bg-[var(--paper)] p-4">
          <div className="mb-4 border-b border-dashed border-[var(--line)] pb-3">
            <SectionLabel title="View" />
            <div className="mt-3 flex flex-wrap items-stretch gap-2">
              <div className="inline-flex h-12 rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] p-1">
                {[
                  { label: "List", value: "list" as const },
                  { label: "Kanban", value: "kanban" as const },
                  { label: "Grid", value: "grid" as const },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={effectiveView === option.value}
                    disabled={layout === "kanban"}
                    onClick={() => setViewMode(option.value)}
                    className={cn(
                      "h-full rounded-lg px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60",
                      effectiveView === option.value
                        ? "bg-[color:color-mix(in_srgb,var(--paper)_65%,var(--paper-strong))] text-[var(--ink-900)] shadow-[var(--surface-shadow)]"
                        : "text-[var(--ink-700)] hover:text-[var(--ink-900)]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <input
                aria-label="Search ideas"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="search ideas, hooks, tags…"
                className="flex h-12 min-w-[220px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-4 font-mono text-xs text-[var(--ink-700)] outline-none placeholder:text-[var(--ink-500)]"
              />
              <button
                type="button"
                onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
                className="inline-flex h-12 items-center rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--brand)_24%,var(--line))] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
              >
                Density: {density === "comfortable" ? "Comfortable" : "Compact"}
              </button>
            </div>
          </div>

          {ideas.length === 0 ? (
            <div className="grid h-full min-h-[360px] place-items-center" data-testid="content-planner-empty-state">
              <div className="max-w-xl rounded-3xl border border-dashed border-[color:color-mix(in_srgb,var(--line)_86%,var(--brand))] bg-[var(--paper-strong)] px-6 py-8 text-center shadow-[var(--surface-shadow)]">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-500)]">
                  Your content inbox
                </p>
                <h2 className="mt-2 text-lg font-semibold text-[var(--ink-900)]">
                  No ideas yet. Ask the AI to spark a few.
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--ink-700)]">
                  Type a topic, paste a transcript, or point at your notes. The planner fills up from there, then you curate, shape, and ship.
                </p>
              </div>
            </div>
          ) : effectiveView === "kanban" ? (
            <div className="content-planner-kanban" data-testid="content-planner-kanban">
              {STATUS_ORDER.map((status) => {
                const statusIdeas = filteredIdeas.filter((idea) => idea.status === status);
                return (
                  <div
                    key={status}
                    className="min-h-[320px] rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--line)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--paper)_82%,var(--paper-strong))] p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]">
                        {titleCaseStatus(status)}
                      </p>
                      <span className="font-mono text-[11px] text-[var(--ink-500)]">{statusIdeas.length}</span>
                    </div>
                    <div className="space-y-2">
                      {statusIdeas.map((idea) => (
                        <IdeaCard
                          key={idea.id}
                          idea={idea}
                          selected={selectedIdea?.id === idea.id}
                          compact={density === "compact"}
                          onSelect={() => onSelectIdea?.(idea.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : effectiveView === "grid" ? (
            <div className="grid gap-3 md:grid-cols-2" data-testid="content-planner-grid">
              {filteredIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  selected={selectedIdea?.id === idea.id}
                  compact={false}
                  onSelect={() => onSelectIdea?.(idea.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-6" data-testid="content-planner-list">
              {groupedIdeas.map(({ status, ideas: statusIdeas }) =>
                statusIdeas.length > 0 ? (
                  <section key={status}>
                    <div className="mb-3 flex items-center gap-3 px-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]">
                        {titleCaseStatus(status)}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--ink-500)]">
                        {formatCountLabel(statusIdeas.length, "idea")}
                      </span>
                      <span className="h-px flex-1 bg-[var(--line)]" />
                    </div>
                    <div className="space-y-2">
                      {statusIdeas.map((idea) => (
                        <IdeaCard
                          key={idea.id}
                          compact={density === "compact"}
                          idea={idea}
                          selected={selectedIdea?.id === idea.id}
                          onSelect={() => onSelectIdea?.(idea.id)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null,
              )}
            </div>
          )}
        </section>

        {showRightPane && selectedIdea ? (
          <aside
            className="content-planner-pane-right border-l border-dashed border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_76%,var(--paper))] p-4"
            data-testid="content-planner-detail-pane"
          >
            <IdeaDetail
              idea={selectedIdea}
              savedPillars={savedPillars}
              savedPlatforms={savedPlatforms}
              showLlmPanel={showLlmPanel}
              isAiWorking={activeAiIdeaId === selectedIdea.id}
              pendingTag={pendingTag}
              setPendingTag={setPendingTag}
              onUpdateIdea={onUpdateIdea}
              onSetIdeaStatus={onSetIdeaStatus}
              onAddPillarOption={onAddPillarOption}
              onAddPlatformOption={onAddPlatformOption}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onRunAiAction={onRunAiAction}
              onSetActiveHook={onSetActiveHook}
              onRemoveHook={onRemoveHook}
              onAddScriptStep={onAddScriptStep}
              onMoveScriptStep={onMoveScriptStep}
            />
          </aside>
        ) : null}
      </div>
    </section>
  );
}

export function ContentPlannerSidebarPanels({
  controls,
  ideas,
  savedPillars = [],
  savedPlatforms = [],
  onAddPillarOption,
  onRemovePillarOption,
  onAddPlatformOption,
  onRemovePlatformOption,
}: {
  controls: ContentPlannerControls;
  ideas: ContentIdea[];
  savedPillars?: string[];
  savedPlatforms?: string[];
  onAddPillarOption?: (value: string) => void;
  onRemovePillarOption?: (value: string) => void;
  onAddPlatformOption?: (value: string) => void;
  onRemovePlatformOption?: (value: string) => void;
}) {
  const statusOptions = useMemo(() => buildStatusOptions(), []);
  const pillarOptions = useMemo(
    () =>
      (savedPillars.length > 0 ? savedPillars : buildOptions(ideas, (idea) => idea.pillar).map((item) => item.value))
        .map((value) => ({ label: value, value })),
    [ideas, savedPillars],
  );
  const channelOptions = useMemo(
    () =>
      (savedPlatforms.length > 0
        ? savedPlatforms
        : buildOptions(ideas, (idea) => idea.channels).map((item) => item.value)).map((value) => ({
        label: value,
        value,
      })),
    [ideas, savedPlatforms],
  );
  const tagOptions = useMemo(() => buildOptions(ideas, (idea) => idea.tags), [ideas]);
  const totalIdeas = ideas.length;

  const ideasByMetaFilters = useMemo(
    () =>
      ideas.filter(
        (idea) =>
          matchesPillar(idea, controls.pillarFilter) &&
          matchesChannel(idea, controls.channelFilter) &&
          matchesTag(idea, controls.tagFilter),
      ),
    [controls.channelFilter, controls.pillarFilter, controls.tagFilter, ideas],
  );

  return (
    <div className="flex min-h-full flex-col pb-3">
      <div className="flex-1 border-y border-[color:color-mix(in_srgb,var(--line)_82%,transparent)] bg-[color:color-mix(in_srgb,var(--paper-strong)_30%,transparent)] px-3 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]">Filters</p>
        <div className="mt-3 space-y-5">
          <FilterSection
            title="Status"
            activeValue={controls.statusFilter}
            options={statusOptions}
            counts={ideasByMetaFilters.reduce<Record<string, number>>(
              (acc, idea) => {
                acc[idea.status] = (acc[idea.status] ?? 0) + 1;
                acc.all = (acc.all ?? 0) + 1;
                return acc;
              },
              { all: 0 },
            )}
            onSelect={controls.setStatusFilter}
          />
          <FilterSection
            title="Pillars"
            activeValue={controls.pillarFilter}
            options={[{ label: "All pillars", value: "all" }, ...pillarOptions]}
            counts={ideas.reduce<Record<string, number>>(
              (acc, idea) => {
                acc[idea.pillar] = (acc[idea.pillar] ?? 0) + 1;
                acc.all = totalIdeas;
                return acc;
              },
              { all: totalIdeas },
            )}
            onSelect={controls.setPillarFilter}
          />
          <FilterSection
            title="Channel"
            activeValue={controls.channelFilter}
            options={[{ label: "All channels", value: "all" }, ...channelOptions]}
            counts={ideas.reduce<Record<string, number>>(
              (acc, idea) => {
                idea.channels.forEach((channel) => {
                  acc[channel] = (acc[channel] ?? 0) + 1;
                });
                acc.all = totalIdeas;
                return acc;
              },
              { all: totalIdeas },
            )}
            onSelect={controls.setChannelFilter}
          />
          <div>
            <SectionLabel title="Tags" />
            <div className="mt-2 flex flex-wrap gap-2">
              <TagButton active={controls.tagFilter === "all"} label="All" onClick={() => controls.setTagFilter("all")} />
              {tagOptions.map((tag) => (
                <TagButton
                  key={tag.value}
                  active={controls.tagFilter === tag.value}
                  label={tag.label}
                  onClick={() => controls.setTagFilter(tag.value)}
                />
              ))}
            </div>
          </div>
          <ManageOptionsSection
            title="Manage pillars"
            valueLabel="pillar"
            values={savedPillars}
            inUseCheck={(value) => ideas.some((idea) => idea.pillar === value)}
            onAdd={onAddPillarOption}
            onRemove={onRemovePillarOption}
          />
          <ManageOptionsSection
            title="Manage platforms"
            valueLabel="platform"
            values={savedPlatforms}
            inUseCheck={(value) => ideas.some((idea) => idea.channels.includes(value))}
            onAdd={onAddPlatformOption}
            onRemove={onRemovePlatformOption}
          />
        </div>
      </div>
    </div>
  );
}

function ManageOptionsSection({
  title,
  valueLabel,
  values,
  inUseCheck,
  onAdd,
  onRemove,
}: {
  title: string;
  valueLabel: string;
  values: string[];
  inUseCheck: (value: string) => boolean;
  onAdd?: (value: string) => void;
  onRemove?: (value: string) => void;
}) {
  const [pendingValue, setPendingValue] = useState("");

  return (
    <div>
      <SectionLabel title={title} />
      <div className="mt-2 space-y-2">
        <div className="flex gap-2">
          <input
            aria-label={`Add ${valueLabel}`}
            value={pendingValue}
            onChange={(event) => setPendingValue(event.target.value)}
            className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-2 text-sm text-[var(--ink-900)] outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (!pendingValue.trim()) return;
              onAdd?.(pendingValue.trim());
              setPendingValue("");
            }}
            className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs font-medium text-[var(--ink-700)]"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {values.map((value) => {
            const inUse = inUseCheck(value);

            return (
              <button
                key={value}
                type="button"
                disabled={inUse}
                title={inUse ? `This ${valueLabel} is still used by ideas.` : `Remove ${valueLabel}`}
                onClick={() => onRemove?.(value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors duration-150",
                  inUse
                    ? "cursor-not-allowed border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper)_70%,var(--paper-strong))] text-[var(--ink-500)]"
                    : "border-[var(--line)] bg-[var(--paper-strong)] text-[var(--ink-700)] hover:border-[color:color-mix(in_srgb,var(--brand)_24%,var(--line))] hover:text-[var(--ink-900)]",
                )}
              >
                {value}
                {inUse ? " • in use" : " ×"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">{title}</p>;
}

function FilterSection({
  title,
  options,
  counts,
  activeValue,
  onSelect,
}: {
  title: string;
  options: FilterOption[];
  counts: Record<string, number>;
  activeValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <SectionLabel title={title} />
      <div className="mt-2 space-y-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
              activeValue === option.value
                ? "border-[var(--line)] bg-[var(--paper-strong)] text-[var(--ink-900)] shadow-[var(--surface-shadow)]"
                : "border-transparent text-[var(--ink-700)] hover:border-[color:color-mix(in_srgb,var(--brand)_18%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--paper-strong)_58%,transparent)]",
            )}
          >
            <span>{option.label}</span>
            <span className="font-mono text-[11px] text-[var(--ink-500)]">{counts[option.value] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TagButton({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
        active
          ? "border-[color:color-mix(in_srgb,var(--brand)_26%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand-soft)_74%,var(--paper-strong))] text-[var(--ink-900)]"
          : "border-[var(--line)] bg-[var(--paper-strong)] text-[var(--ink-700)] hover:border-[color:color-mix(in_srgb,var(--brand)_24%,var(--line))] hover:text-[var(--ink-900)]",
      )}
    >
      {label}
    </button>
  );
}

function IdeaCard({
  idea,
  selected,
  compact,
  onSelect,
}: {
  idea: ContentIdea;
  selected: boolean;
  compact: boolean;
  onSelect: () => void;
}) {
  const statusStyle = statusPill(idea.status);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={idea.hook}
      className={cn(
        "group grid w-full grid-cols-[14px_minmax(0,1fr)_auto] gap-3 rounded-2xl border bg-[var(--paper-strong)] p-4 text-left shadow-[var(--surface-shadow)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
        selected ? "border-[var(--brand)]" : "border-[var(--line)] hover:border-[color:color-mix(in_srgb,var(--brand)_22%,var(--line))]",
        compact && "gap-2 px-3 py-2.5",
      )}
    >
      <span className={cn("mt-1 h-6 w-1 rounded-full", statusStyle.railClassName, compact && "h-5")} />
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold leading-5 text-[var(--ink-900)]", compact && "text-[13px]")}>{idea.hook}</p>
        {!compact ? <p className="mt-1.5 text-sm leading-6 text-[var(--ink-700)]">{idea.premise}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-500)]">
          <span className={cn("rounded-full border px-2 py-0.5 font-mono uppercase tracking-[0.08em]", statusStyle.pillClassName)}>
            {titleCaseStatus(idea.status)}
          </span>
          <span>{idea.channels[0]}</span>
          <span>•</span>
          <span>{idea.pillar}</span>
          <span>•</span>
          <span className="font-mono">#{idea.tags.join(" #")}</span>
          {idea.sourceType === "ai" ? (
            <>
              <span>•</span>
              <span>✦ AI-suggested</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-[72px] flex-col items-end gap-1">
        <span className="rounded-md bg-[color:color-mix(in_srgb,var(--paper)_62%,var(--paper-strong))] px-2 py-1 font-mono text-[11px] text-[var(--ink-700)]">
          {idea.score.toFixed(1)}
        </span>
      </div>
    </button>
  );
}

function IdeaDetail({
  idea,
  savedPillars,
  savedPlatforms,
  showLlmPanel,
  isAiWorking,
  pendingTag,
  setPendingTag,
  onUpdateIdea,
  onSetIdeaStatus,
  onAddPillarOption,
  onAddPlatformOption,
  onAddTag,
  onRemoveTag,
  onRunAiAction,
  onSetActiveHook,
  onRemoveHook,
  onAddScriptStep,
  onMoveScriptStep,
}: {
  idea: ContentIdea;
  savedPillars: string[];
  savedPlatforms: string[];
  showLlmPanel: boolean;
  isAiWorking: boolean;
  pendingTag: string;
  setPendingTag: (value: string) => void;
  onUpdateIdea?: (ideaId: string, updates: Partial<ContentIdea>) => void;
  onSetIdeaStatus?: (ideaId: string, status: ContentIdeaStatus) => void;
  onAddPillarOption?: (value: string) => void;
  onAddPlatformOption?: (value: string) => void;
  onAddTag?: (ideaId: string, tag: string) => void;
  onRemoveTag?: (ideaId: string, tag: string) => void;
  onRunAiAction?: (ideaId: string, action: string) => void | Promise<void>;
  onSetActiveHook?: (ideaId: string, hookId: string | null) => void;
  onRemoveHook?: (ideaId: string, hookId: string) => void;
  onAddScriptStep?: (ideaId: string, step: ContentIdeaScriptStep) => void;
  onMoveScriptStep?: (ideaId: string, stepId: string, targetIndex: number) => void;
}) {
  const statusStyle = statusPill(idea.status);
  const [pendingPillar, setPendingPillar] = useState(idea.pillar);
  const [pendingPlatform, setPendingPlatform] = useState("");
  const pillarListId = useId();
  const platformListId = useId();
  const availablePlatforms = savedPlatforms.filter((platform) => !idea.channels.includes(platform));

  useEffect(() => {
    setPendingPillar(idea.pillar);
    setPendingPlatform("");
  }, [idea.id, idea.pillar]);

  const commitPillar = (value: string) => {
    const normalized = value.trim();
    if (!normalized || normalized === idea.pillar) {
      setPendingPillar(idea.pillar);
      return;
    }

    onAddPillarOption?.(normalized);
    onUpdateIdea?.(idea.id, { pillar: normalized });
    setPendingPillar(normalized);
  };

  const addPlatform = (value: string) => {
    const normalized = value.trim();
    if (!normalized || idea.channels.includes(normalized)) {
      return;
    }

    onAddPlatformOption?.(normalized);
    onUpdateIdea?.(idea.id, {
      channels: [...idea.channels, normalized],
    });
    setPendingPlatform("");
  };

  return (
    <div className="space-y-5">
      <div className="border-b border-dashed border-[var(--line)] pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-500)]">Idea · {idea.code}</p>
        <input
          aria-label="Idea hook"
          value={idea.hook}
          onChange={(event) => onUpdateIdea?.(idea.id, { hook: event.target.value })}
          className="mt-2 w-full bg-transparent text-xl font-semibold leading-7 text-[var(--ink-900)] outline-none"
        />
        <textarea
          aria-label="Idea premise"
          value={idea.premise}
          onChange={(event) => onUpdateIdea?.(idea.id, { premise: event.target.value })}
          className="mt-3 min-h-[88px] w-full rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-2 text-sm leading-6 text-[var(--ink-700)] outline-none"
        />
        <dl className="mt-4 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">Status</dt>
          <dd className="flex flex-wrap items-center gap-2 text-[var(--ink-900)]">
            <select
              aria-label="Idea status"
              value={idea.status}
              onChange={(event) => onSetIdeaStatus?.(idea.id, event.target.value as ContentIdeaStatus)}
              className={cn("rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]", statusStyle.pillClassName)}
            >
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {titleCaseStatus(status)}
                </option>
              ))}
            </select>
          </dd>
          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">Pillar</dt>
          <dd>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  aria-label="Idea pillar"
                  list={pillarListId}
                  value={pendingPillar}
                  onChange={(event) => setPendingPillar(event.target.value)}
                  onBlur={() => commitPillar(pendingPillar)}
                  className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-2 text-sm text-[var(--ink-900)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => commitPillar(pendingPillar)}
                  className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs font-medium text-[var(--ink-700)]"
                >
                  Apply
                </button>
              </div>
              <datalist id={pillarListId}>
                {savedPillars.map((pillar) => (
                  <option key={pillar} value={pillar} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-2">
                {savedPillars.map((pillar) => (
                  <button
                    key={pillar}
                    type="button"
                    onClick={() => commitPillar(pillar)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors duration-150",
                      idea.pillar === pillar
                        ? "border-[color:color-mix(in_srgb,var(--brand)_26%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand-soft)_74%,var(--paper-strong))] text-[var(--ink-900)]"
                        : "border-[var(--line)] bg-[var(--paper-strong)] text-[var(--ink-700)] hover:text-[var(--ink-900)]",
                    )}
                  >
                    {pillar}
                  </button>
                ))}
              </div>
            </div>
          </dd>
          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">Channel</dt>
          <dd>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {idea.channels.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() =>
                      onUpdateIdea?.(idea.id, {
                        channels: idea.channels.filter((value) => value !== channel),
                      })
                    }
                    className="rounded-full border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-1 text-xs text-[var(--ink-700)]"
                  >
                    {channel} ×
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  aria-label="Add platform"
                  list={platformListId}
                  value={pendingPlatform}
                  onChange={(event) => setPendingPlatform(event.target.value)}
                  className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-2 text-sm text-[var(--ink-900)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => addPlatform(pendingPlatform)}
                  className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs font-medium text-[var(--ink-700)]"
                >
                  Add
                </button>
              </div>
              <datalist id={platformListId}>
                {savedPlatforms.map((platform) => (
                  <option key={platform} value={platform} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => addPlatform(platform)}
                    className="rounded-full border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-1 text-xs text-[var(--ink-700)] transition-colors duration-150 hover:text-[var(--ink-900)]"
                  >
                    + {platform}
                  </button>
                ))}
              </div>
            </div>
          </dd>
          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">Tags</dt>
          <dd className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {idea.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onRemoveTag?.(idea.id, tag)}
                  className="rounded-full border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-1 text-xs text-[var(--ink-700)]"
                >
                  {tag} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                aria-label="Add tag"
                value={pendingTag}
                onChange={(event) => setPendingTag(event.target.value)}
                className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-2 text-sm text-[var(--ink-900)] outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (!pendingTag.trim()) return;
                  onAddTag?.(idea.id, pendingTag.trim());
                  setPendingTag("");
                }}
                className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs font-medium text-[var(--ink-700)]"
              >
                Add
              </button>
            </div>
          </dd>
          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">Score</dt>
          <dd className="flex flex-wrap items-center gap-2 text-[var(--ink-900)]">
            <span className="rounded-md bg-[color:color-mix(in_srgb,var(--paper)_62%,var(--paper-strong))] px-2 py-1 font-mono text-[11px] text-[var(--ink-700)]">
              {idea.score.toFixed(1)}
            </span>
            <span className="font-mono text-[10px] text-[var(--ink-500)]">{scoreBreakdownLabel(idea)}</span>
          </dd>
          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">Source</dt>
          <dd className="font-mono text-[11px] text-[var(--ink-500)]">{idea.sourceLabel}</dd>
        </dl>
      </div>

      <DetailSection title="Hook variations" actionLabel="✦ Generate 4 more" onAction={() => void onRunAiAction?.(idea.id, "generate-hooks")}>
        <div className="space-y-2">
          {idea.hooks.map((hook, index) => (
            <div key={hook.id} className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-2.5">
              <span className="pt-0.5 font-mono text-[10px] text-[var(--ink-500)]">{String(index + 1).padStart(2, "0")}</span>
              <p className="flex-1 text-sm leading-5 text-[var(--ink-900)]">{hook.value}</p>
              <div className="flex gap-1">
                <MiniButton active={hook.id === idea.activeHookId} onClick={() => onSetActiveHook?.(idea.id, hook.id)}>
                  use
                </MiniButton>
                <MiniButton onClick={() => onRemoveHook?.(idea.id, hook.id)}>×</MiniButton>
              </div>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Script structure" actionLabel="✦ Draft outline" onAction={() => void onRunAiAction?.(idea.id, "outline-script")}>
        <div className="space-y-2">
          {idea.scriptSteps.map((step, index) => (
            <div key={step.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-3">
              <span className="self-center text-center font-mono text-[11px] text-[var(--ink-500)]">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--ink-900)]">{step.label}</p>
                <p className={cn("mt-1 text-sm leading-6 text-[var(--ink-700)]", step.placeholder && "italic text-[var(--ink-500)]")}>
                  {step.body}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <MiniButton onClick={() => void onRunAiAction?.(idea.id, `refine-step:${step.id}`)}>✦ {step.actionLabel}</MiniButton>
                <MiniButton onClick={() => onMoveScriptStep?.(idea.id, step.id, Math.max(0, index - 1))}>↑</MiniButton>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={() =>
              onAddScriptStep?.(
                idea.id,
                {
                  id: `content-step-inline-${Date.now()}`,
                  label: "New section",
                  body: "Add the next beat for this idea.",
                  actionLabel: "rewrite",
                },
              )
            }
            className="text-sm text-[var(--ink-700)] transition-colors duration-150 hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            + Add section
          </button>
        </div>
      </DetailSection>

      {showLlmPanel ? (
        <DetailSection title="✦ Ask AI about this idea">
          <div className="rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--line)_84%,var(--brand))] bg-[color:color-mix(in_srgb,var(--brand-soft)_34%,var(--paper-strong))] p-3">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              {AI_QUICK_ACTIONS.map((action) => (
                <TagButton key={action} label={action} onClick={() => void onRunAiAction?.(idea.id, action)} />
              ))}
            </div>
            {isAiWorking ? <p className="mt-3 text-xs text-[var(--ink-700)]">AI is drafting updates…</p> : null}
          </div>
        </DetailSection>
      ) : null}
    </div>
  );
}

function DetailSection({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]">{title}</p>
        <span className="h-px flex-1 bg-[var(--line)]" />
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--brand)_24%,var(--line))] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function MiniButton({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 font-mono text-[10px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
        active
          ? "border-[color:color-mix(in_srgb,var(--brand)_28%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand-soft)_68%,var(--paper-strong))] text-[var(--brand)]"
          : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink-500)] hover:text-[var(--ink-900)]",
      )}
    >
      {children}
    </button>
  );
}
