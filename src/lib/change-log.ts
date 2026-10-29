import type { ChangeAction, ChangeEntityKind, ChangeLogEntry } from "@/lib/types";

/**
 * The change log behind History and undo. Every write records the record's
 * full before and after state, so a change can be undone (back to "before")
 * and redone (forward to "after"). Undo and redo refuse when the record was
 * changed again since, so they never overwrite newer work.
 */

let changeCounter = 0;

/** Change ids sort in the order they were made (time, then a counter). */
export function makeChangeId(now = new Date()): string {
  changeCounter = (changeCounter + 1) % 10_000;
  const time = now.getTime().toString(36).padStart(9, "0");
  const random = crypto.randomUUID().slice(0, 6);
  return `chg_${time}${String(changeCounter).padStart(4, "0")}_${random}`;
}

export function makeBatchId(): string {
  return `batch_${crypto.randomUUID()}`;
}

type RecordLike = Record<string, unknown>;

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : null;
}

/** create / update / delete / restore, from the before and after states. */
export function detectAction(before: unknown, after: unknown): ChangeAction {
  const old = asRecord(before);
  const next = asRecord(after);
  if (!old) return "create";
  if (next && !old.deletedAt && next.deletedAt) return "delete";
  if (next && old.deletedAt && !next.deletedAt) return "restore";
  return "update";
}

const IGNORED_FIELDS = new Set(["updatedAt"]);

/** Top-level fields that differ (bookkeeping like updatedAt ignored). */
export function changedFields(before: unknown, after: unknown): string[] {
  const old = asRecord(before) ?? {};
  const next = asRecord(after) ?? {};
  const keys = new Set([...Object.keys(old), ...Object.keys(next)]);
  return [...keys].filter(
    (key) => !IGNORED_FIELDS.has(key) && JSON.stringify(old[key]) !== JSON.stringify(next[key]),
  );
}

/** Same record, ignoring updatedAt. */
export function sameRecord(left: unknown, right: unknown): boolean {
  return changedFields(left, right).length === 0;
}

const KIND_LABELS: Record<ChangeEntityKind, string> = {
  task: "task",
  decision: "decision",
  project: "project",
  meeting: "meeting",
  follow_up: "follow-up",
  repeat: "repeat",
  content_card: "video card",
  content_board: "content board",
  app_note: "change request",
};

function recordLabel(value: unknown): string {
  const record = asRecord(value);
  if (!record) return "";
  for (const key of ["title", "name", "what", "text"]) {
    const label = record[key];
    if (typeof label === "string" && label.trim()) {
      const clean = label.trim().replace(/\s+/g, " ");
      return `"${clean.length > 60 ? `${clean.slice(0, 57)}…` : clean}"`;
    }
  }
  return "";
}

/** One plain-language line, e.g. `Changed task "Send link": day, blockId`. */
export function summarizeChange(input: {
  entityKind: ChangeEntityKind;
  action: ChangeAction;
  before: unknown;
  after: unknown;
}): string {
  const kind = KIND_LABELS[input.entityKind];
  const label = recordLabel(input.after) || recordLabel(input.before);
  const name = label ? `${kind} ${label}` : kind;
  switch (input.action) {
    case "create":
      return `Added ${name}`;
    case "delete":
      return `Deleted ${name}`;
    case "restore":
      return `Brought back ${name}`;
    case "undo":
      return `Undid a change to ${name}`;
    case "redo":
      return `Redid a change to ${name}`;
    case "update": {
      const fields = changedFields(input.before, input.after);
      return fields.length ? `Changed ${name}: ${fields.join(", ")}` : `Saved ${name} (no change)`;
    }
  }
}

export function buildChange(input: {
  batchId: string;
  entityKind: ChangeEntityKind;
  entityId: string;
  before: unknown;
  after: unknown;
  source: string;
  action?: ChangeAction;
  refChangeId?: string | null;
  now?: Date;
}): ChangeLogEntry {
  const now = input.now ?? new Date();
  const action = input.action ?? detectAction(input.before, input.after);
  return {
    id: makeChangeId(now),
    batchId: input.batchId,
    entityKind: input.entityKind,
    entityId: input.entityId,
    action,
    source: input.source,
    summary: summarizeChange({ entityKind: input.entityKind, action, before: input.before, after: input.after }),
    before: input.before ?? null,
    after: input.after ?? null,
    refChangeId: input.refChangeId ?? null,
    at: now.toISOString(),
  };
}

export type UndoCheck = { ok: true } | { ok: false; reason: string };

const UNDOABLE: ChangeAction[] = ["create", "update", "delete", "restore"];

/**
 * Whether `entry` can be undone given the record as it is now. Refuses when
 * the record changed after the entry (someone edited it since).
 */
export function canUndo(current: unknown, entry: ChangeLogEntry): UndoCheck {
  if (!UNDOABLE.includes(entry.action)) {
    return { ok: false, reason: `This is already an ${entry.action}. Use redo_change to re-apply the original.` };
  }
  if (!sameRecord(current, entry.after)) {
    return { ok: false, reason: `${summarizeChange(entry)} — it was changed again since, so undo would overwrite newer work.` };
  }
  if (entry.before === null && !("deletedAt" in (asRecord(entry.after) ?? {}))) {
    return { ok: false, reason: `A new ${KIND_LABELS[entry.entityKind]} can't be removed (nothing is ever deleted).` };
  }
  return { ok: true };
}

/** The state to write to undo `entry`: back to "before", or soft-deleted if it was new. */
export function undoTarget(entry: ChangeLogEntry, now = new Date()): RecordLike {
  const at = now.toISOString();
  const before = asRecord(entry.before);
  if (before) return { ...before, updatedAt: at };
  return { ...asRecord(entry.after), deletedAt: at, updatedAt: at };
}

/** Whether an undo can be redone: the record must still be as the undo left it. */
export function canRedo(current: unknown, undoEntry: ChangeLogEntry): UndoCheck {
  if (undoEntry.action !== "undo") return { ok: false, reason: "Only an undone change can be redone." };
  if (!sameRecord(current, undoEntry.after)) {
    return { ok: false, reason: `${undoEntry.summary} — it was changed again since (or already redone).` };
  }
  return { ok: true };
}

/** The state to write to redo: back to what the record was just before the undo. */
export function redoTarget(undoEntry: ChangeLogEntry, now = new Date()): RecordLike {
  return { ...asRecord(undoEntry.before), updatedAt: now.toISOString() };
}
