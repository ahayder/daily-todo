import { buildChange, canRedo, canUndo, makeBatchId, redoTarget, sameRecord, undoTarget } from "@/lib/change-log";
import type {
  AppNote,
  AppState,
  ChangeEntityKind,
  ChangeLogEntry,
  ContentBoard,
  ContentCard,
  MemoryKind,
  MemoryKindMap,
} from "@/lib/types";
import { MEMORY_KINDS } from "@/lib/types";

/**
 * App-side writes with history, and undo / redo ("Bring back") from the app.
 * Same rules as the MCP server (mcp-server/src/history.ts): every write logs a
 * change_log entry, one user action is one batch, and undo / redo work on a
 * whole batch, all or nothing, refusing when a record changed again since.
 */

export type HistoryState = Pick<AppState, "memory" | "changeLog" | "contentCards" | "contentBoard" | "appNotes">;

export type RecordWrite = { kind: ChangeEntityKind; id: string; value: unknown };

/** The content board's entity id in the change log. */
export const BOARD_ID = "board";
const UNDOABLE = new Set(["create", "update", "delete", "restore"]);

const isMemoryKind = (kind: ChangeEntityKind): kind is MemoryKind =>
  (MEMORY_KINDS as readonly string[]).includes(kind);

export function currentValue(state: HistoryState, kind: ChangeEntityKind, id: string): unknown {
  if (kind === "content_card") return state.contentCards[id] ?? null;
  if (kind === "content_board") return state.contentBoard;
  if (kind === "app_note") return state.appNotes[id] ?? null;
  if (isMemoryKind(kind)) return state.memory[kind][id] ?? null;
  return null;
}

function writeValue<S extends HistoryState>(state: S, kind: ChangeEntityKind, id: string, value: unknown): S {
  if (kind === "content_card") return { ...state, contentCards: { ...state.contentCards, [id]: value as ContentCard } };
  if (kind === "content_board") return { ...state, contentBoard: value as ContentBoard };
  if (kind === "app_note") return { ...state, appNotes: { ...state.appNotes, [id]: value as AppNote } };
  if (isMemoryKind(kind)) {
    return {
      ...state,
      memory: { ...state.memory, [kind]: { ...state.memory[kind], [id]: value as MemoryKindMap[MemoryKind] } },
    };
  }
  return state;
}

function appendEntries<S extends HistoryState>(state: S, entries: ChangeLogEntry[]): S {
  if (entries.length === 0) return state;
  const changeLog = { ...state.changeLog };
  for (const entry of entries) changeLog[entry.id] = entry;
  return { ...state, changeLog };
}

/**
 * Writes records as one batch and logs each change. Writes that change
 * nothing are skipped; with nothing changed the same state comes back.
 */
export function writeWithHistory<S extends HistoryState>(
  state: S,
  writes: RecordWrite[],
  options: { source?: string; batchId?: string; now?: Date } = {},
): S {
  const batchId = options.batchId ?? makeBatchId();
  const now = options.now ?? new Date();
  let next = state;
  const entries: ChangeLogEntry[] = [];
  for (const { kind, id, value } of writes) {
    const before = currentValue(next, kind, id);
    if (before === value) continue;
    next = writeValue(next, kind, id, value);
    entries.push(
      buildChange({ batchId, entityKind: kind, entityId: id, before, after: value, source: options.source ?? "app", now }),
    );
  }
  return appendEntries(next, entries);
}

/** Writes the records of `after` that differ from `before` (same map = no change). */
export function memoryWrites<K extends MemoryKind>(
  kind: K,
  before: Record<string, MemoryKindMap[K]>,
  after: Record<string, MemoryKindMap[K]>,
): RecordWrite[] {
  if (before === after) return [];
  return Object.entries(after)
    .filter(([id, value]) => before[id] !== value)
    .map(([id, value]) => ({ kind, id, value }));
}

export type HistoryCheck = { ok: true } | { ok: false; reason: string };

type Plan = { entry: ChangeLogEntry; current: unknown; target: Record<string, unknown> };

const entriesOf = (state: HistoryState) => Object.values(state.changeLog);

/** Per record: the oldest and newest entry of a batch, oldest record first. */
function groupByRecord(entries: ChangeLogEntry[]) {
  const groups = new Map<string, { first: ChangeLogEntry; last: ChangeLogEntry }>();
  for (const entry of entries.toSorted((left, right) => left.id.localeCompare(right.id))) {
    const key = `${entry.entityKind}:${entry.entityId}`;
    const group = groups.get(key);
    if (group) group.last = entry;
    else groups.set(key, { first: entry, last: entry });
  }
  return [...groups.values()];
}

