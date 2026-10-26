import type { FollowUp } from "@/lib/types";
import { newRecordBase, patchRecord } from "./records";

export type FollowUpInput = {
  what: string;
  who: string;
  since: string;
  projectId?: string | null;
  tags?: string[];
};

/** Something the user is waiting on someone else for, or null when blank. */
export function createFollowUp(input: FollowUpInput, now = new Date()): FollowUp | null {
  const what = input.what.trim();
  if (!what) return null;
  return {
    ...newRecordBase("follow-up", input.tags, now),
    what,
    who: input.who.trim(),
    since: input.since,
    projectId: input.projectId ?? null,
    status: "waiting",
    doneAt: null,
  };
}

export function resolveFollowUp(
  followUps: Record<string, FollowUp>,
  followUpId: string,
  now = new Date(),
): Record<string, FollowUp> {
  if (followUps[followUpId]?.status === "done") return followUps;
  return patchRecord(followUps, followUpId, { status: "done", doneAt: now.toISOString() }, now);
}
