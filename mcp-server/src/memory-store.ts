import type PocketBase from "pocketbase";
import {
  DECISION_STATUSES,
  LIFE_AREAS,
  type ChangeAction,
  type ChangeEntityKind,
  type ChangeLogEntry,
  type LifeArea,
  type MemoryKind,
  type MemoryKindMap,
  type MemoryRecordBase,
  type PlannerPreset,
  type Weekday,
} from "@/lib/types";
import { cleanWeekdays } from "@/lib/memory/repeats";

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

type Row = Record<string, unknown> & { id: string };

const str = (value: unknown) => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown) => (typeof value === "string" && value ? value : null);
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const area = (value: unknown): LifeArea | null =>
  (LIFE_AREAS as readonly string[]).includes(str(value)) ? (str(value) as LifeArea) : null;

// Mirrors normalizeDate in content-store.ts: PocketBase dates use a space.
function date(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const time = Date.parse(value.replace(" ", "T"));
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

type Mapper<K extends MemoryKind> = {
  collection: string;
  idField: string;
  fromRow(row: Row, base: MemoryRecordBase): MemoryKindMap[K];
  toPayload(record: MemoryKindMap[K]): Record<string, unknown>;
};

/** Row ↔ record for each kind. Empty values are sent as "" / [] so they clear the field. */
export const MEMORY_MAPPERS: { [K in MemoryKind]: Mapper<K> } = {
  task: {
    collection: "tasks",
    idField: "task_id",
    fromRow: (row, base) => ({
      ...base,
      title: str(row.title),
      notes: str(row.notes),
      area: area(row.area),
      status: row.status === "done" ? "done" : "open",
      day: strOrNull(row.day),
      blockId: strOrNull(row.block_id),
      projectId: strOrNull(row.project_id),
      link: str(row.link),
      whyDecisionId: strOrNull(row.why_decision_id),
      repeatId: strOrNull(row.repeat_id),
      contentCardId: strOrNull(row.content_card_id),
      source: str(row.source),
      doneAt: date(row.done_at),
    }),
    toPayload: (task) => ({
      title: task.title,
      notes: task.notes,
      area: task.area ?? "",
      status: task.status,
      day: task.day ?? "",
      block_id: task.blockId ?? "",
      project_id: task.projectId ?? "",
      link: task.link,
      why_decision_id: task.whyDecisionId ?? "",
      repeat_id: task.repeatId ?? "",
      content_card_id: task.contentCardId ?? "",
      source: task.source,
      done_at: task.doneAt ?? "",
    }),
  },
  decision: {
    collection: "decisions",
    idField: "decision_id",
    fromRow: (row, base) => ({
      ...base,
      title: str(row.title),
      why: str(row.why),
      status: (DECISION_STATUSES as readonly string[]).includes(str(row.status))
        ? (str(row.status) as MemoryKindMap["decision"]["status"])
        : "proposed",
      source: str(row.source),
      people: strings(row.people_json),
      projectId: strOrNull(row.project_id),
      replacesId: strOrNull(row.replaces_id),
      replacedById: strOrNull(row.replaced_by_id),
      revisitOn: strOrNull(row.revisit_on),
      decidedOn: strOrNull(row.decided_on),
    }),
    toPayload: (decision) => ({
      title: decision.title,
      why: decision.why,
      status: decision.status,
      source: decision.source,
      people_json: decision.people,
      project_id: decision.projectId ?? "",
      replaces_id: decision.replacesId ?? "",
      replaced_by_id: decision.replacedById ?? "",
      revisit_on: decision.revisitOn ?? "",
      decided_on: decision.decidedOn ?? "",
    }),
  },
  project: {
    collection: "projects",
    idField: "project_id",
    fromRow: (row, base) => ({
      ...base,
      name: str(row.name),
      area: area(row.area),
      state: str(row.state),
      nextStep: str(row.next_step),
      status: row.status === "paused" || row.status === "done" ? row.status : "active",
    }),
    toPayload: (project) => ({
      name: project.name,
      area: project.area ?? "",
      state: project.state,
      next_step: project.nextStep,
      status: project.status,
    }),
  },
  meeting: {
    collection: "meetings",
    idField: "meeting_id",
    fromRow: (row, base) => ({
      ...base,
      title: str(row.title),
      date: str(row.date),
      projectId: strOrNull(row.project_id),
      summary: str(row.summary),
      people: strings(row.people_json),
      transcript: str(row.transcript),
    }),
    toPayload: (meeting) => ({
      title: meeting.title,
      date: meeting.date,
      project_id: meeting.projectId ?? "",
      summary: meeting.summary,
      people_json: meeting.people,
      transcript: meeting.transcript,
    }),
  },
  follow_up: {
    collection: "follow_ups",
    idField: "follow_up_id",
    fromRow: (row, base) => ({
      ...base,
      what: str(row.what),
      who: str(row.who),
      since: str(row.since),
      projectId: strOrNull(row.project_id),
      status: row.status === "done" ? "done" : "waiting",
      doneAt: date(row.done_at),
    }),
    toPayload: (followUp) => ({
      what: followUp.what,
      who: followUp.who,
      since: followUp.since,
      project_id: followUp.projectId ?? "",
      status: followUp.status,
      done_at: followUp.doneAt ?? "",
    }),
  },
  repeat: {
    collection: "repeats",
    idField: "repeat_id",
    fromRow: (row, base) => ({
      ...base,
      title: str(row.title),
      area: area(row.area),
      days: cleanWeekdays(strings(row.days_json)) as Weekday[],
      time: str(row.time),
      projectId: strOrNull(row.project_id),
      whyDecisionId: strOrNull(row.why_decision_id),
      active: row.active === true,
    }),
    toPayload: (repeat) => ({
      title: repeat.title,
      area: repeat.area ?? "",
      days_json: repeat.days,
      time: repeat.time,
      project_id: repeat.projectId ?? "",
      why_decision_id: repeat.whyDecisionId ?? "",
      active: repeat.active,
    }),
  },
};

export function rowToMemoryRecord<K extends MemoryKind>(kind: K, row: Row): MemoryKindMap[K] | null {
  const mapper = MEMORY_MAPPERS[kind] as Mapper<K>;
  const id = row[mapper.idField];
  if (typeof id !== "string" || !id) return null;
  const updatedAt = String(row.updated_at_client ?? row.updated ?? new Date(0).toISOString());
  return mapper.fromRow(row, {
    id,
    tags: strings(row.tags_json),
    createdAt: date(row.created_at_client) ?? updatedAt,
    updatedAt,
    deletedAt: date(row.deleted_at),
  });
}

export function memoryRecordToPayload<K extends MemoryKind>(kind: K, record: MemoryKindMap[K], owner: string) {
  const mapper = MEMORY_MAPPERS[kind] as Mapper<K>;
  return {
    owner,
    [mapper.idField]: record.id,
    ...mapper.toPayload(record),
    tags_json: record.tags,
    created_at_client: record.createdAt,
    deleted_at: record.deletedAt ?? "",
    updated_at_client: record.updatedAt,
  };
}

export function rowToChange(row: Row): ChangeLogEntry | null {
  if (!row.change_id) return null;
  return {
    id: String(row.change_id),
    batchId: str(row.batch_id),
    entityKind: str(row.entity_kind) as ChangeEntityKind,
    entityId: str(row.entity_id),
    action: str(row.action) as ChangeAction,
    source: str(row.source),
    summary: str(row.summary),
    before: row.before_json ?? null,
    after: row.after_json ?? null,
    refChangeId: strOrNull(row.ref_change_id),
    at: date(row.at) ?? new Date(0).toISOString(),
  };
}

export function changeToPayload(entry: ChangeLogEntry, owner: string) {
  return {
    owner,
    change_id: entry.id,
    batch_id: entry.batchId,
    entity_kind: entry.entityKind,
    entity_id: entry.entityId,
    action: entry.action,
    source: entry.source,
    summary: entry.summary.slice(0, 2000),
    ref_change_id: entry.refChangeId ?? "",
    before_json: entry.before,
    after_json: entry.after,
    at: entry.at,
  };
}

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
      const owner = await ownerId();
      const parts = ["owner = {:owner}"];
      if (filter.entityKind) parts.push("entity_kind = {:entityKind}");
      if (filter.entityId) parts.push("entity_id = {:entityId}");
      if (filter.batchId) parts.push("batch_id = {:batchId}");
      if (filter.refChangeId) parts.push("ref_change_id = {:refChangeId}");
      const result = await pb.collection("change_log").getList<Row>(1, Math.min(filter.limit ?? 50, 500), {
        filter: pb.filter(parts.join(" && "), { owner, ...filter }),
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
