"use client";

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type ContentPlannerStatus =
  | "inbox"
  | "curating"
  | "outlined"
  | "scripted"
  | "published"
  | "archived";

export type ContentPlannerLayout = "split" | "kanban" | "detail-right";
export type ContentPlannerDensity = "comfortable" | "compact";
export type ContentPlannerViewMode = "list" | "kanban" | "grid";
export type ContentPlannerDemoState = "populated" | "empty";
type ContentPlannerSourceType = "human" | "ai";

type ContentIdea = {
  id: string;
  code: string;
  hook: string;
  premise: string;
  status: ContentPlannerStatus;
  pillar: string;
  channels: string[];
  tags: string[];
  score: number;
  ageLabel: string;
  source: string;
  sourceType: ContentPlannerSourceType;
  scoreBreakdown: string;
  hooks: string[];
  activeHookIndex: number;
  scriptSteps: Array<{
    id: string;
    label: string;
    body: string;
    placeholder?: boolean;
    actionLabel: string;
  }>;
};

type FilterOption = {
  label: string;
  value: string;
};

const QUICK_PROMPTS = [
  "Brainstorm N ideas",
  "From my notes",
  "Rewrite hook",
  "Outline script",
  "Rank my ideas",
  "Voice memo → ideas",
];

const STATUS_ORDER: ContentPlannerStatus[] = [
  "inbox",
  "curating",
  "outlined",
  "scripted",
  "published",
  "archived",
];

const STATUS_LABELS: Record<ContentPlannerStatus, string> = {
  inbox: "Inbox",
  curating: "Curating",
  outlined: "Outlined",
  scripted: "Scripted",
  published: "Published",
  archived: "Archived",
};

const STATUS_STYLES: Record<
  ContentPlannerStatus,
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

