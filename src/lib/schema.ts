import { z } from "zod";



const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  done: z.boolean(),
  createdAt: z.string(),
});

const dailyPageSchema = z.object({
  date: z.string(),
  markdown: z.string(),
  todos: z.array(todoSchema),
});

const noteDocSchema = z.object({
  id: z.string(),
  title: z.string(),
  markdown: z.string(),
  updatedAt: z.string(),
});

export const appStateSchema = z.object({
  dailyPages: z.record(z.string(), dailyPageSchema),
  notesDocs: z.record(z.string(), noteDocSchema),
  uiState: z.object({
    selectedDailyDate: z.string().nullable(),
    selectedNoteId: z.string().nullable(),
    expandedYears: z.array(z.string()),
    expandedMonths: z.array(z.string()),
    lastView: z.enum(["daily", "notes"]),
    themeMode: z.enum(["light", "dark", "system"]).optional(),
    categoryTheme: z.enum(["normal", "adhd1", "adhd2"]).optional(),
    isFocusMode: z.boolean().optional(),
    focusedTodoId: z.string().nullable().optional(),
  }),
});

export type AppStateSchema = z.infer<typeof appStateSchema>;
