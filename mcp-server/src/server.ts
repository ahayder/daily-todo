import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { DEFAULT_TIME_ZONE } from "@/lib/memory/dates";
import { APP_NOTE_KINDS, CONTENT_PLATFORMS, DECISION_STATUSES, LIFE_AREAS, MEMORY_KINDS } from "@/lib/types";
import { createPocketBaseStore, type AppStore } from "./content-store";
import { withHistory } from "./history";
import * as memory from "./memory-tools";
import {
  addAppNote,
  addIdea,
  getAppNote,
  listAppNotes,
  setAppNoteDeletedTool,
  updateAppNoteTool,
  addSeries,
  getCard,
  listBoard,
  listSeries,
  moveCard,
  setCardSeries,
  setPublishInfo,
  STAGE_NAMES,
  ToolError,
  updateCard,
  updateSeries,
} from "./tools";

/**
 * DailyTodo MCP server (Streamable HTTP, stateless): the Content Planner, app
 * notes, and the "external brain" (tasks, decisions, projects, meetings,
 * follow-ups, repeats). Reachable only at /mcp/<MCP_SECRET>; every other path
 * is a 404. Nothing is ever hard-deleted, and every write is logged in the
 * change log so it can be undone.
 */

/** How the assistant should work with this server (the Office Companion rules). */
export const SERVER_INSTRUCTIONS = `DailyTodo is the user's external brain. Chat captures, the app shows.
The user has ADHD and three life areas: job (Velox), content (YouTube and a product sold through it) and personal.

Rules:
- Save things as they come up: tasks (add_task), decisions (log_decision), projects, meeting summaries (file_meeting), things the user is waiting on (add_follow_up) and routines (add_repeat). Say briefly what you saved.
- Keep "reported" separate from "verified", and "proposed" separate from "agreed". A decision is "proposed" until someone with the say agrees; use "yours" for the user's own calls. Put who said it in source (e.g. "Standup · Brian").
- Tag freely, but call list_tags first and reuse existing tags instead of inventing near-duplicates.
- When the user is stuck or overloaded, suggest ONE small next step with a time range and a clear stopping point (e.g. "20–30 min: draft the reply, stop after the first paragraph").
- Protect personal time, sleep and weekends. Don't schedule job work into evenings or weekends unless the user asks.
- For meetings, store a summary, not the raw transcript. Only pass store_transcript=true when the user explicitly asks to keep it.
- "Velox" may show up in transcripts as "vlogs" or "vlox".
- Days are in the user's time zone. Use list_today to see the day; a task with no day sits on the Shelf.
- Nothing is ever hard-deleted. If you made a mistake, use list_changes and undo_change; redo_change brings it back.
- Name records by id when you have one; if a name matches several, the tool lists them instead of guessing.`;

