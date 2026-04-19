import {
  createContentIdea,
  createContentIdeaHookVariant,
  createContentIdeaScriptStep,
} from "@/lib/store";
import type { ContentIdea, ContentIdeaHookVariant, ContentIdeaScriptStep } from "@/lib/types";

function clampScore(value: number) {
  return Math.max(5, Math.min(9.8, Number(value.toFixed(1))));
}

function scoreBreakdown(seed: number) {
  return {
    hook: Math.max(6, Math.min(10, Math.round(seed + 1))),
    proof: Math.max(5, Math.min(10, Math.round(seed))),
    fit: Math.max(6, Math.min(10, Math.round(seed + 1.5))),
  };
}

function sentenceFragments(input: string) {
  return input
    .split(/[.\n]/)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
}

export async function generateIdeasFromPrompt(input: { prompt: string }): Promise<ContentIdea[]> {
  const fragments = sentenceFragments(input.prompt);
  const basis = fragments[0] ?? input.prompt.trim() ?? "content idea";
  const topic = basis.replace(/^brainstorm\s+\d+\s+ideas?\s+(about|on)\s+/i, "").trim();
  const sourceLabel = "prompt manual";

  const templates = [
    {
      hook: `The contrarian take on ${topic}`,
      premise: `A practical argument showing why ${topic} works better when stripped to its essentials.`,
      pillar: "Teach",
      channels: ["LinkedIn", "Newsletter"],
      tags: ["strategy", "education"],
      score: 8.4,
    },
    {
      hook: `What ${topic} looked like before it started working`,
      premise: `A build-in-public breakdown of the false starts, course corrections, and proof points behind ${topic}.`,
      pillar: "Build in public",
      channels: ["YouTube long"],
      tags: ["process", "behind-the-scenes"],
      score: 7.9,
    },
    {
      hook: `The metric I watch before investing more in ${topic}`,
      premise: `A proof-led post showing how to decide whether ${topic} is worth doubling down on.`,
      pillar: "Proof",
      channels: ["LinkedIn", "Short video"],
      tags: ["metrics", "validation"],
      score: 8.1,
    },
  ];

  return templates.map((template) =>
    createContentIdea({
      hook: template.hook,
      premise: template.premise,
      pillar: template.pillar,
      channels: template.channels,
      tags: template.tags,
      score: template.score,
      scoreBreakdown: scoreBreakdown(template.score),
      sourceLabel,
      sourceType: "ai",
      hooks: [createContentIdeaHookVariant(template.hook)],
      scriptSteps: [],
    }),
  );
}

export async function generateHookVariants(input: {
  idea: ContentIdea;
}): Promise<ContentIdeaHookVariant[]> {
  const base = input.idea.hook.replace(/[.?!]$/, "");
  return [
    `${base} without the usual fluff.`,
    `Why ${base.charAt(0).toLowerCase()}${base.slice(1)} matters more than people think.`,
    `The field note version of ${base.charAt(0).toLowerCase()}${base.slice(1)}.`,
  ].map((value) => createContentIdeaHookVariant(value));
}

export async function draftOutline(input: {
  idea: ContentIdea;
}): Promise<ContentIdeaScriptStep[]> {
  return [
    createContentIdeaScriptStep({
      label: "Hook",
      body: `Open with the most surprising angle in "${input.idea.hook}".`,
      actionLabel: "rewrite",
    }),
    createContentIdeaScriptStep({
      label: "Context",
      body: "Ground the audience in the problem, the audience, and the current tension.",
      actionLabel: "expand",
    }),
    createContentIdeaScriptStep({
      label: "Proof",
      body: "Add one clear example, metric, or observation that makes the claim believable.",
      actionLabel: "find proof",
      placeholder: true,
    }),
    createContentIdeaScriptStep({
      label: "CTA",
      body: "End with one specific ask that fits the channel.",
      actionLabel: "suggest",
      placeholder: true,
    }),
  ];
}

export async function suggestTags(input: {
  idea: ContentIdea;
}): Promise<string[]> {
  const words = `${input.idea.hook} ${input.idea.premise}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 4);
  const unique = Array.from(new Set(words)).slice(0, 3);
  return unique.length > 0 ? unique : ["content", "strategy"];
}

export async function repurposeIdea(input: {
  idea: ContentIdea;
  channel: string;
}): Promise<{ premise: string; channels: string[]; score: number }> {
  return {
    premise: `${input.idea.premise} Reframed for ${input.channel} with a tighter setup and faster payoff.`,
    channels: Array.from(new Set([...input.idea.channels, input.channel])),
    score: clampScore(input.idea.score + 0.2),
  };
}
