import { z } from "zod";
import type { ChangeLogEntry, MemoryData, MemoryKind, Priority } from "@/lib/types";

const taskStatusSchema = z.enum(["pending", "ongoing", "finished"]);

const todoSchema = z
  .object({
    id: z.string(),
    text: z.string().catch(""),
    priority: z.number().int().min(1).max(3).catch(3),
    status: taskStatusSchema.optional().catch("pending"),
    estimatedMinutes: z.number().int().min(1).nullable().optional().catch(null),
    done: z.boolean().optional(),
    createdAt: z.string().optional().catch(new Date().toISOString()),
    parentId: z.string().optional(),
  })
  .transform(({ done, status, estimatedMinutes, priority, createdAt, ...todo }) => ({
    ...todo,
    priority: priority as Priority,
    status: status ?? (done ? "finished" : "pending"),
    estimatedMinutes: estimatedMinutes ?? null,
    createdAt: createdAt ?? new Date().toISOString(),
  }));

const dailyPageSchema = z.object({
  date: z.string(),
  markdown: z.string().catch(""),
  todos: z.array(todoSchema).catch([]),
});

const todoWorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const noteDocSchema = z.object({
  id: z.string(),
  title: z.string().catch("Untitled"),
  folderId: z.string().nullable().catch(null),
  markdown: z.string().optional().catch(""),
  updatedAt: z.string().catch(new Date().toISOString()),
});

const noteFolderSchema = z.object({
  id: z.string(),
  name: z.string().catch("New Folder"),
  parentId: z.string().nullable().catch(null),
  updatedAt: z.string().catch(new Date().toISOString()),
});

const plannerEventSchema = z.object({
  id: z.string(),
  dayKey: z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]),
  purposeId: z.string().nullable().default(null),
  title: z.string(),
  startMinutes: z.number(),
  endMinutes: z.number(),
  color: z.enum(["teal", "gold", "rose", "sage", "lavender"]),
  notes: z.string(),
});

const plannerPurposeSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  color: z.enum(["teal", "gold", "rose", "sage", "lavender"]),
  targetMinutes: z.number().int().min(0).max(24 * 60),
  role: z.enum(["primary", "secondary"]),
  notes: z.string().catch(""),
});

const plannerDaySchema = z.object({
  key: z.enum([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ]),
  title: z.string(),
  purposes: z.array(plannerPurposeSchema).default([]),
  events: z.array(plannerEventSchema),
});

const plannerPresetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    subtitle: z.string().optional(),
    dayOrder: z.array(
      z.enum([
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ]),
    ),
    days: z.record(z.string(), plannerDaySchema),
    createdAt: z.string().optional(),
    updatedAt: z.string(),
  })
  .transform(({ subtitle, createdAt, ...preset }) => ({
    ...preset,
    subtitle:
      subtitle ?? "Shape a reusable weekly rhythm around the things that matter most.",
    createdAt: createdAt ?? preset.updatedAt,
  }));

const contentColumnSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  subtitle: z.string().catch(""),
});

const contentSeriesSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  about: z.string().catch(""),
  createdAt: z.string(),
});

const contentBoardSchema = z.object({
  columns: z.array(contentColumnSchema).min(1),
  series: z.array(contentSeriesSchema).optional().catch([]),
  updatedAt: z.string(),
});

const contentCardSchema = z.object({
  id: z.string().min(1),
  columnId: z.string().min(1),
  title: z.string().trim().min(1),
  notes: z.string().catch(""),
  order: z.number().int().min(0),
  updatedAt: z.string(),
  publishedAt: z.string().nullable().optional().catch(null),
  links: z.record(z.string(), z.string()).optional().catch({}),
  transcript: z.string().optional().catch(""),
  seriesId: z.string().optional().catch(undefined),
});

const changeRequestSchema = z.object({
  id: z.string().min(1),
  text: z.string().catch(""),
  kind: z.enum(["idea", "improvement", "bug"]).catch("idea"),
  status: z.enum(["open", "done"]).catch("open"),
  screen: z.string().catch(""),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().catch(null),
});

function hasStringField(value: unknown, field: string): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && typeof (value as Record<string, unknown>)[field] === "string");
}

/**
 * External-brain records are written by the MCP server and already shaped by
 * src/lib/pocketbase/memory-rows.ts. Keep every record with an id and drop
 * only broken ones, so one bad row never empties a whole list.
 */
function recordMap<T>(idField = "id") {
  return z
    .record(z.string(), z.unknown())
    .catch({})
    .transform(
      (records) =>
        Object.fromEntries(
          Object.entries(records).filter(([, record]) => hasStringField(record, idField) && record[idField]),
        ) as Record<string, T>,
    );
}

const MEMORY_KIND_KEYS: MemoryKind[] = ["task", "decision", "project", "meeting", "follow_up", "repeat"];

const memorySchema = z
  .record(z.string(), z.unknown())
  .catch({})
  .transform((value) => {
    const memory = {} as Record<MemoryKind, unknown>;
    for (const kind of MEMORY_KIND_KEYS) memory[kind] = recordMap().parse(value[kind] ?? {});
    return memory as MemoryData;
  });

export const appStateSchema = z.object({
  dailyPages: z.record(z.string(), dailyPageSchema),
  todoWorkspaces: z.record(z.string(), todoWorkspaceSchema),
  notesDocs: z.record(z.string(), noteDocSchema),
  noteFolders: z.record(z.string(), noteFolderSchema),
  plannerPresets: z.record(z.string(), plannerPresetSchema),
  contentBoard: contentBoardSchema,
  contentCards: z.record(z.string(), contentCardSchema).catch({}),
  changeRequests: z.record(z.string(), changeRequestSchema).catch({}),
  memory: memorySchema.optional().transform((value) => value ?? memorySchema.parse({})),
  changeLog: recordMap<ChangeLogEntry>().optional().transform((value) => value ?? {}),
  uiState: z.object({
    selectedDailyDate: z.string().nullable(),
    selectedTodoWorkspaceId: z.string(),
    selectedNoteId: z.string().nullable(),
    selectedNoteFolderId: z.string().nullable().optional(),
    selectedPlannerPresetId: z.string().nullable(),
    isSidebarCollapsed: z.boolean().optional(),
    hasSeenPlannerTour: z.boolean().optional(),
    dailyTaskPaneWidth: z.number().optional(),
    contentFontScale: z.number().optional(),
    expandedYears: z.array(z.string()),
    expandedMonths: z.array(z.string()),
    expandedNoteFolders: z.array(z.string()).optional(),
    lastView: z.enum(["today", "history", "memory", "project", "standup", "todos", "notes", "planner", "content-planner"]),
    themeMode: z.enum(["light", "dark", "system"]).optional(),
    categoryTheme: z.enum(["normal", "adhd1", "adhd2"]).optional(),
    isFocusMode: z.boolean().optional(),
    focusedTodoId: z.string().nullable().optional(),
    focusTimerStatus: z.enum(["idle", "running", "paused"]).optional(),
    focusTimerRemainingSeconds: z.number().int().min(0).nullable().optional(),
    focusTimerStartedAt: z.string().nullable().optional(),
    focusTimerBaseEstimateMinutes: z.number().int().min(1).nullable().optional(),
    isFocusTimerCompletionPromptOpen: z.boolean().optional(),
  }),
});

export type AppStateSchema = z.infer<typeof appStateSchema>;
