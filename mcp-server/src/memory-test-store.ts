import { createDefaultContentBoard } from "@/lib/store";
import type { ChangeRequest, ChangeLogEntry, ContentBoard, ContentCard, MemoryKind, PlannerPreset } from "@/lib/types";
import type { AppStore } from "./content-store";

/**
 * In-memory AppStore for tests: records every write so tests can check what
 * was sent. Like the real store it has no delete method of any kind.
 */
export function createMemoryTestStore(
  initial: { board?: ContentBoard | null; cards?: ContentCard[]; changeRequests?: ChangeRequest[]; preset?: PlannerPreset | null } = {},
) {
  const state = {
    board: initial.board === undefined ? createDefaultContentBoard(new Date("2026-01-01")) : initial.board,
    cards: Object.fromEntries((initial.cards ?? []).map((card) => [card.id, card])) as Record<string, ContentCard>,
    changeRequests: Object.fromEntries((initial.changeRequests ?? []).map((note) => [note.id, note])) as Record<string, ChangeRequest>,
    records: { task: {}, decision: {}, project: {}, meeting: {}, follow_up: {}, repeat: {} } as Record<
      MemoryKind,
      Record<string, unknown>
    >,
    preset: initial.preset ?? null,
    changes: [] as ChangeLogEntry[],
    writes: [] as string[],
  };

  const store: AppStore = {
    loadBoard: async () => state.board,
    loadCards: async () => ({ ...state.cards }),
    saveBoard: async (board) => {
      state.board = board;
      state.writes.push("board");
    },
    saveCard: async (card) => {
      state.cards[card.id] = card;
      state.writes.push(`content_card:${card.id}`);
    },
    loadChangeRequests: async () => ({ ...state.changeRequests }),
    saveChangeRequest: async (note) => {
      state.changeRequests[note.id] = note;
      state.writes.push(`app_note:${note.id}`);
    },
    loadRecords: async (kind) => ({ ...state.records[kind] }) as never,
    getRecord: async (kind, id) => (state.records[kind][id] ?? null) as never,
    saveRecord: async (kind, record) => {
      (state.records[kind] as Record<string, unknown>)[record.id] = record;
      state.writes.push(`${kind}:${record.id}`);
    },
    loadPlannerPreset: async () => state.preset,
    appendChange: async (entry) => {
      state.changes.push(structuredClone(entry));
    },
    listChanges: async (filter = {}) =>
      state.changes
        .filter((entry) => !filter.entityKind || entry.entityKind === filter.entityKind)
        .filter((entry) => !filter.entityId || entry.entityId === filter.entityId)
        .filter((entry) => !filter.batchId || entry.batchId === filter.batchId)
        .filter((entry) => !filter.refChangeId || entry.refChangeId === filter.refChangeId)
        .toSorted((left, right) => right.id.localeCompare(left.id))
        .slice(0, filter.limit ?? 50),
    getChange: async (id) => state.changes.find((entry) => entry.id === id) ?? null,
  };
  return { store, state };
}
