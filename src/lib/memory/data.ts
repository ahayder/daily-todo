import type { MemoryData, MemoryKind, MemoryKindMap } from "@/lib/types";

export type { MemoryData };

export function emptyMemoryData(): MemoryData {
  return { task: {}, decision: {}, project: {}, meeting: {}, follow_up: {}, repeat: {} };
}

/** The short human label of a record (title, name, or what). */
export function memoryLabel(kind: MemoryKind, record: MemoryKindMap[MemoryKind]): string {
  if (kind === "project") return (record as MemoryKindMap["project"]).name;
  if (kind === "follow_up") return (record as MemoryKindMap["follow_up"]).what;
  return (record as { title: string }).title;
}
