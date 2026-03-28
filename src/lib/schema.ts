import { z } from "zod";

const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  done: z.boolean(),
  createdAt: z.string(),
  parentId: z.string().optional(),
});

const dailyPageSchema = z.object({
  date: z.string(),
  markdown: z.string(),
  todos: z.array(todoSchema),
});

const noteDocSchema = z.object({
  id: z.string(),
  title: z.string(),
  folderId: z.string().nullable(),
  markdown: z.string().optional(),
  updatedAt: z.string(),
});

const noteFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  updatedAt: z.string(),
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
    lastView: z.enum(["daily", "notes", "planner"]),
    themeMode: z.enum(["light", "dark", "system"]).optional(),
    categoryTheme: z.enum(["normal", "adhd1", "adhd2"]).optional(),
    isFocusMode: z.boolean().optional(),
    focusedTodoId: z.string().nullable().optional(),
  }),
});

export type AppStateSchema = z.infer<typeof appStateSchema>;
