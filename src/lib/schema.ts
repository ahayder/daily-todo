import { z } from "zod";

const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const drawingStrokeSchema = z.object({
  id: z.string(),
  tool: z.enum(["pen", "eraser"]),
  size: z.number().positive(),
  points: z.array(pointSchema),
});

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
  drawingStrokes: z.array(drawingStrokeSchema),
  todos: z.array(todoSchema),
});

const noteDocSchema = z.object({
  id: z.string(),
  title: z.string(),
  markdown: z.string(),
  drawingStrokes: z.array(drawingStrokeSchema),
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
  }),
});

export type AppStateSchema = z.infer<typeof appStateSchema>;
