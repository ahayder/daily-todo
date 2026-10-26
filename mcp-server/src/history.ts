import { buildChange, canRedo, canUndo, makeBatchId, redoTarget, undoTarget } from "@/lib/change-log";
import type { AppNote, ChangeEntityKind, ChangeLogEntry, ContentBoard, ContentCard, MemoryKind } from "@/lib/types";
import { MEMORY_KINDS } from "@/lib/types";
import type { AppStore } from "./content-store";
import { ToolError } from "./tools";

/**
 * A store that writes a change_log entry for every save, so every MCP write
 * (content cards, the board, app notes and the external brain) shows up in
 * History and can be undone. One wrapper = one batch (one tool call); undo
 * works on a whole batch so a multi-record change goes back together.
 */
export type HistoryStore = AppStore & {
  batchId: string;
  /** Undo every change in the batch of `changeId`. Refuses if any record changed since. */
  undo(changeId: string): Promise<{ undone: string[] }>;
  /** Re-apply an undone batch (give the undo's id or the original change's id). */
  redo(changeId: string): Promise<{ redone: string[] }>;
};

const BOARD_ID = "board";
const UNDOABLE = new Set(["create", "update", "delete", "restore"]);

export function withHistory(store: AppStore, source: string, batchId = makeBatchId()): HistoryStore {
  // Loaded once per batch and kept current, so a renumbering move that saves
  // several cards doesn't reload every card for each save.
  let cards: Promise<Record<string, ContentCard>> | null = null;
  let appNotes: Promise<Record<string, AppNote>> | null = null;
  const loadCards = () => (cards ??= store.loadCards());
  const loadAppNotes = () => (appNotes ??= store.loadAppNotes());

  async function log(entityKind: ChangeEntityKind, entityId: string, before: unknown, after: unknown, extra = {}) {
    await store.appendChange(buildChange({ batchId, entityKind, entityId, before, after, source, ...extra }));
  }

  async function currentValue(kind: ChangeEntityKind, id: string): Promise<unknown> {
    if (kind === "content_card") return (await store.loadCards())[id] ?? null;
    if (kind === "content_board") return store.loadBoard();
    if (kind === "app_note") return (await store.loadAppNotes())[id] ?? null;
    if ((MEMORY_KINDS as readonly string[]).includes(kind)) return store.getRecord(kind as MemoryKind, id);
    throw new ToolError(`Unknown record kind "${kind}".`);
  }

  // Undo and redo write through the plain store and log their own entry.
  async function writeValue(kind: ChangeEntityKind, value: unknown): Promise<void> {
    if (kind === "content_card") return store.saveCard(value as ContentCard);
    if (kind === "content_board") return store.saveBoard(value as ContentBoard);
    if (kind === "app_note") return store.saveAppNote(value as AppNote);
    return store.saveRecord(kind as MemoryKind, value as never);
  }

  async function requireChange(changeId: string): Promise<ChangeLogEntry> {
    const entry = await store.getChange(changeId.trim());
    if (!entry) throw new ToolError(`No change with id "${changeId}". Use list_changes to see recent changes.`);
    return entry;
  }

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

  return {
    ...store,
    batchId,

    loadCards,
    loadAppNotes,

    async saveCard(card) {
      const before = (await loadCards())[card.id] ?? null;
      await store.saveCard(card);
      cards = loadCards().then((current) => ({ ...current, [card.id]: card }));
      await log("content_card", card.id, before, card);
    },

    async saveBoard(board) {
      const before = await store.loadBoard();
      await store.saveBoard(board);
      await log("content_board", BOARD_ID, before, board);
    },

    async saveAppNote(note) {
      const before = (await loadAppNotes())[note.id] ?? null;
      await store.saveAppNote(note);
      appNotes = loadAppNotes().then((current) => ({ ...current, [note.id]: note }));
      await log("app_note", note.id, before, note);
    },

    async saveRecord(kind, record) {
      const before = await store.getRecord(kind, record.id);
      await store.saveRecord(kind, record);
      await log(kind, record.id, before, record);
    },

    async undo(changeId) {
      const entry = await requireChange(changeId);
      if (!UNDOABLE.has(entry.action)) {
        throw new ToolError(`That change is an ${entry.action}. Use redo_change to re-apply what it reversed.`);
      }
      const batch = (await store.listChanges({ batchId: entry.batchId, limit: 500 })).filter((item) =>
        UNDOABLE.has(item.action),
      );
      // Check everything first, so a batch is undone fully or not at all.
      const plans = [];
      for (const { first, last } of groupByRecord(batch)) {
        const combined = { ...last, before: first.before };
        const current = await currentValue(last.entityKind, last.entityId);
        const check = canUndo(current, combined);
        if (!check.ok) throw new ToolError(`Can't undo: ${check.reason}`);
        plans.push({ last, current, target: undoTarget(combined) });
      }
      const undone = [];
      for (const { last, current, target } of plans.toReversed()) {
        await writeValue(last.entityKind, target);
        await log(last.entityKind, last.entityId, current, target, { action: "undo", refChangeId: last.id });
        undone.push(last.summary);
      }
      return { undone };
    },

    async redo(changeId) {
      const entry = await requireChange(changeId);
      let undoBatchId: string | null = entry.action === "undo" ? entry.batchId : null;
      if (!undoBatchId) {
        // Find the newest undo of any change in this batch.
        const batch = await store.listChanges({ batchId: entry.batchId, limit: 500 });
        const undos = (
          await Promise.all(batch.map((item) => store.listChanges({ refChangeId: item.id, limit: 50 })))
        )
          .flat()
          .filter((item) => item.action === "undo")
          .toSorted((left, right) => right.id.localeCompare(left.id));
        undoBatchId = undos[0]?.batchId ?? null;
      }
      if (!undoBatchId) throw new ToolError("That change hasn't been undone, so there is nothing to redo.");

      const undos = (await store.listChanges({ batchId: undoBatchId, limit: 500 })).filter(
        (item) => item.action === "undo",
      );
      const plans = [];
      for (const undo of undos) {
        const current = await currentValue(undo.entityKind, undo.entityId);
        const check = canRedo(current, undo);
        if (!check.ok) throw new ToolError(`Can't redo: ${check.reason}`);
        plans.push({ undo, current, target: redoTarget(undo) });
      }
      const redone = [];
      for (const { undo, current, target } of plans) {
        await writeValue(undo.entityKind, target);
        await log(undo.entityKind, undo.entityId, current, target, { action: "redo", refChangeId: undo.refChangeId });
        redone.push(undo.summary.replace(/^Undid a change to/, "Redid a change to"));
      }
      return { redone };
    },
  };
}