const IDEAS: ContentIdea[] = [
  {
    id: "idea-1",
    code: "#0142",
    hook: 'Why "shipping ugly" beats polishing for the first 90 days.',
    premise:
      "Three concrete examples from indie hackers who launched rough, got feedback, then layered polish once retention was real.",
    status: "inbox",
    pillar: "Teach",
    channels: ["YouTube long", "LinkedIn excerpt"],
    tags: ["launch", "mindset"],
    score: 8.4,
    ageLabel: "2d ago",
    source: "inbox reply → 2026-04-14",
    sourceType: "ai",
    scoreBreakdown: "hook · 9 / proof · 7 / fit · 9",
    hooks: [
      "Polish is a trap in the first 90 days. Here's what to do instead.",
      "I launched ugly on purpose. 90 days later, retention told the truth.",
      "Three founders who shipped embarrassing v1s — and why it worked.",
      "The polish-first loop that quietly kills indie products.",
    ],
    activeHookIndex: 1,
    scriptSteps: [
      {
        id: "step-1",
        label: "Hook",
        body: 'Cold open: "I shipped this on purpose." Show the ugly v1 screenshot full-frame.',
        actionLabel: "rewrite",
      },
      {
        id: "step-2",
        label: "Context",
        body: "Why polish feels safe, why it isn't. 30 seconds. Cite the two founders' stories.",
        actionLabel: "rewrite",
      },
      {
        id: "step-3",
        label: "Points (3)",
        body: "① Retention is honest, polish isn't. ② Ugly attracts the right critics. ③ You can't polish what you haven't proven.",
        actionLabel: "expand",
      },
      {
        id: "step-4",
        label: "Proof",
        body: "[ drop a chart or testimonial here — AI can suggest from notes ]",
        placeholder: true,
        actionLabel: "find proof",
      },
      {
        id: "step-5",
        label: "CTA",
        body: "[ one clear ask — reply, save, or try the template ]",
        placeholder: true,
        actionLabel: "suggest",
      },
    ],
  },
  {
    id: "idea-2",
    code: "#0141",
    hook: "The boring changelog post that outperformed my launch video.",
    premise:
      "Quiet, factual weekly updates built more trust than the splashy launch. Break down the pattern.",
    status: "inbox",
    pillar: "Build in public",
    channels: ["Newsletter"],
    tags: ["tooling"],
    score: 7.9,
    ageLabel: "2d ago",
    source: "weekly summary → 2026-04-13",
    sourceType: "human",
    scoreBreakdown: "hook · 8 / proof · 8 / fit · 7",
    hooks: [
      "My no-drama changelog quietly beat the big launch post.",
      "Splashy launches are loud. Changelogs compound trust instead.",
      "A boring update built more demand than my launch trailer.",
    ],
    activeHookIndex: 0,
    scriptSteps: [
      {
        id: "step-1",
        label: "Hook",
        body: "Open on the launch video stats vs. the changelog reply thread.",
        actionLabel: "rewrite",
      },
      {
        id: "step-2",
        label: "Lesson",
        body: "Show why consistency and specificity beat cinematic hype for this audience.",
        actionLabel: "expand",
      },
    ],
  },
  {
    id: "idea-3",
    code: "#0138",
    hook: "I deleted half my AI wrappers. Retention doubled.",
    premise: "Case study of removing features. When subtraction is the product strategy.",
    status: "inbox",
    pillar: "Proof",
    channels: ["LinkedIn"],
    tags: ["llm", "workflow"],
    score: 7.2,
    ageLabel: "4d ago",
    source: "customer call → 2026-04-11",
    sourceType: "human",
    scoreBreakdown: "hook · 8 / proof · 9 / fit · 5",
    hooks: [
      "Deleting features felt reckless until retention doubled.",
      "The fastest growth tweak I made was cutting the AI fluff.",
    ],
    activeHookIndex: 0,
    scriptSteps: [
      {
        id: "step-1",
        label: "Setup",
        body: "Show the before-and-after product surface area in one frame.",
        actionLabel: "rewrite",
      },
    ],
  },
  {
    id: "idea-4",
    code: "#0137",
    hook: "Your first 100 users don't need your roadmap.",
    premise: "Counterintuitive: roadmap transparency can lower conversion. Show data.",
    status: "inbox",
    pillar: "Opinion",
    channels: ["Short video"],
    tags: ["positioning"],
    score: 6.6,
    ageLabel: "5d ago",
    source: "voice memo → 2026-04-10",
    sourceType: "human",
    scoreBreakdown: "hook · 7 / proof · 5 / fit · 7",
    hooks: [
      "Your roadmap is probably hurting early conversions.",
      "First users want certainty, not a Trello board.",
    ],
    activeHookIndex: 0,
    scriptSteps: [
      {
        id: "step-1",
        label: "Claim",
        body: "Lead with the surprising metric shift after hiding the roadmap from the landing page.",
        actionLabel: "rewrite",
      },
    ],
  },
  {
    id: "idea-5",
    code: "#0128",
    hook: "The cheapest market research: reading your own support inbox.",
    premise: "Turn recurring questions into a content map. Include a template.",
    status: "curating",
    pillar: "Teach",
    channels: ["Newsletter"],
    tags: ["research", "workflow"],
    score: 8.1,
    ageLabel: "1w ago",
    source: "support digest → 2026-04-08",
    sourceType: "human",
    scoreBreakdown: "hook · 8 / proof · 7 / fit · 9",
    hooks: [
      "Your support inbox is already the content strategy.",
      "The cheapest customer research is hiding in your replies.",
    ],
    activeHookIndex: 0,
    scriptSteps: [
      {
        id: "step-1",
        label: "Framework",
        body: "Bucket questions by urgency, friction, and payoff, then map them to formats.",
        actionLabel: "expand",
      },
    ],
  },
  {
    id: "idea-6",
    code: "#0127",
    hook: "A 15-minute weekly ritual that replaced my content calendar.",
    premise: "Less scheduling, more theme-led batching. Pair with the idea inbox flow.",
    status: "curating",
    pillar: "Build in public",
    channels: ["YouTube long"],
    tags: ["workflow", "planning"],
    score: 7.7,
    ageLabel: "1w ago",
    source: "notebook page → 2026-04-07",
    sourceType: "ai",
    scoreBreakdown: "hook · 7 / proof · 7 / fit · 9",
    hooks: [
      "My calendar got smaller. My publishing got better.",
      "One 15-minute ritual replaced my whole content calendar.",
    ],
    activeHookIndex: 1,
    scriptSteps: [
      {
        id: "step-1",
        label: "Walkthrough",
        body: "Show the notebook capture flow, then the triage sequence from inbox to channel.",
        actionLabel: "expand",
      },
    ],
  },
  {
    id: "idea-7",
    code: "#0115",
    hook: 'Stop calling it MVP. Call it the "cheapest honest answer."',
    premise: "Outline done. Hook variations generated. Needs a proof example from the last launch.",
    status: "outlined",
    pillar: "Opinion",
    channels: ["LinkedIn"],
    tags: ["launch", "positioning"],
    score: 8.6,
    ageLabel: "9d ago",
    source: "draft notes → 2026-04-05",
    sourceType: "human",
    scoreBreakdown: "hook · 9 / proof · 6 / fit · 9",
    hooks: [
      'MVP is vague. "Cheapest honest answer" tells the truth.',
      "Rename the MVP and suddenly better product decisions show up.",
      "The term MVP hides the real job: answer the market honestly.",
      "Cheapest honest answer beats minimum viable product every time.",
    ],
    activeHookIndex: 3,
    scriptSteps: [
      {
        id: "step-1",
        label: "Argument",
        body: "Contrast MVP jargon with a concrete user question and response loop.",
        actionLabel: "rewrite",
      },
    ],
  },
  {
    id: "idea-8",
    code: "#0104",
    hook: "I replaced my project manager with 4 prompts and a checklist.",
    premise: "Full script done. Needs thumbnail variants and a proof screenshot.",
    status: "scripted",
    pillar: "Teach",
    channels: ["YouTube long"],
    tags: ["prompts", "systems"],
    score: 9.1,
    ageLabel: "12d ago",
    source: "workflow experiment → 2026-04-02",
    sourceType: "human",
    scoreBreakdown: "hook · 9 / proof · 8 / fit · 10",
    hooks: [
      "I fired my PM stack and kept four prompts.",
      "This checklist replaced three tools and a lot of overhead.",
    ],
    activeHookIndex: 0,
    scriptSteps: [
      {
        id: "step-1",
        label: "Intro",
        body: "Open with the stack diagram, then peel it back to the four prompts and checklist.",
        actionLabel: "rewrite",
      },
    ],
  },
  {
    id: "idea-9",
    code: "#0098",
    hook: "Launching in public, quietly.",
    premise: "Published essay about quieter launch energy and what actually compounds trust.",
    status: "published",
    pillar: "Build in public",
    channels: ["Newsletter"],
    tags: ["trust"],
    score: 8.2,
    ageLabel: "Apr 09",
    source: "published → 2026-04-09",
    sourceType: "human",
    scoreBreakdown: "hook · 8 / proof · 7 / fit · 9",
    hooks: ["Launching in public works better when it feels like field notes, not fireworks."],
    activeHookIndex: 0,
    scriptSteps: [
      {
        id: "step-1",
        label: "Published",
        body: "Final version shipped with supporting screenshots and email CTA.",
        actionLabel: "review",
      },
    ],
  },
  {
    id: "idea-10",
    code: "#0084",
    hook: "The AI trend take I don't agree with anymore.",
    premise: "Archived opinion piece that no longer matches the current product stance.",
    status: "archived",
    pillar: "Opinion",
    channels: ["LinkedIn"],
    tags: ["llm"],
    score: 5.2,
    ageLabel: "Mar 28",
    source: "archive → 2026-03-28",
    sourceType: "human",
    scoreBreakdown: "hook · 6 / proof · 4 / fit · 5",
    hooks: ["I don't think this trend deserves the heat it gets anymore."],
    activeHookIndex: 0,
    scriptSteps: [
      {
        id: "step-1",
        label: "Archived",
        body: "Retired after the product and audience focus shifted.",
        actionLabel: "restore",
      },
    ],
  },
];