const CHANGED_SINCE = "It was changed again since, so this would overwrite newer work.";

function planUndo(state: HistoryState, changeId: string, now: Date): { plans: Plan[] } | { reason: string } {
  const entry = state.changeLog[changeId];
  if (!entry) return { reason: "That change isn't loaded on this device." };
  if (!UNDOABLE.has(entry.action)) return { reason: "That change is already an undo or a redo." };
  const batch = entriesOf(state).filter((item) => item.batchId === entry.batchId && UNDOABLE.has(item.action));
  const plans: Plan[] = [];
  for (const { first, last } of groupByRecord(batch)) {
    const combined = { ...last, before: first.before };
    const current = currentValue(state, last.entityKind, last.entityId);
    const check = canUndo(current, combined);
    if (!check.ok) {
      return {
        reason: sameRecord(current, combined.after)
          ? "Something new in this change can't be removed (nothing is ever deleted)."
          : CHANGED_SINCE,
      };
    }
    plans.push({ entry: last, current, target: undoTarget(combined, now) });
  }
  return { plans: plans.toReversed() };
}

/** The undo batch that reversed `changeId`'s batch most recently, if it is still undone. */
function latestUndoBatch(state: HistoryState, changeId: string): string | null {
  const entry = state.changeLog[changeId];
  if (!entry) return null;
  if (entry.action === "undo") return entry.batchId;
  const ids = new Set(entriesOf(state).filter((item) => item.batchId === entry.batchId).map((item) => item.id));
  const reversals = entriesOf(state)
    .filter((item) => (item.action === "undo" || item.action === "redo") && item.refChangeId && ids.has(item.refChangeId))
    .toSorted((left, right) => right.id.localeCompare(left.id));
  return reversals[0]?.action === "undo" ? reversals[0].batchId : null;
}

function planRedo(state: HistoryState, changeId: string, now: Date): { plans: Plan[] } | { reason: string } {
  const undoBatchId = latestUndoBatch(state, changeId);
  if (!undoBatchId) return { reason: "That change hasn't been undone." };
  const undos = entriesOf(state).filter((item) => item.batchId === undoBatchId && item.action === "undo");
  const plans: Plan[] = [];
  for (const undo of undos) {
    const current = currentValue(state, undo.entityKind, undo.entityId);
    if (!canRedo(current, undo).ok) return { reason: CHANGED_SINCE };
    plans.push({ entry: undo, current, target: redoTarget(undo, now) });
  }
  return { plans };
}

/** "live" (can be undone) or "undone" (can be brought back), for a batch's change. */
export function changeStatus(state: HistoryState, changeId: string): "live" | "undone" {
  return latestUndoBatch(state, changeId) ? "undone" : "live";
}

export function checkUndo(state: HistoryState, changeId: string, now = new Date()): HistoryCheck {
  const plan = planUndo(state, changeId, now);
  return "reason" in plan ? { ok: false, reason: plan.reason } : { ok: true };
}

export function checkRedo(state: HistoryState, changeId: string, now = new Date()): HistoryCheck {
  const plan = planRedo(state, changeId, now);
  return "reason" in plan ? { ok: false, reason: plan.reason } : { ok: true };
}

function applyPlans<S extends HistoryState>(
  state: S,
  plans: Plan[],
  action: "undo" | "redo",
  options: { source?: string; now?: Date },
): S {
  const batchId = makeBatchId();
  const now = options.now ?? new Date();
  let next = state;
  const entries: ChangeLogEntry[] = [];
  for (const { entry, current, target } of plans) {
    next = writeValue(next, entry.entityKind, entry.entityId, target);
    entries.push(
      buildChange({
        batchId,
        entityKind: entry.entityKind,
        entityId: entry.entityId,
        before: current,
        after: target,
        source: options.source ?? "app",
        action,
        // A redo points at the original change, like the MCP server.
        refChangeId: action === "undo" ? entry.id : entry.refChangeId,
        now,
      }),
    );
  }
  return appendEntries(next, entries);
}

/** Undo the whole batch of `changeId`; the same state back when it can't. */
export function undoChange<S extends HistoryState>(
  state: S,
  changeId: string,
  options: { source?: string; now?: Date } = {},
): S {
  const plan = planUndo(state, changeId, options.now ?? new Date());
  return "reason" in plan ? state : applyPlans(state, plan.plans, "undo", options);
}

/** Bring back an undone batch; the same state back when it can't. */
export function redoChange<S extends HistoryState>(
  state: S,
  changeId: string,
  options: { source?: string; now?: Date } = {},
): S {
  const plan = planRedo(state, changeId, options.now ?? new Date());
  return "reason" in plan ? state : applyPlans(state, plan.plans, "redo", options);
}