/** "chat:<client>" from the request, so History shows who made a change. */
export function sourceFromUserAgent(userAgent: string | undefined): string {
  const agent = (userAgent ?? "").toLowerCase();
  if (agent.includes("openai") || agent.includes("chatgpt")) return "chat:chatgpt";
  if (agent.includes("claude") || agent.includes("anthropic")) return "chat:claude";
  return "chat";
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const cardParam = z.string().describe("Card id (best) or part of its title");
const seriesParam = z.string().describe("Series id or title");
const sectionParams = {
  original_thought: z.string().optional().describe("The raw idea, in the creator's own words"),
  idea_note: z.string().optional().describe("The developed idea"),
  shoot_card: z.string().optional().describe('The shoot plan, numbered parts like "1. Core message"'),
  satellites: z.string().optional().describe("Spin-off ideas and extra notes"),
};
const linkParams = Object.fromEntries(
  CONTENT_PLATFORMS.map((platform) => [platform, z.string().optional()]),
) as Record<(typeof CONTENT_PLATFORMS)[number], z.ZodOptional<z.ZodString>>;

function buildServer(baseStore: AppStore, options: { source: string; timeZone: string }): McpServer {
  const server = new McpServer({ name: "dailytodo", version: "2.0.0" }, { instructions: SERVER_INSTRUCTIONS });
  // Every save goes through the history wrapper, so it lands in change_log.
  const store = withHistory(baseStore, options.source);
  const ctx: memory.MemoryContext = { store, timeZone: options.timeZone, source: options.source };

  const run =
    <A>(action: (args: A) => Promise<unknown>) =>
    async (args: A) => {
      try {
        const result = await action(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof ToolError ? error.message : `Server error: ${(error as Error).message}`;
        if (!(error instanceof ToolError)) console.error(error);
        return { isError: true, content: [{ type: "text" as const, text: message }] };
      }
    };

  const readOnly = { readOnlyHint: true, destructiveHint: false };
  const write = { readOnlyHint: false, destructiveHint: false };

  server.registerTool(
    "list_board",
    {
      title: "List Content Planner board",
      description:
        "All video cards grouped by stage (editing, shoot-next, develop, ideas, published), plus series. Start here to find card ids.",
      annotations: readOnly,
    },
    run(() => listBoard(store)),
  );

  server.registerTool(
    "get_card",
    {
      title: "Get a video card",
      description: "One card in full: original thought, idea note, shoot card, satellites, links and transcript.",
      inputSchema: { card: cardParam },
      annotations: readOnly,
    },
    run(({ card }) => getCard(store, card)),
  );

  server.registerTool(
    "add_idea",
    {
      title: "Add a video idea",
      description: "Capture a new video idea at the top of the Ideas stage.",
      inputSchema: {
        title: z.string().describe("Short working title"),
        original_thought: z.string().optional().describe("The raw idea, in the creator's own words"),
        series: seriesParam.optional(),
      },
      annotations: write,
    },
    run((args) => addIdea(store, args)),
  );

  server.registerTool(
    "update_card",
    {
      title: "Update a video card",
      description:
        "Change a card's title and/or any of its sections (idea note, shoot card…). Only the fields given change; a given section replaces that section's text.",
      inputSchema: { card: cardParam, title: z.string().optional(), ...sectionParams },
      annotations: write,
    },
    run((args) => updateCard(store, args)),
  );

  server.registerTool(
    "move_card",
    {
      title: "Move a video to a stage",
      description:
        'Change a video\'s stage. Use to="next" to advance one step like the app\'s button (adds the Idea note / Shoot card section on the way). Moving into published records the publish date.',
      inputSchema: { card: cardParam, to: z.enum([...STAGE_NAMES, "next"]) },
      annotations: write,
    },
    run((args) => moveCard(store, args)),
  );

  server.registerTool(
    "set_publish_info",
    {
      title: "Set published links and transcript",
      description: "Save where a video was published (per platform URL) and/or its transcript. Only given fields change.",
      inputSchema: {
        card: cardParam,
        links: z.object(linkParams).optional().describe("Platform URLs; an empty string removes one"),
        transcript: z.string().optional(),
      },
      annotations: write,
    },
    run((args) => setPublishInfo(store, args)),
  );

  server.registerTool(
    "list_series",
    {
      title: "List series",
      description: "All video series with how many videos are shipped, on the way, and still ideas.",
      annotations: readOnly,
    },
    run(() => listSeries(store)),
  );

  server.registerTool(
    "add_series",
    {
      title: "Add a series",
      description: "Create a new open-ended video series.",
      inputSchema: { title: z.string(), about: z.string().optional().describe("What the series is about") },
      annotations: write,
    },
    run((args) => addSeries(store, args)),
  );

  server.registerTool(
    "update_series",
    {
      title: "Update a series",
      description: "Rename a series or change what it is about.",
      inputSchema: { series: seriesParam, title: z.string().optional(), about: z.string().optional() },
      annotations: write,
    },
    run((args) => updateSeries(store, args)),
  );

  server.registerTool(
    "set_card_series",
    {
      title: "Put a video in a series",
      description: "Attach a card to a series (one series per card), or pass series=null to take it out.",
      inputSchema: { card: cardParam, series: seriesParam.nullable() },
      annotations: write,
    },
    run((args) => setCardSeries(store, args)),
  );

  const noteParam = z.string().describe("App note id (best) or part of its text");
  const noteKind = z.enum(APP_NOTE_KINDS);

  server.registerTool(
    "list_app_notes",
    {
      title: "List app notes",
      description:
        "Quick notes the user captured about the DailyTodo app itself (ideas, improvements, bugs). Open notes by default, newest first.",
      inputSchema: {
        status: z.enum(["open", "done", "all"]).optional(),
        kind: noteKind.optional(),
        include_deleted: z.boolean().optional().describe("Also show soft-deleted notes"),
      },
      annotations: readOnly,
    },
    run((args) => listAppNotes(store, args)),
  );

  server.registerTool(
    "get_app_note",
    {
      title: "Get an app note",
      description: "One app note in full.",
      inputSchema: { note: noteParam },
      annotations: readOnly,
    },
    run(({ note }) => getAppNote(store, note)),
  );

  server.registerTool(
    "add_app_note",
    {
      title: "Add an app note",
      description: "Save a new note about the DailyTodo app: an idea, improvement or bug (user story welcome).",
      inputSchema: { text: z.string(), kind: noteKind.optional().describe("Defaults to idea") },
      annotations: write,
    },
    run((args) => addAppNote(store, args)),
  );

  server.registerTool(
    "update_app_note",
    {
      title: "Update an app note",
      description: "Change an app note's text, type, or status (open/done). Only the fields given change.",
      inputSchema: {
        note: noteParam,
        text: z.string().optional(),
        kind: noteKind.optional(),
        status: z.enum(["open", "done"]).optional(),
      },
      annotations: write,
    },
    run((args) => updateAppNoteTool(store, args)),
  );

  server.registerTool(
    "delete_app_note",
    {
      title: "Delete an app note (soft)",
      description: "Soft-delete an app note: it is hidden but kept, and can be brought back with restore_app_note.",
      inputSchema: { note: noteParam },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    run(({ note }) => setAppNoteDeletedTool(store, { note, deleted: true })),
  );

  server.registerTool(
    "restore_app_note",
    {
      title: "Restore an app note",
      description: "Bring back a soft-deleted app note.",
      inputSchema: { note: noteParam },
      annotations: write,
    },
    run(({ note }) => setAppNoteDeletedTool(store, { note, deleted: false })),
  );

  // ---- External brain ----

  const taskParam = z.string().describe("Task id (best) or part of its title");
  const decisionParam = z.string().describe("Decision id (best) or part of its title");
  const projectParam = z.string().describe("Project id or name");
  const dayParam = z.string().describe('YYYY-MM-DD, "today", "tomorrow", or "shelf" for no day');
  const area = z.enum(LIFE_AREAS);
  const tags = z.array(z.string()).describe("Free tags; reuse existing ones (list_tags)");
  const decisionStatus = z.enum(DECISION_STATUSES).describe("agreed, proposed (not yet agreed), or yours (the user's own call)");
  const softDelete = { readOnlyHint: false, destructiveHint: false };

  server.registerTool(
    "list_today",
    {
      title: "Today",
      description:
        "The user's day: Daily Planner time blocks with their tasks, other tasks for the day, repeats due, the Shelf (no day), and leftovers from earlier days with how long they've waited.",
      inputSchema: { date: z.string().optional().describe("Defaults to today in the user's time zone") },
      annotations: readOnly,
    },
    run((args) => memory.listToday(ctx, args)),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: "Tasks filtered by status (open by default), day, area, project or tag. Newest first.",
      inputSchema: {
        status: z.enum(["open", "done", "all"]).optional(),
        day: dayParam.optional(),
        area: area.optional(),
        project: projectParam.optional(),
        tag: z.string().optional(),
        include_deleted: z.boolean().optional(),
        limit: z.number().int().positive().optional(),
      },
      annotations: readOnly,
    },
    run((args) => memory.listTasks(ctx, args)),
  );

  server.registerTool(
    "get_task",
    { title: "Get a task", description: "One task in full.", inputSchema: { task: taskParam }, annotations: readOnly },
    run(({ task }) => memory.getTask(ctx, task)),
  );

  const taskFields = {
    notes: z.string().optional(),
    area: area.optional(),
    project: projectParam.optional(),
    tags: tags.optional(),
    link: z.string().optional(),
    why_decision: decisionParam.optional().describe("The decision this task comes from"),
  };

  server.registerTool(
    "add_task",
    {
      title: "Add a task",
      description: "Save a task. Without a day it goes on the Shelf. A block puts it in a Daily Planner time block that day.",
      inputSchema: {
        title: z.string(),
        day: dayParam.optional(),
        block: z.string().optional().describe("Time block id or title on that day"),
        content_card: z.string().optional().describe("Content Planner card id this task is for"),
        ...taskFields,
      },
      annotations: write,
    },
    run((args) => memory.addTask(ctx, args)),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update a task",
      description: "Change a task's details. Only given fields change. append_note adds a line to the notes.",
      inputSchema: {
        task: taskParam,
        title: z.string().optional(),
        append_note: z.string().optional(),
        ...taskFields,
        area: area.nullable().optional(),
        project: projectParam.nullable().optional().describe("Project id or name; null removes it"),
        why_decision: decisionParam.nullable().optional(),
      },
      annotations: write,
    },
    run((args) => memory.updateTaskTool(ctx, args)),
  );

  server.registerTool(
    "schedule_task",
    {
      title: "Schedule a task",
      description: 'Put a task on a day (optionally in a time block), or back on the Shelf with day="shelf".',
      inputSchema: { task: taskParam, day: dayParam, block: z.string().optional().describe("Time block id or title") },
      annotations: write,
    },
    run((args) => memory.scheduleTaskTool(ctx, args)),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete a task",
      description: 'Mark a task done. Also works for a repeat due today (its id from list_today, like "repeat:…", or its title).',
      inputSchema: { task: taskParam },
      annotations: write,
    },
    run((args) => memory.completeTaskTool(ctx, args)),
  );

  server.registerTool(
    "reopen_task",
    { title: "Reopen a task", description: "Mark a done task open again.", inputSchema: { task: taskParam }, annotations: write },
    run((args) => memory.reopenTaskTool(ctx, args)),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete a task (soft)",
      description: "Hide a task. It is kept and can be brought back with restore_task or undo_change.",
      inputSchema: { task: taskParam },
      annotations: softDelete,
    },
    run((args) => memory.deleteTask(ctx, args)),
  );

  server.registerTool(
    "restore_task",
    { title: "Restore a task", description: "Bring back a soft-deleted task.", inputSchema: { task: taskParam }, annotations: write },
    run((args) => memory.restoreTask(ctx, args)),
  );

  const decisionCore = {
    why: z.string().optional(),
    status: decisionStatus.optional(),
    source: z.string().optional().describe('Where it came from, e.g. "Standup · Brian"'),
    people: z.array(z.string()).optional(),
    tags: tags.optional(),
    revisit_on: z.string().optional().describe("YYYY-MM-DD to look at it again"),
    decided_on: z.string().optional(),
  };
  const decisionFields = { ...decisionCore, project: projectParam.optional() };

  server.registerTool(
    "log_decision",
    {
      title: "Log a decision",
      description:
        "Save a decision with why and who. It is proposed unless agreed (or the user's own). replaces marks an older decision as replaced (kept, not deleted).",
      inputSchema: { title: z.string(), replaces: decisionParam.optional(), ...decisionFields },
      annotations: write,
    },
    run((args) => memory.logDecisionTool(ctx, args)),
  );

  server.registerTool(
    "list_decisions",
    {
      title: "List decisions",
      description: "Decisions in force (not replaced), newest first. Filter by status, project or tag.",
      inputSchema: {
        status: decisionStatus.optional(),
        project: projectParam.optional(),
        tag: z.string().optional(),
        include_replaced: z.boolean().optional(),
        include_deleted: z.boolean().optional(),
      },
      annotations: readOnly,
    },
    run((args) => memory.listDecisions(ctx, args)),
  );

  server.registerTool(
    "get_decision",
    {
      title: "Get a decision",
      description: "One decision in full, with the chain of decisions it replaced or was replaced by.",
      inputSchema: { decision: decisionParam },
      annotations: readOnly,
    },
    run(({ decision }) => memory.getDecision(ctx, decision)),
  );

  server.registerTool(
    "update_decision",
    {
      title: "Update a decision",
      description: "Change a decision, e.g. proposed → agreed. Only given fields change.",
      inputSchema: {
        decision: decisionParam,
        title: z.string().optional(),
        ...decisionFields,
        project: projectParam.nullable().optional(),
        revisit_on: z.string().nullable().optional(),
        decided_on: z.string().nullable().optional(),
      },
      annotations: write,
    },
    run((args) => memory.updateDecisionTool(ctx, args)),
  );

  const projectStatus = z.enum(["active", "paused", "done"]);

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "Projects (active by default) with where each stands and its next step.",
      inputSchema: { status: z.enum(["active", "paused", "done", "all"]).optional(), area: area.optional() },
      annotations: readOnly,
    },
    run((args) => memory.listProjects(ctx, args)),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get a project",
      description: "A project's state and next step, open tasks, decisions, who we're waiting on, meetings and a timeline.",
      inputSchema: { project: projectParam },
      annotations: readOnly,
    },
    run(({ project }) => memory.getProject(ctx, project)),
  );

  server.registerTool(
    "add_project",
    {
      title: "Add a project",
      description: "Create a project.",
      inputSchema: {
        name: z.string(),
        area: area.optional(),
        state: z.string().optional().describe("Where it stands"),
        next_step: z.string().optional(),
        tags: tags.optional(),
      },
      annotations: write,
    },
    run((args) => memory.addProject(ctx, args)),
  );

  server.registerTool(
    "update_project",
    {
      title: "Update a project",
      description: "Change where a project stands, its next step, status, or details. Only given fields change.",
      inputSchema: {
        project: projectParam,
        name: z.string().optional(),
        area: area.nullable().optional(),
        state: z.string().optional(),
        next_step: z.string().optional(),
        status: projectStatus.optional(),
        tags: tags.optional(),
      },
      annotations: write,
    },
    run((args) => memory.updateProjectTool(ctx, args)),
  );

  server.registerTool(
    "file_meeting",
    {
      title: "File a meeting",
      description:
        "Save a meeting summary and, in one call, the decisions, tasks and follow-ups that came out of it (all linked to the meeting's project). The raw transcript is NOT stored unless store_transcript is true.",
      inputSchema: {
        title: z.string(),
        summary: z.string().describe("Markdown summary"),
        date: z.string().optional().describe("Defaults to today"),
        project: projectParam.optional(),
        people: z.array(z.string()).optional(),
        tags: tags.optional(),
        transcript: z.string().optional(),
        store_transcript: z.boolean().optional().describe("Only true when the user asked to keep the transcript"),
        decisions: z
          .array(z.object({ title: z.string(), ...decisionCore }))
          .optional(),
        tasks: z
          .array(
            z.object({
              title: z.string(),
              day: dayParam.optional(),
              block: z.string().optional(),
              notes: z.string().optional(),
              area: area.optional(),
              tags: tags.optional(),
              link: z.string().optional(),
            }),
          )
          .optional(),
        follow_ups: z.array(z.object({ what: z.string(), who: z.string(), since: z.string().optional() })).optional(),
      },
      annotations: write,
    },
    run((args) => memory.fileMeeting(ctx, args)),
  );

  server.registerTool(
    "list_meetings",
    {
      title: "List meetings",
      description: "Meetings, newest first, with a short summary.",
      inputSchema: { project: projectParam.optional(), since: z.string().optional(), limit: z.number().int().positive().optional() },
      annotations: readOnly,
    },
    run((args) => memory.listMeetings(ctx, args)),
  );

  server.registerTool(
    "get_meeting",
    {
      title: "Get a meeting",
      description: "One meeting with its full summary (and transcript, if one was kept).",
      inputSchema: { meeting: z.string().describe("Meeting id or title") },
      annotations: readOnly,
    },
    run(({ meeting }) => memory.getMeeting(ctx, meeting)),
  );

  server.registerTool(
    "add_follow_up",
    {
      title: "Add a follow-up",
      description: "Something the user is waiting on someone else for.",
      inputSchema: {
        what: z.string(),
        who: z.string(),
        since: z.string().optional().describe("Defaults to today"),
        project: projectParam.optional(),
        tags: tags.optional(),
      },
      annotations: write,
    },
    run((args) => memory.addFollowUp(ctx, args)),
  );

  server.registerTool(
    "list_follow_ups",
    {
      title: "List follow-ups",
      description: "What the user is waiting on (waiting by default), oldest first.",
      inputSchema: {
        status: z.enum(["waiting", "done", "all"]).optional(),
        who: z.string().optional(),
        project: projectParam.optional(),
      },
      annotations: readOnly,
    },
    run((args) => memory.listFollowUps(ctx, args)),
  );

  server.registerTool(
    "resolve_follow_up",
    {
      title: "Resolve a follow-up",
      description: "Mark a follow-up as done (got it).",
      inputSchema: { follow_up: z.string().describe("Follow-up id or part of what it is") },
      annotations: write,
    },
    run((args) => memory.resolveFollowUpTool(ctx, args)),
  );

  const daysParam = z.array(z.string()).describe('Weekdays: "mon", "tue", "wed", "thu", "fri", "sat", "sun"');

  server.registerTool(
    "add_repeat",
    {
      title: "Add a repeat",
      description: "A routine on certain weekdays (e.g. Gym mon/wed/fri 07:00). It shows on those days in list_today.",
      inputSchema: {
        title: z.string(),
        days: daysParam,
        time: z.string().optional().describe("HH:MM"),
        area: area.optional(),
        project: projectParam.optional(),
        why_decision: decisionParam.optional(),
        tags: tags.optional(),
      },
      annotations: write,
    },
    run((args) => memory.addRepeat(ctx, args)),
  );

  server.registerTool(
    "list_repeats",
    {
      title: "List repeats",
      description: "The user's routines.",
      inputSchema: { include_paused: z.boolean().optional() },
      annotations: readOnly,
    },
    run((args) => memory.listRepeats(ctx, args)),
  );

  server.registerTool(
    "update_repeat",
    {
      title: "Update a repeat",
      description: "Change a routine's days, time or title, or pause it with active=false.",
      inputSchema: {
        repeat: z.string().describe("Repeat id or title"),
        title: z.string().optional(),
        days: daysParam.optional(),
        time: z.string().optional(),
        area: area.nullable().optional(),
        active: z.boolean().optional(),
        tags: tags.optional(),
      },
      annotations: write,
    },
    run((args) => memory.updateRepeatTool(ctx, args)),
  );

  server.registerTool(
    "search_memory",
    {
      title: "Search memory",
      description: "Find tasks, decisions, projects, meetings, follow-ups and repeats by words and/or a tag.",
      inputSchema: {
        query: z.string().describe("Every word must appear"),
        tag: z.string().optional(),
        kinds: z.array(z.enum(MEMORY_KINDS)).optional(),
        limit: z.number().int().positive().optional(),
      },
      annotations: readOnly,
    },
    run((args) => memory.searchMemoryTool(ctx, args)),
  );

  server.registerTool(
    "list_tags",
    { title: "List tags", description: "Every tag in use, most used first. Check before tagging.", annotations: readOnly },
    run(() => memory.listTags(ctx)),
  );

  server.registerTool(
    "standup_agenda",
    {
      title: "Standup agenda",
      description:
        "Agenda for the standup: what I did (since the last standup), today, waiting on others (by person), open proposals, and next steps. Job area by default.",
      inputSchema: {
        date: z.string().optional(),
        since: z.string().optional().describe("Last standup day; defaults to the previous workday"),
        area: z.enum([...LIFE_AREAS, "all"]).optional(),
      },
      annotations: readOnly,
    },
    run((args) => memory.standupAgenda(ctx, args)),
  );

  server.registerTool(
    "list_changes",
    {
      title: "List changes (history)",
      description: "Recent changes made through chat, newest first. Every write is here and can be undone.",
      inputSchema: {
        limit: z.number().int().positive().optional(),
        kind: z.string().optional().describe("e.g. task, decision, content_card"),
        id: z.string().optional().describe("Only changes to this record"),
      },
      annotations: readOnly,
    },
    run((args) => memory.listChanges(ctx, args)),
  );

  server.registerTool(
    "undo_change",
    {
      title: "Undo a change",
      description:
        "Undo a change (and the rest of the tool call it was part of). New records are soft-deleted, edits go back. Refuses if the record was changed since.",
      inputSchema: { change: z.string().describe("change_id from list_changes") },
      annotations: write,
    },
    run((args) => memory.undoChange(ctx, args)),
  );

  server.registerTool(
    "redo_change",
    {
      title: "Redo (bring back) a change",
      description: "Re-apply a change that was undone. Give the undo's change_id or the original's.",
      inputSchema: { change: z.string().describe("change_id from list_changes") },
      annotations: write,
    },
    run((args) => memory.redoChange(ctx, args)),
  );

  return server;
}

