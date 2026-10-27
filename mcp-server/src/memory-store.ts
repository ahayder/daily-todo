import type PocketBase from "pocketbase";
import type { ChangeEntityKind, ChangeLogEntry, MemoryKind, MemoryKindMap, PlannerPreset } from "@/lib/types";
import {
  MEMORY_MAPPERS,
  changeToPayload,
  memoryRecordToPayload,
  rowToChange,
  rowToMemoryRecord,
  str,
  type Row,
} from "@/lib/pocketbase/memory-rows";

// The row mappers live in src/lib/pocketbase/memory-rows.ts, shared with the app.
export { MEMORY_MAPPERS, changeToPayload, memoryRecordToPayload, rowToChange, rowToMemoryRecord };

/**
 * Where the MCP tools read and write the external brain (tasks, decisions,
 * projects, meetings, follow-ups, repeats) and the change log. One record per
 * write; nothing is ever deleted (records are soft-deleted with deleted_at).
 */
export type MemoryStore = {
  loadRecords<K extends MemoryKind>(kind: K): Promise<Record<string, MemoryKindMap[K]>>;
  getRecord<K extends MemoryKind>(kind: K, id: string): Promise<MemoryKindMap[K] | null>;
  /** Records are only ever soft-deleted (deletedAt), so there is no delete. */
  saveRecord<K extends MemoryKind>(kind: K, record: MemoryKindMap[K]): Promise<void>;
  /** The Daily Planner week the user has selected (else the newest). Read-only. */
  loadPlannerPreset(): Promise<PlannerPreset | null>;
  /** The change log is append-only. */
  appendChange(entry: ChangeLogEntry): Promise<void>;
  /** Newest first. */
  listChanges(filter?: ChangeFilter): Promise<ChangeLogEntry[]>;
  getChange(id: string): Promise<ChangeLogEntry | null>;
};

export type ChangeFilter = {
  entityKind?: ChangeEntityKind;
  entityId?: string;
  batchId?: string;
  refChangeId?: string;
  limit?: number;
};

// Mirrors the planner_presets reader in src/lib/pocketbase/persistence-repository.ts
// (days_json is either the days map or { days, subtitle, createdAt }).
export function readPlannerPresetRow(row: Row): PlannerPreset | null {
  if (!row.preset_id) return null;
  const updatedAt = String(row.updated_at_client ?? row.updated ?? new Date(0).toISOString());
  const payload = row.days_json && typeof row.days_json === "object" ? (row.days_json as Record<string, unknown>) : {};
  const days = ("days" in payload ? payload.days : payload) as PlannerPreset["days"];
  return {
    id: String(row.preset_id),
    name: str(row.name),
    subtitle: str(payload.subtitle),
    dayOrder: Array.isArray(row.day_order_json) ? row.day_order_json : [],
    days: days && typeof days === "object" ? days : ({} as PlannerPreset["days"]),
    createdAt: str(payload.createdAt) || updatedAt,
    updatedAt,
  };
}

export type PocketBaseContext = {
  pb: PocketBase;
  ownerId(): Promise<string>;
  findOne(collection: string, filter: string): Promise<Row | null>;
};

export function createPocketBaseMemoryStore({ pb, ownerId, findOne }: PocketBaseContext): MemoryStore {
  async function findRecord(kind: MemoryKind, owner: string, id: string) {
    const { collection, idField } = MEMORY_MAPPERS[kind];
    return findOne(collection, pb.filter(`owner = {:owner} && ${idField} = {:id}`, { owner, id }));
  }

  return {
    async loadRecords(kind) {
      const owner = await ownerId();
      const rows = await pb
        .collection(MEMORY_MAPPERS[kind].collection)
        .getFullList<Row>({ filter: pb.filter("owner = {:owner}", { owner }) });
      const records: Record<string, MemoryKindMap[typeof kind]> = {};
      for (const row of rows) {
        const record = rowToMemoryRecord(kind, row);
        if (record) records[record.id] = record;
      }
      return records;
    },

    async getRecord(kind, id) {
      const row = await findRecord(kind, await ownerId(), id);
      return row ? rowToMemoryRecord(kind, row) : null;
    },

    async saveRecord(kind, record) {
      const owner = await ownerId();
      const existing = await findRecord(kind, owner, record.id);
      const payload = memoryRecordToPayload(kind, record, owner);
      const collection = pb.collection(MEMORY_MAPPERS[kind].collection);
      if (existing) await collection.update(existing.id, payload);
      else await collection.create(payload);
    },

    async loadPlannerPreset() {
      const owner = await ownerId();
      const byOwner = pb.filter("owner = {:owner}", { owner });
      const [rows, workspace] = await Promise.all([
        pb.collection("planner_presets").getFullList<Row>({ filter: byOwner }),
        findOne("workspace_state", byOwner),
      ]);
      const presets = rows.flatMap((row) => readPlannerPresetRow(row) ?? []);
      const selected = presets.find((preset) => preset.id === workspace?.selected_planner_preset_id);
      return selected ?? presets.toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    },

    async appendChange(entry) {
      await pb.collection("change_log").create(changeToPayload(entry, await ownerId()));
    },

    async listChanges(filter = {}) {
      const params: Record<string, string> = { owner: await ownerId() };
      const parts = ["owner = {:owner}"];
      // pb.filter can't take undefined values, so only add what is set.
      for (const [key, field] of [
        ["entityKind", "entity_kind"],
        ["entityId", "entity_id"],
        ["batchId", "batch_id"],
        ["refChangeId", "ref_change_id"],
      ] as const) {
        const value = filter[key];
        if (!value) continue;
        params[key] = value;
        parts.push(`${field} = {:${key}}`);
      }
      const result = await pb.collection("change_log").getList<Row>(1, Math.min(filter.limit ?? 50, 500), {
        filter: pb.filter(parts.join(" && "), params),
        sort: "-change_id",
      });
      return result.items.flatMap((row) => rowToChange(row) ?? []);
    },

    async getChange(id) {
      const owner = await ownerId();
      const row = await findOne("change_log", pb.filter("owner = {:owner} && change_id = {:id}", { owner, id }));
      return row ? rowToChange(row) : null;
    },
  };
}