const AI_QUICK_ACTIONS = [
  "Score against audience",
  "Suggest tags",
  "Outline script",
  "Repurpose for LinkedIn",
  "Find related in my notes",
];

const DEFAULT_PROMPT =
  "Brainstorm 10 ideas about indie hackers shipping AI tools — tone: candid, punchy";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

export type ContentPlannerControls = {
  layout: ContentPlannerLayout;
  setLayout: StateSetter<ContentPlannerLayout>;
  density: ContentPlannerDensity;
  setDensity: StateSetter<ContentPlannerDensity>;
  viewMode: ContentPlannerViewMode;
  setViewMode: StateSetter<ContentPlannerViewMode>;
  demoState: ContentPlannerDemoState;
  setDemoState: StateSetter<ContentPlannerDemoState>;
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
};

type ContentPlannerViewProps = {
  controls?: ContentPlannerControls;
};

function titleCaseStatus(status: ContentPlannerStatus) {
  return STATUS_LABELS[status];
}

function buildStatusOptions(): FilterOption[] {
  return [{ label: "All", value: "all" }].concat(
    STATUS_ORDER.map((status) => ({
      label: titleCaseStatus(status),
      value: status,
    })),
  );
}

function buildOptions(ideas: readonly ContentIdea[], getValue: (idea: ContentIdea) => string | string[]) {
  const counts = new Map<string, number>();

  ideas.forEach((idea) => {
    const values = getValue(idea);
    const list = Array.isArray(values) ? values : [values];
    list.forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
    .map(([label]) => ({ label, value: label }));
}

function formatCountLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function statusPill(status: ContentPlannerStatus) {
  return STATUS_STYLES[status];
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

export function ContentPlannerView({ controls }: ContentPlannerViewProps) {
  const [localLayout] = useState<ContentPlannerLayout>("split");
  const [localDensity] = useState<ContentPlannerDensity>("comfortable");
  const [localViewMode, setLocalViewMode] = useState<ContentPlannerViewMode>("list");
  const [localDemoState] = useState<ContentPlannerDemoState>("populated");
  const [localShowLlmPanel] = useState(true);
  const [localStatusFilter] = useState<string>("all");
  const [localPillarFilter] = useState<string>("all");
  const [localChannelFilter] = useState<string>("all");
  const [localTagFilter] = useState<string>("all");
  const [selectedIdeaId, setSelectedIdeaId] = useState<string>(IDEAS[0]?.id ?? "");

  const layout = controls?.layout ?? localLayout;
  const density = controls?.density ?? localDensity;
  const viewMode = controls?.viewMode ?? localViewMode;
  const setViewMode = controls?.setViewMode ?? setLocalViewMode;
  const demoState = controls?.demoState ?? localDemoState;
  const showLlmPanel = controls?.showLlmPanel ?? localShowLlmPanel;
  const statusFilter = controls?.statusFilter ?? localStatusFilter;
  const pillarFilter = controls?.pillarFilter ?? localPillarFilter;
  const channelFilter = controls?.channelFilter ?? localChannelFilter;
  const tagFilter = controls?.tagFilter ?? localTagFilter;

  const ideasByMetaFilters = useMemo(
    () =>
      IDEAS.filter(
        (idea) =>
          matchesPillar(idea, pillarFilter) &&
          matchesChannel(idea, channelFilter) &&
          matchesTag(idea, tagFilter),
      ),
    [channelFilter, pillarFilter, tagFilter],
  );

  const filteredIdeas = useMemo(
    () =>
      ideasByMetaFilters.filter((idea) =>
        statusFilter === "all" ? true : idea.status === statusFilter,
      ),
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

  const selectedIdea = useMemo(
    () => filteredIdeas.find((idea) => idea.id === selectedIdeaId) ?? filteredIdeas[0] ?? null,
    [filteredIdeas, selectedIdeaId],
  );

  const totalIdeas = IDEAS.length;
  const draftingCount = IDEAS.filter((idea) =>
    idea.status === "curating" || idea.status === "outlined",
  ).length;
  const scriptedCount = IDEAS.filter((idea) => idea.status === "scripted").length;
  const effectiveView = layout === "kanban" ? "kanban" : viewMode;
  const showRightPane = demoState === "populated" && layout !== "kanban" && Boolean(selectedIdea);

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
              <h1 className="text-lg font-semibold text-[var(--ink-900)] md:text-xl">
                Content Planner
              </h1>
              <span className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 font-mono text-[11px] text-[var(--ink-700)]">
                {totalIdeas} ideas · {draftingCount} drafting · {scriptedCount} scripted
              </span>
            </div>

            <div className="rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--line)_86%,var(--brand))] bg-[var(--paper)] p-3 shadow-[var(--surface-shadow)]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand)]">
                  ✦
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm leading-6 text-[var(--ink-700)]">
                    {DEFAULT_PROMPT}
                    <span className="ml-1 inline-block h-3.5 w-px animate-pulse bg-[var(--ink-700)] align-middle" />
                  </p>
                </div>
                <span className="rounded-md border border-[var(--line)] bg-[var(--paper-strong)] px-2 py-1 font-mono text-[10px] text-[var(--ink-500)]">
                  ⌘ K
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt, index) => (
                <button
                  key={prompt}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
                    index === 0
                      ? "border-[color:color-mix(in_srgb,var(--brand)_28%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand-soft)_72%,var(--paper-strong))] text-[var(--ink-900)] hover:bg-[color:color-mix(in_srgb,var(--brand-soft)_82%,var(--paper-strong))]"
                      : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink-700)] hover:border-[color:color-mix(in_srgb,var(--brand)_26%,var(--line))] hover:text-[var(--ink-900)]",
                  )}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:items-end">
            <button
              type="button"
              className="rounded-lg border border-[var(--brand)] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[color:color-mix(in_srgb,var(--brand)_90%,black)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              Generate →
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              Prompt library
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
              <div className="flex h-12 min-w-[220px] flex-1 items-center rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-4 font-mono text-xs text-[var(--ink-500)]">
                search ideas, hooks, tags…
              </div>
            <button
              type="button"
              className="inline-flex h-12 items-center rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--brand)_24%,var(--line))] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              Sort: Score ↓
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--brand)_24%,var(--line))] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              Filter
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--brand)_24%,var(--line))] hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              Bulk select
            </button>
            </div>
          </div>

          {demoState === "empty" ? (
            <div
              className="grid h-full min-h-[360px] place-items-center"
              data-testid="content-planner-empty-state"
            >
              <div className="max-w-xl rounded-3xl border border-dashed border-[color:color-mix(in_srgb,var(--line)_86%,var(--brand))] bg-[var(--paper-strong)] px-6 py-8 text-center shadow-[var(--surface-shadow)]">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-500)]">
                  Your content inbox
                </p>
                <h2 className="mt-2 text-lg font-semibold text-[var(--ink-900)]">
                  No ideas yet. Ask the AI to spark a few.
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--ink-700)]">
                  Type a topic, paste a transcript, or point at your notes. The planner fills up
                  from there, then you curate, shape, and ship.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <TagButton active label="Brainstorm 10 ideas" onClick={() => undefined} />
                  <TagButton label="From my notes" onClick={() => undefined} />
                  <TagButton label="Paste a transcript" onClick={() => undefined} />
                </div>
              </div>
            </div>
          ) : effectiveView === "kanban" ? (
            <div
              className="content-planner-kanban"
              data-testid="content-planner-kanban"
            >
              {STATUS_ORDER.map((status) => {
                const ideas = ideasByMetaFilters.filter((idea) =>
                  statusFilter === "all" ? idea.status === status : idea.status === statusFilter && idea.status === status,
                );
                return (
                  <div
                    key={status}
                    className="min-h-[320px] rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--line)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--paper)_82%,var(--paper-strong))] p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]">
                        {titleCaseStatus(status)}
                      </p>
                      <span className="font-mono text-[11px] text-[var(--ink-500)]">
                        {ideas.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {ideas.map((idea) => (
                        <button
                          key={idea.id}
                          type="button"
                          onClick={() => setSelectedIdeaId(idea.id)}
                          className={cn(
                            "block w-full rounded-xl border bg-[var(--paper-strong)] p-3 text-left shadow-[var(--surface-shadow)] transition-colors duration-150 hover:border-[color:color-mix(in_srgb,var(--brand)_24%,var(--line))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
                            selectedIdea?.id === idea.id
                              ? "border-[var(--brand)]"
                              : "border-[var(--line)]",
                          )}
                        >
                          <p className="text-sm font-semibold leading-5 text-[var(--ink-900)]">
                            {idea.hook}
                          </p>
                          <p className="mt-2 text-[11px] text-[var(--ink-500)]">
                            {idea.channels[0]} · {idea.score.toFixed(1)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : effectiveView === "grid" ? (
            <div
              className="rounded-3xl border border-dashed border-[color:color-mix(in_srgb,var(--line)_84%,var(--brand))] bg-[var(--paper-strong)] p-6 text-sm text-[var(--ink-700)] shadow-[var(--surface-shadow)]"
              data-testid="content-planner-grid-placeholder"
            >
              Grid view placeholder — same ideas laid out two-up after the list and kanban pass is
              approved.
            </div>
          ) : (
            <div className="space-y-6" data-testid="content-planner-list">
              {groupedIdeas.map(({ status, ideas }) =>
                ideas.length > 0 ? (
                  <section key={status}>
                    <div className="mb-3 flex items-center gap-3 px-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]">
                        {titleCaseStatus(status)}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--ink-500)]">
                        {formatCountLabel(ideas.length, "idea")}
                      </span>
                      <span className="h-px flex-1 bg-[var(--line)]" />
                      {status === "inbox" ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-[var(--ink-700)] transition-colors duration-150 hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                        >
                          Rank with AI ✦
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {ideas.map((idea) => (
                        <IdeaCard
                          key={idea.id}
                          compact={density === "compact"}
                          idea={idea}
                          selected={selectedIdea?.id === idea.id}
                          onSelect={() => setSelectedIdeaId(idea.id)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null,
              )}
            </div>
          )}
        </section>

        {showRightPane ? (
          <aside
            className="content-planner-pane-right border-l border-dashed border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_76%,var(--paper))] p-4"
            data-testid="content-planner-detail-pane"
          >
            {selectedIdea ? <IdeaDetail idea={selectedIdea} showLlmPanel={showLlmPanel} /> : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}

export function ContentPlannerSidebarPanels({ controls }: { controls: ContentPlannerControls }) {
  const statusOptions = useMemo(() => buildStatusOptions(), []);
  const pillarOptions = useMemo(() => buildOptions(IDEAS, (idea) => idea.pillar), []);
  const channelOptions = useMemo(() => buildOptions(IDEAS, (idea) => idea.channels), []);
  const tagOptions = useMemo(() => buildOptions(IDEAS, (idea) => idea.tags), []);
  const totalIdeas = IDEAS.length;

  const ideasByMetaFilters = useMemo(
    () =>
      IDEAS.filter(
        (idea) =>
          matchesPillar(idea, controls.pillarFilter) &&
          matchesChannel(idea, controls.channelFilter) &&
          matchesTag(idea, controls.tagFilter),
      ),
    [controls.channelFilter, controls.pillarFilter, controls.tagFilter],
  );

  return (
    <div className="flex min-h-full flex-col pb-3">
      <div className="flex-1 border-y border-[color:color-mix(in_srgb,var(--line)_82%,transparent)] bg-[color:color-mix(in_srgb,var(--paper-strong)_30%,transparent)] px-3 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]">
          Filters
        </p>
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
            counts={IDEAS.reduce<Record<string, number>>(
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
            counts={IDEAS.reduce<Record<string, number>>(
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
              <TagButton
                active={controls.tagFilter === "all"}
                label="All"
                onClick={() => controls.setTagFilter("all")}
              />
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
        </div>
      </div>

    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ink-500)]">
      {title}
    </p>
  );
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
            <span className="font-mono text-[11px] text-[var(--ink-500)]">
              {counts[option.value] ?? 0}
            </span>
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
      className={cn(
        "group grid w-full grid-cols-[14px_minmax(0,1fr)_auto] gap-3 rounded-2xl border bg-[var(--paper-strong)] p-4 text-left shadow-[var(--surface-shadow)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
        selected
          ? "border-[var(--brand)]"
          : "border-[var(--line)] hover:border-[color:color-mix(in_srgb,var(--brand)_22%,var(--line))]",
        compact && "gap-2 px-3 py-2.5",
      )}
    >
      <span
        className={cn(
          "mt-1 h-6 w-1 rounded-full",
          statusStyle.railClassName,
          compact && "h-5",
        )}
      />
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-semibold leading-5 text-[var(--ink-900)]",
            compact && "text-[13px]",
          )}
        >
          {idea.hook}
        </p>
        {!compact ? (
          <p className="mt-1.5 text-sm leading-6 text-[var(--ink-700)]">{idea.premise}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-500)]">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono uppercase tracking-[0.08em]",
              statusStyle.pillClassName,
            )}
          >
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
        <span className="font-mono text-[10px] text-[var(--ink-500)]">{idea.ageLabel}</span>
      </div>
    </button>
  );
}

function IdeaDetail({
  idea,
  showLlmPanel,
}: {
  idea: ContentIdea;
  showLlmPanel: boolean;
}) {
  const statusStyle = statusPill(idea.status);

  return (
    <div className="space-y-5">
      <div className="border-b border-dashed border-[var(--line)] pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-500)]">
          Idea · {idea.code}
        </p>
        <h2 className="mt-2 text-xl font-semibold leading-7 text-[var(--ink-900)]">
          {idea.hook}
        </h2>
        <dl className="mt-4 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
            Status
          </dt>
          <dd className="flex flex-wrap items-center gap-2 text-[var(--ink-900)]">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]",
                statusStyle.pillClassName,
              )}
            >
              {titleCaseStatus(idea.status)}
            </span>
            <span className="font-mono text-[11px] text-[var(--ink-500)]">▸ move to Curating</span>
          </dd>

          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
            Pillar
          </dt>
          <dd>
            <InlineChip>{idea.pillar}</InlineChip>
          </dd>

          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
            Channel
          </dt>
          <dd className="flex flex-wrap gap-2">
            {idea.channels.map((channel) => (
              <InlineChip key={channel}>{channel}</InlineChip>
            ))}
          </dd>

          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
            Tags
          </dt>
          <dd className="flex flex-wrap gap-2">
            {idea.tags.map((tag) => (
              <TagButton key={tag} label={tag} onClick={() => undefined} />
            ))}
            <InlineChip>+ add</InlineChip>
          </dd>

          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
            Score
          </dt>
          <dd className="flex flex-wrap items-center gap-2 text-[var(--ink-900)]">
            <span className="rounded-md bg-[color:color-mix(in_srgb,var(--paper)_62%,var(--paper-strong))] px-2 py-1 font-mono text-[11px] text-[var(--ink-700)]">
              {idea.score.toFixed(1)}
            </span>
            <span className="font-mono text-[10px] text-[var(--ink-500)]">{idea.scoreBreakdown}</span>
          </dd>

          <dt className="pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)]">
            Source
          </dt>
          <dd className="font-mono text-[11px] text-[var(--ink-500)]">{idea.source}</dd>
        </dl>
      </div>

      <DetailSection title="Hook variations" actionLabel="✦ Generate 4 more">
        <div className="space-y-2">
          {idea.hooks.map((hook, index) => (
            <div
              key={`${idea.id}-hook-${index + 1}`}
              className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-2.5"
            >
              <span className="pt-0.5 font-mono text-[10px] text-[var(--ink-500)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="flex-1 text-sm leading-5 text-[var(--ink-900)]">{hook}</p>
              <div className="flex gap-1">
                <MiniButton active={index === idea.activeHookIndex}>use</MiniButton>
                <MiniButton>×</MiniButton>
              </div>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="Script structure" actionLabel="✦ Draft outline">
        <div className="space-y-2">
          {idea.scriptSteps.map((step, index) => (
            <div
              key={step.id}
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] px-3 py-3"
            >
              <span className="self-center text-center font-mono text-[11px] text-[var(--ink-500)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--ink-900)]">{step.label}</p>
                <p
                  className={cn(
                    "mt-1 text-sm leading-6 text-[var(--ink-700)]",
                    step.placeholder && "italic text-[var(--ink-500)]",
                  )}
                >
                  {step.body}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <MiniButton active>{`✦ ${step.actionLabel}`}</MiniButton>
                <MiniButton>↕</MiniButton>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-1 text-center">
          <button
            type="button"
            className="text-sm text-[var(--ink-700)] transition-colors duration-150 hover:text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            + Add section
          </button>
        </div>
      </DetailSection>

      {showLlmPanel ? (
        <DetailSection title="✦ Ask AI about this idea">
          <div className="rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--line)_84%,var(--brand))] bg-[color:color-mix(in_srgb,var(--brand-soft)_34%,var(--paper-strong))] p-3">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]">
              Quick actions
            </p>
            <div className="flex flex-wrap gap-2">
              {AI_QUICK_ACTIONS.map((action) => (
                <TagButton key={action} label={action} onClick={() => undefined} />
              ))}
            </div>
            <div className="mt-3 rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--line)_84%,var(--brand))] bg-[var(--paper)] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand)]">
                  ✦
                </div>
                <p className="flex-1 font-mono text-sm text-[var(--ink-500)]">
                  Ask anything about this idea…
                  <span className="ml-1 inline-block h-3.5 w-px animate-pulse bg-[var(--ink-700)] align-middle" />
                </p>
                <span className="rounded-md border border-[var(--line)] bg-[var(--paper-strong)] px-2 py-1 font-mono text-[10px] text-[var(--ink-500)]">
                  ↵
                </span>
              </div>
            </div>
          </div>
        </DetailSection>
      ) : null}
    </div>
  );
}

function DetailSection({
  title,
  actionLabel,
  children,
}: {
  title: string;
  actionLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-700)]">
          {title}
        </p>
        <span className="h-px flex-1 bg-[var(--line)]" />
        {actionLabel ? (
          <button
            type="button"
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
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
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

function InlineChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-lg border border-dashed border-[color:color-mix(in_srgb,var(--line)_82%,var(--brand))] bg-[var(--paper-strong)] px-2.5 py-1 text-xs text-[var(--ink-700)]">
      {children}
    </span>
  );
}