function secretMatches(candidate: string, secret: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}

function notFound(res: ServerResponse) {
  res.writeHead(404).end();
}

export function startServer() {
  const secret = requiredEnv("MCP_SECRET");
  if (secret.length < 32) throw new Error("MCP_SECRET must be at least 32 characters");
  const token = process.env.POCKETBASE_USER_TOKEN?.trim();
  const store = createPocketBaseStore({
    url: requiredEnv("POCKETBASE_URL"),
    auth: token
      ? { token }
      : { email: requiredEnv("POCKETBASE_USER_EMAIL"), password: requiredEnv("POCKETBASE_USER_PASSWORD") },
  });
  const port = Number(process.env.PORT ?? 8787);
  const timeZone = process.env.USER_TIMEZONE?.trim() || DEFAULT_TIME_ZONE;
  // Fail at start, not on the first call, if the zone name is wrong.
  new Intl.DateTimeFormat("en-CA", { timeZone });

  const httpServer = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/health") return res.writeHead(200).end("ok");
    const match = path.match(/^\/mcp\/([^/]+)\/?$/);
    if (!match || !secretMatches(match[1], secret)) return notFound(res);

    // Stateless: a fresh server + transport per request.
    const server = buildServer(store, { source: sourceFromUserAgent(req.headers["user-agent"]), timeZone });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      const body = req.method === "POST" ? await readJson(req) : undefined;
      await transport.handleRequest(req, res, body);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500).end();
    }
  });

  httpServer.listen(port, () => console.log(`DailyTodo MCP listening on :${port}`));
  return httpServer;
}

startServer();
