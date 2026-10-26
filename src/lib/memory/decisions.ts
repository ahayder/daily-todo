import type { Decision, DecisionStatus } from "@/lib/types";
import { cleanList, cleanTags, newRecordBase, patchRecord, liveRecords } from "./records";

export type DecisionInput = {
  title: string;
  why?: string;
  status?: DecisionStatus;
  source?: string;
  people?: string[];
  projectId?: string | null;
  tags?: string[];
  /** The decision this one replaces; it gets marked replaced. */
  replacesId?: string | null;
  revisitOn?: string | null;
  decidedOn?: string | null;
};

/** A new decision, or null when the title is blank. Proposed until said otherwise. */
export function createDecision(input: DecisionInput, now = new Date()): Decision | null {
  const title = input.title.trim();
  if (!title) return null;
  return {
    ...newRecordBase("decision", input.tags, now),
    title,
    why: input.why?.trim() ?? "",
    status: input.status ?? "proposed",
    source: input.source?.trim() ?? "",
    people: cleanList(input.people),
    projectId: input.projectId ?? null,
    replacesId: input.replacesId ?? null,
    replacedById: null,
    revisitOn: input.revisitOn ?? null,
    decidedOn: input.decidedOn ?? null,
  };
}

/**
 * Log a decision. When it replaces an older one, the old one is marked
 * `replacedById` (kept, never deleted) so the chain can be followed both ways.
 */
export function logDecision(
  decisions: Record<string, Decision>,
  input: DecisionInput,
  now = new Date(),
): { decisions: Record<string, Decision>; created: Decision | null } {
  const replaced = input.replacesId ? decisions[input.replacesId] : undefined;
  const created = createDecision({ ...input, replacesId: replaced?.id ?? null }, now);
  if (!created) return { decisions, created: null };
  let next = { ...decisions, [created.id]: created };
  if (replaced) next = patchRecord(next, replaced.id, { replacedById: created.id }, now);
  return { decisions: next, created };
}

export function updateDecision(
  decisions: Record<string, Decision>,
  decisionId: string,
  updates: Partial<Pick<Decision, "title" | "why" | "status" | "source" | "people" | "projectId" | "tags" | "revisitOn" | "decidedOn">>,
  now = new Date(),
): Record<string, Decision> {
  return patchRecord(
    decisions,
    decisionId,
    {
      ...updates,
      title: updates.title?.trim() || undefined,
      people: updates.people ? cleanList(updates.people) : undefined,
      tags: updates.tags ? cleanTags(updates.tags) : undefined,
    },
    now,
  );
}

/** Decisions still in force: not deleted and not replaced. */
export function currentDecisions(decisions: Record<string, Decision>): Decision[] {
  return liveRecords(decisions).filter((decision) => decision.replacedById === null);
}

/** The full replace chain a decision is part of, oldest first. */
export function decisionChain(decisions: Record<string, Decision>, decisionId: string): Decision[] {
  let first = decisions[decisionId];
  if (!first) return [];
  const seen = new Set([first.id]);
  while (first.replacesId && decisions[first.replacesId] && !seen.has(first.replacesId)) {
    first = decisions[first.replacesId];
    seen.add(first.id);
  }
  const chain = [first];
  let current = first;
  while (current.replacedById && decisions[current.replacedById] && !chain.includes(decisions[current.replacedById])) {
    current = decisions[current.replacedById];
    chain.push(current);
  }
  return chain;
}
