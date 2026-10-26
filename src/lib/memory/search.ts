import { MEMORY_KINDS, type MemoryKind, type MemoryKindMap } from "@/lib/types";
import { memoryLabel, type MemoryData } from "./data";
import { cleanTags, liveRecords } from "./records";

export type SearchHit = {
  kind: MemoryKind;
  id: string;
  label: string;
  snippet: string;
  tags: string[];
  updatedAt: string;
};

/** The text of a record that search looks at. */
function searchableText(kind: MemoryKind, record: MemoryKindMap[MemoryKind]): string[] {
  switch (kind) {
    case "task": {
      const task = record as MemoryKindMap["task"];
      return [task.title, task.notes, task.link];
    }
    case "decision": {
      const decision = record as MemoryKindMap["decision"];
      return [decision.title, decision.why, decision.source, ...decision.people];
    }
    case "project": {
      const project = record as MemoryKindMap["project"];
      return [project.name, project.state, project.nextStep];
    }
    case "meeting": {
      const meeting = record as MemoryKindMap["meeting"];
      return [meeting.title, meeting.summary, ...meeting.people];
    }
    case "follow_up": {
      const followUp = record as MemoryKindMap["follow_up"];
      return [followUp.what, followUp.who];
    }
    case "repeat":
      return [(record as MemoryKindMap["repeat"]).title];
  }
}

function snippetAround(texts: string[], word: string): string {
  const text = texts.find((entry) => entry.toLowerCase().includes(word)) ?? texts[0] ?? "";
  const at = Math.max(0, text.toLowerCase().indexOf(word) - 60);
  const piece = text.slice(at, at + 160).replace(/\s+/g, " ").trim();
  return `${at > 0 ? "…" : ""}${piece}${at + 160 < text.length ? "…" : ""}`;
}

/**
 * Plain text search: every word of the query must appear somewhere in the
 * record (text or tags). `tag` narrows to records carrying that tag.
 * Soft-deleted records are left out. Newest first.
 */
export function searchMemory(
  data: MemoryData,
  query: string,
  options: { tag?: string; kinds?: MemoryKind[]; limit?: number } = {},
): SearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const [tag] = cleanTags(options.tag ? [options.tag] : []);
  const kinds = options.kinds?.length ? options.kinds : MEMORY_KINDS;
  const hits: SearchHit[] = [];

  for (const kind of kinds) {
    for (const record of liveRecords<MemoryKindMap[MemoryKind]>(data[kind])) {
      if (tag && !record.tags.includes(tag)) continue;
      const texts = searchableText(kind, record);
      const haystack = [...texts, ...record.tags].join("\n").toLowerCase();
      if (!words.every((word) => haystack.includes(word))) continue;
      hits.push({
        kind,
        id: record.id,
        label: memoryLabel(kind, record),
        snippet: words.length ? snippetAround(texts, words[0]) : "",
        tags: record.tags,
        updatedAt: record.updatedAt,
      });
    }
  }
  return hits
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, options.limit ?? 30);
}

/** Every tag in use and how many live records carry it, most used first. */
export function collectTags(data: MemoryData): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const kind of MEMORY_KINDS) {
    for (const record of liveRecords<MemoryKindMap[MemoryKind]>(data[kind])) {
      for (const tag of record.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .toSorted((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}
