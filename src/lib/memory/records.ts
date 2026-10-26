import { makeId } from "@/lib/store";
import type { MemoryRecordBase } from "@/lib/types";

/**
 * Shared record helpers for the external brain. Like the app-note helpers in
 * store.ts they return the same map when nothing changed, and records are
 * never removed: deleting only sets `deletedAt`.
 */

/** Tags are free strings: trimmed, lower-case, no leading "#", no duplicates. */
export function cleanTags(tags: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  for (const tag of tags ?? []) {
    const clean = tag.trim().replace(/^#+/, "").replace(/\s+/g, " ").toLowerCase();
    if (clean) seen.add(clean);
  }
  return [...seen];
}

export function cleanList(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export function newRecordBase(prefix: string, tags: readonly string[] | undefined, now: Date): MemoryRecordBase {
  const at = now.toISOString();
  return { id: makeId(prefix), tags: cleanTags(tags), createdAt: at, updatedAt: at, deletedAt: null };
}

function sameValue(left: unknown, right: unknown): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

/** Apply the defined fields of `patch`; same map back when nothing changed. */
export function patchRecord<T extends MemoryRecordBase>(
  records: Record<string, T>,
  id: string,
  patch: Partial<T>,
  now: Date,
): Record<string, T> {
  const record = records[id];
  if (!record) return records;
  const changes = Object.entries(patch).filter(
    ([key, value]) => value !== undefined && !sameValue(record[key as keyof T], value),
  );
  if (changes.length === 0) return records;
  return { ...records, [id]: { ...record, ...Object.fromEntries(changes), updatedAt: now.toISOString() } };
}

/** Soft delete (`deleted: true`) or restore. The record always stays. */
export function setRecordDeleted<T extends MemoryRecordBase>(
  records: Record<string, T>,
  id: string,
  deleted: boolean,
  now: Date,
): Record<string, T> {
  const record = records[id];
  if (!record || (record.deletedAt !== null) === deleted) return records;
  const at = now.toISOString();
  return { ...records, [id]: { ...record, deletedAt: deleted ? at : null, updatedAt: at } };
}

/** Records not soft-deleted. */
export function liveRecords<T extends MemoryRecordBase>(records: Record<string, T>): T[] {
  return Object.values(records).filter((record) => record.deletedAt === null);
}
