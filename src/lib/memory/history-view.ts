import { changedFields } from "@/lib/change-log";
import type { ChangeEntityKind, ChangeLogEntry } from "@/lib/types";
import { changeStatus, type HistoryState } from "./app-history";
import { dayInZone } from "./dates";

/**
 * What the History page shows: one row per batch (one tool call or one click),
 * in plain words, newest first, grouped by day. Undo and redo entries aren't
 * rows of their own; they show as the original row's "undone" state.
 */

export type HistoryRow = {
  /** The newest entry of the batch; undo / redo take this id. */
  changeId: string;
  batchId: string;
  at: string;
  /** "You", "Claude", "ChatGPT" or "An AI chat". */
  who: string;
  text: string;
  /** Other changes in the same batch, in plain words. */
  more: string[];
  where: { label: string; href: string } | null;
  status: "live" | "undone";
};

export type HistoryDay = { day: string; rows: HistoryRow[] };

export function sourceLabel(source: string): string {
  const lower = source.toLowerCase();
  if (lower === "app" || lower === "") return "You";
  if (lower.includes("claude")) return "Claude";
  if (lower.includes("chatgpt") || lower.includes("openai")) return "ChatGPT";
  return "An AI chat";
}

type RecordLike = Record<string, unknown>;

const asRecord = (value: unknown): RecordLike | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : null;

function quoted(value: unknown): string {
  const record = asRecord(value);
  for (const key of ["title", "name", "what", "text"]) {
    const label = record?.[key];
    if (typeof label === "string" && label.trim()) {
      const clean = label.trim().replace(/\s+/g, " ");
      return `“${clean.length > 60 ? `${clean.slice(0, 57)}…` : clean}”`;
    }
  }
  return "";
}

const NOUNS: Record<ChangeEntityKind, string> = {
  task: "task",
  decision: "decision",
  project: "project",
  meeting: "meeting notes",
  follow_up: "follow-up",
  repeat: "repeat",
  content_card: "video",
  content_board: "content board",
  app_note: "app note",
};

const FIELD_WORDS: Record<string, string> = {
  title: "title",
  notes: "notes",
  area: "life area",
  day: "day",
  blockId: "time block",
  projectId: "project",
  tags: "tags",
  link: "link",
  status: "status",
  why: "why",
  whyDecisionId: "why",
  nextStep: "next step",
  state: "where it stands",
  summary: "summary",
  people: "people",
  who: "who",
  what: "what",
  days: "days",
  time: "time",
  active: "on/off",
  revisitOn: "revisit date",
  columnId: "stage",
  order: "order",
  links: "links",
  publishedAt: "publish date",
  seriesId: "series",
  transcript: "transcript",
  columns: "stages",
  series: "series",
  text: "text",
  kind: "type",
};

const BOOKKEEPING = new Set(["doneAt", "replacedById", "updatedAt"]);

function fieldWords(fields: string[]): string {
  const words = [
    ...new Set(
      fields
        .filter((field) => !BOOKKEEPING.has(field))
        .map((field) => FIELD_WORDS[field] ?? field.replace(/([A-Z])/g, " $1").toLowerCase()),
    ),
  ];
  return words.join(", ");
}

function shortDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    date,
  );
}

const CREATED: Partial<Record<ChangeEntityKind, string>> = {
  task: "Added task",
  decision: "Saved decision",
  project: "Added project",
  meeting: "Filed meeting notes",
  follow_up: "Added follow-up",
  repeat: "Added repeat",
  content_card: "Saved video idea",
  app_note: "Saved app note",
};

/** One change in plain words, e.g. `Finished “Send link”` or `Moved “Send link” to the Shelf`. */
export function describeChange(entry: Pick<ChangeLogEntry, "entityKind" | "action" | "before" | "after">): string {
  const noun = NOUNS[entry.entityKind];
  const label = quoted(entry.after) || quoted(entry.before);
  const name = label ? `${noun} ${label}` : `a ${noun}`;
  const before = asRecord(entry.before);
  const after = asRecord(entry.after);

  if (entry.action === "create" || (!before && after)) {
    const verb = CREATED[entry.entityKind] ?? `Added ${noun}`;
    return label ? `${verb} ${label}` : verb;
  }
  if (!after) return `Changed ${name}`;
  if (!before?.deletedAt && after.deletedAt) return `Deleted ${name}`;
  if (before?.deletedAt && !after.deletedAt) return `Brought back ${name}`;
  if (entry.entityKind === "content_board") return "Changed the content board";

  const fields = changedFields(before, after);
  const what = label || `the ${noun}`;
  if (fields.includes("status")) {
    if (entry.entityKind === "task" && after.status === "done") return `Finished ${what}`;
    if (entry.entityKind === "task" && after.status === "open") return `Reopened ${what}`;
    if (entry.entityKind === "follow_up" && after.status === "done") return `Resolved follow-up ${what}`;
    if (entry.entityKind === "decision") return `Marked decision ${what} as ${String(after.status)}`;
  }
  if (entry.entityKind === "task" && (fields.includes("day") || fields.includes("blockId"))) {
    const day = typeof after.day === "string" ? after.day : null;
    return day ? `Planned ${what} for ${shortDay(day)}` : `Moved ${what} to the Shelf`;
  }
  if (entry.entityKind === "content_card" && fields.includes("columnId")) return `Moved video ${what} to another stage`;
  const words = fieldWords(fields);
  return words ? `Changed the ${words} of ${name}` : `Saved ${name} (no change)`;
}

function whereFor(kind: ChangeEntityKind): HistoryRow["where"] {
  if (kind === "task" || kind === "repeat") return { label: "Today", href: "/today" };
  if (kind === "content_card" || kind === "content_board") return { label: "Content", href: "/content-planner" };
  return null;
}

/** History rows, newest first, grouped by the user's day. */
export function buildHistory(state: HistoryState, timeZone: string): HistoryDay[] {
  const batches = new Map<string, ChangeLogEntry[]>();
  for (const entry of Object.values(state.changeLog)) {
    if (entry.action === "undo" || entry.action === "redo") continue;
    const list = batches.get(entry.batchId);
    if (list) list.push(entry);
    else batches.set(entry.batchId, [entry]);
  }

  const rows: HistoryRow[] = [...batches.values()].map((entries) => {
    const sorted = entries.toSorted((left, right) => left.id.localeCompare(right.id));
    const first = sorted[0];
    const newest = sorted[sorted.length - 1];
    const texts = [...new Set(sorted.map(describeChange))];
    return {
      changeId: newest.id,
      batchId: first.batchId,
      at: newest.at,
      who: sourceLabel(first.source),
      text: texts[0],
      more: texts.slice(1),
      where: whereFor(first.entityKind),
      status: changeStatus(state, newest.id),
    };
  });

  const days = new Map<string, HistoryRow[]>();
  for (const row of rows.toSorted((left, right) => right.changeId.localeCompare(left.changeId))) {
    const day = dayInZone(row.at, timeZone);
    const list = days.get(day);
    if (list) list.push(row);
    else days.set(day, [row]);
  }
  return [...days.entries()].map(([day, dayRows]) => ({ day, rows: dayRows }));
}
