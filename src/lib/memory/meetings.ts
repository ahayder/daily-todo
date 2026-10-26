import type { Meeting } from "@/lib/types";
import { cleanList, newRecordBase } from "./records";

export type MeetingInput = {
  title: string;
  date: string;
  summary?: string;
  projectId?: string | null;
  people?: string[];
  tags?: string[];
  transcript?: string;
  /** Keep the raw transcript too. Off by default: summaries only, for privacy. */
  storeTranscript?: boolean;
};

/** A new meeting record, or null when the title is blank. */
export function createMeeting(input: MeetingInput, now = new Date()): Meeting | null {
  const title = input.title.trim();
  if (!title) return null;
  return {
    ...newRecordBase("meeting", input.tags, now),
    title,
    date: input.date,
    projectId: input.projectId ?? null,
    summary: input.summary?.trim() ?? "",
    people: cleanList(input.people),
    transcript: input.storeTranscript ? (input.transcript ?? "") : "",
  };
}
