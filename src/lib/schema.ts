import { z } from "zod";
import type { Priority } from "@/lib/types";

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
  title: z.string(),
  startMinutes: z.number(),
  endMinutes: z.number(),
  color: z.enum(["teal", "gold", "rose", "sage", "lavender"]),
  notes: z.string(),
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
  events: z.array(plannerEventSchema),
});

const plannerPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
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
  updatedAt: z.string(),
});

export const appStateSchema = z.object({
  dailyPages: z.record(z.string(), dailyPageSchema),
  notesDocs: z.record(z.string(), noteDocSchema),
  noteFolders: z.record(z.string(), noteFolderSchema),
  plannerPresets: z.record(z.string(), plannerPresetSchema),
  uiState: z.object({
    selectedDailyDate: z.string().nullable(),
    selectedNoteId: z.string().nullable(),
    selectedNoteFolderId: z.string().nullable().optional(),
    selectedPlannerPresetId: z.string().nullable(),
    isSidebarCollapsed: z.boolean().optional(),
    dailyTaskPaneWidth: z.number().optional(),
    expandedYears: z.array(z.string()),
    expandedMonths: z.array(z.string()),
    expandedNoteFolders: z.array(z.string()).optional(),
    lastView: z.enum(["todos", "notes", "planner"]),
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
