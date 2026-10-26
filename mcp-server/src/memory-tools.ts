import { addDays, isDay, todayIn } from "@/lib/memory/dates";
import { emptyMemoryData, memoryLabel, type MemoryData } from "@/lib/memory/data";
import { decisionChain, logDecision, updateDecision } from "@/lib/memory/decisions";
import { createFollowUp, resolveFollowUp } from "@/lib/memory/follow-ups";
import { createMeeting } from "@/lib/memory/meetings";
import { createProject, updateProject } from "@/lib/memory/projects";
import { liveRecords, setRecordDeleted } from "@/lib/memory/records";
import { createRepeat, repeatsForDate, updateRepeat } from "@/lib/memory/repeats";
import { collectTags, searchMemory } from "@/lib/memory/search";
import { buildStandupAgenda } from "@/lib/memory/standup";
import {
  completeTask,
  createTask,
  getTodayView,
  reopenTask,
  scheduleTask,
  updateTask,
  virtualRepeatTaskId,
} from "@/lib/memory/tasks";
import type {
  Decision,
  DecisionStatus,
  FollowUp,
  LifeArea,
  Meeting,
  MemoryKind,
  MemoryKindMap,
  PlannerPreset,
  Project,
  Repeat,
  Task,
} from "@/lib/types";
import { MEMORY_KINDS } from "@/lib/types";
import type { HistoryStore } from "./history";
import { ToolError } from "./tools";

/**
 * External-brain actions for the MCP server: tasks, decisions, projects,
 * meetings, follow-ups, repeats, search, standup and history. All rules come
 * from the pure helpers in src/lib/memory so the app (later) behaves the same.
 * Nothing is ever hard-deleted: delete = soft delete, and undo = put back.
 */

export type MemoryContext = {
  store: HistoryStore;
  /** The user's time zone, so "today" is their day. */
  timeZone: string;
  /** Who is writing, e.g. "chat:claude". */
  source: string;
  now?: () => Date;
};

const now = (ctx: MemoryContext) => ctx.now?.() ?? new Date();
const today = (ctx: MemoryContext) => todayIn(ctx.timeZone, now(ctx));

const KIND_NAMES: Record<MemoryKind, { one: string; list: string }> = {
  task: { one: "task", list: "list_tasks" },
  decision: { one: "decision", list: "list_decisions" },
  project: { one: "project", list: "list_projects" },
  meeting: { one: "meeting", list: "list_meetings" },
  follow_up: { one: "follow-up", list: "list_follow_ups" },
  repeat: { one: "repeat", list: "list_repeats" },
};

/** Find a record by exact id, else by its title/name (exact, then contains). Never guesses between several. */
export function resolveRecord<K extends MemoryKind>(
  kind: K,
  records: Record<string, MemoryKindMap[K]>,
  query: string,
  includeDeleted = false,
): MemoryKindMap[K] {
  const trimmed = query.trim();
  if (records[trimmed]) return records[trimmed];
  const lower = trimmed.toLowerCase();
  const pool = Object.values(records).filter((record) => includeDeleted || record.deletedAt === null);
  const label = (record: MemoryKindMap[K]) => memoryLabel(kind, record).trim().toLowerCase();
  const exact = pool.filter((record) => label(record) === lower);
  const matches = exact.length > 0 ? exact : pool.filter((record) => label(record).includes(lower));
  const { one, list } = KIND_NAMES[kind];
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new ToolError(`No ${one} matches "${query}". Use ${list} to see them.`);
  const options = matches.map((record) => `- ${memoryLabel(kind, record)} (id: ${record.id})`).join("\n");
  throw new ToolError(`Several ${one}s match "${query}". Call again with one of these ids:\n${options}`);
}

async function findRecord<K extends MemoryKind>(ctx: MemoryContext, kind: K, query: string, includeDeleted = false) {
  const records = await ctx.store.loadRecords(kind);
  return { records, record: resolveRecord(kind, records, query, includeDeleted) };
}

async function optionalProjectId(ctx: MemoryContext, query: string | null | undefined): Promise<string | null | undefined> {
  if (query === undefined) return undefined;
  if (query === null || query === "") return null;
  return (await findRecord(ctx, "project", query)).record.id;
}

async function optionalDecisionId(ctx: MemoryContext, query: string | null | undefined) {
  if (query === undefined) return undefined;
  if (query === null || query === "") return null;
  return (await findRecord(ctx, "decision", query)).record.id;
}

/** "today", "tomorrow", "shelf" or YYYY-MM-DD → a day, or null for the Shelf. */
export function resolveDay(ctx: MemoryContext, value: string): string | null {
  const lower = value.trim().toLowerCase();
  if (lower === "shelf" || lower === "") return null;
  if (lower === "today") return today(ctx);
  if (lower === "tomorrow") return addDays(today(ctx), 1);
  if (isDay(lower)) return lower;
  throw new ToolError(`"${value}" isn't a day. Use YYYY-MM-DD, "today", "tomorrow" or "shelf".`);
}

const PLANNER_DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

/** A Daily Planner time block on `day`, by id or title. */
function resolveBlock(preset: PlannerPreset | null, day: string, query: string): string {
  const events = preset?.days[PLANNER_DAY_KEYS[new Date(`${day}T00:00:00Z`).getUTCDay()]]?.events ?? [];
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const byId = events.find((event) => event.id === trimmed);
  if (byId) return byId.id;
  const exact = events.filter((event) => event.title.toLowerCase() === lower);
  const matches = exact.length > 0 ? exact : events.filter((event) => event.title.toLowerCase().includes(lower));
  if (matches.length === 1) return matches[0].id;
  if (events.length === 0) throw new ToolError(`There are no time blocks on ${day} in the Daily Planner.`);
  const options = events.map((event) => `- ${event.title} (id: ${event.id})`).join("\n");
  throw new ToolError(
    `${matches.length === 0 ? "No" : "Several"} time blocks on ${day} match "${query}". Blocks that day:\n${options}`,
  );
}

async function saveAll<K extends MemoryKind>(
  ctx: MemoryContext,
  kind: K,
  before: Record<string, MemoryKindMap[K]>,
  after: Record<string, MemoryKindMap[K]>,
) {
  for (const record of Object.values(after)) {
    if (before[record.id] !== record) await ctx.store.saveRecord(kind, record);
  }
}

// ---- Describe records for chat (short, snake_case, no empty noise) ----

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => entry !== null && entry !== "" && !(Array.isArray(entry) && entry.length === 0),
    ),
  ) as Partial<T>;
}

export function describeTask(task: Task) {
  return compact({
    id: task.id,
    title: task.title,
    status: task.status,
    day: task.day ?? "shelf",
    block_id: task.blockId,
    area: task.area,
    project_id: task.projectId,
    tags: task.tags,
    notes: task.notes,
    link: task.link,
    why_decision_id: task.whyDecisionId,
    repeat_id: task.repeatId,
    content_card_id: task.contentCardId,
    done_at: task.doneAt,
    deleted_at: task.deletedAt,
  });
}

function describeDecision(decision: Decision) {
  return compact({
    id: decision.id,
    title: decision.title,
    status: decision.status,
    why: decision.why,
    source: decision.source,
    people: decision.people,
    project_id: decision.projectId,
    tags: decision.tags,
    decided_on: decision.decidedOn,
    revisit_on: decision.revisitOn,
    replaces_id: decision.replacesId,
    replaced_by_id: decision.replacedById,
    deleted_at: decision.deletedAt,
  });
}

function describeProject(project: Project) {
  return compact({
    id: project.id,
    name: project.name,
    status: project.status,
    area: project.area,
    state: project.state,
    next_step: project.nextStep,
    tags: project.tags,
  });
}

function describeMeeting(meeting: Meeting, full = false) {
  return compact({
    id: meeting.id,
    title: meeting.title,
    date: meeting.date,
    project_id: meeting.projectId,
    people: meeting.people,
    tags: meeting.tags,
    summary: full ? meeting.summary : meeting.summary.slice(0, 200),
    has_transcript: meeting.transcript ? true : null,
    ...(full && meeting.transcript ? { transcript: meeting.transcript } : {}),
  });
}

function describeFollowUp(followUp: FollowUp) {
  return compact({
    id: followUp.id,
    what: followUp.what,
    who: followUp.who,
    since: followUp.since,
    status: followUp.status,
    project_id: followUp.projectId,
    tags: followUp.tags,
  });
}

function describeRepeat(repeat: Repeat) {
  return compact({
    id: repeat.id,
    title: repeat.title,
    days: repeat.days,
    time: repeat.time,
    area: repeat.area,
    active: repeat.active,
    project_id: repeat.projectId,
    why_decision_id: repeat.whyDecisionId,
    tags: repeat.tags,
  });
}

async function loadMemory(ctx: MemoryContext): Promise<MemoryData> {
  const data = emptyMemoryData();
  await Promise.all(
    MEMORY_KINDS.map(async (kind) => {
      (data as Record<MemoryKind, unknown>)[kind] = await ctx.store.loadRecords(kind);
    }),
  );
  return data;
}

// ---- Tasks ----

export async function listToday(ctx: MemoryContext, input: { date?: string } = {}) {
  const date = input.date ? (resolveDay(ctx, input.date) ?? today(ctx)) : today(ctx);
  const [tasks, repeats, preset, followUps] = await Promise.all([
    ctx.store.loadRecords("task"),
    ctx.store.loadRecords("repeat"),
    ctx.store.loadPlannerPreset(),
    ctx.store.loadRecords("follow_up"),
  ]);
  const view = getTodayView({ tasks, repeats, preset, date });
  return {
    date,
    planner_week: preset?.name ?? null,
    blocks: view.blocks.map((block) => ({ ...block, tasks: block.tasks.map(describeTask) })),
    today: view.today.map(describeTask),
    repeats: view.repeats,
    shelf: view.shelf.map(describeTask),
    leftovers: view.leftovers.map((task) => ({ ...describeTask(task), days_waiting: task.daysWaiting })),
    waiting_on_others: liveRecords(followUps).filter((item) => item.status === "waiting").length,
  };
}

export async function listTasks(
  ctx: MemoryContext,
  input: {
    status?: "open" | "done" | "all";
    day?: string;
    area?: LifeArea;
    project?: string;
    tag?: string;
    include_deleted?: boolean;
    limit?: number;
  } = {},
) {
  const tasks = await ctx.store.loadRecords("task");
  const day = input.day === undefined ? undefined : resolveDay(ctx, input.day);
  const projectId = await optionalProjectId(ctx, input.project);
  const status = input.status ?? "open";
  const tag = input.tag?.trim().replace(/^#/, "").toLowerCase();
  const matches = Object.values(tasks)
    .filter((task) => input.include_deleted || task.deletedAt === null)
    .filter((task) => status === "all" || task.status === status)
    .filter((task) => day === undefined || task.day === day)
    .filter((task) => !input.area || task.area === input.area)
    .filter((task) => !projectId || task.projectId === projectId)
    .filter((task) => !tag || task.tags.includes(tag))
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return { total: matches.length, tasks: matches.slice(0, input.limit ?? 50).map(describeTask) };
}

export async function getTask(ctx: MemoryContext, query: string) {
  return describeTask((await findRecord(ctx, "task", query, true)).record);
}

export type AddTaskInput = {
  title: string;
  notes?: string;
  area?: LifeArea;
  day?: string;
  block?: string;
  project?: string;
  tags?: string[];
  link?: string;
  why_decision?: string;
  content_card?: string;
};

async function buildTask(ctx: MemoryContext, input: AddTaskInput, extra: { repeatId?: string } = {}) {
  const day = input.day ? resolveDay(ctx, input.day) : null;
  const blockId = day && input.block ? resolveBlock(await ctx.store.loadPlannerPreset(), day, input.block) : null;
  const task = createTask(
    {
      title: input.title,
      notes: input.notes,
      area: input.area,
      day,
      blockId,
      projectId: await optionalProjectId(ctx, input.project),
      tags: input.tags,
      link: input.link,
      whyDecisionId: await optionalDecisionId(ctx, input.why_decision),
      contentCardId: input.content_card,
      repeatId: extra.repeatId,
      source: ctx.source,
    },
    now(ctx),
  );
  if (!task) throw new ToolError("A task needs a title.");
  return task;
}

export async function addTask(ctx: MemoryContext, input: AddTaskInput) {
  const task = await buildTask(ctx, input);
  await ctx.store.saveRecord("task", task);
  return { created: describeTask(task) };
}

export async function updateTaskTool(
  ctx: MemoryContext,
  input: {
    task: string;
    title?: string;
    notes?: string;
    append_note?: string;
    area?: LifeArea | null;
    project?: string | null;
    tags?: string[];
    link?: string;
    why_decision?: string | null;
  },
) {
  const { records, record } = await findRecord(ctx, "task", input.task);
  const next = updateTask(
    records,
    record.id,
    {
      title: input.title,
      notes: input.notes,
      appendNote: input.append_note,
      area: input.area,
      projectId: await optionalProjectId(ctx, input.project),
      tags: input.tags,
      link: input.link,
      whyDecisionId: await optionalDecisionId(ctx, input.why_decision),
    },
    now(ctx),
  );
  if (next === records) return { updated: describeTask(record), note: "Nothing changed." };
  await saveAll(ctx, "task", records, next);
  return { updated: describeTask(next[record.id]) };
}

export async function scheduleTaskTool(ctx: MemoryContext, input: { task: string; day: string; block?: string }) {
  const { records, record } = await findRecord(ctx, "task", input.task);
  const day = resolveDay(ctx, input.day);
  const blockId = day && input.block ? resolveBlock(await ctx.store.loadPlannerPreset(), day, input.block) : null;
  const next = scheduleTask(records, record.id, { day, blockId }, now(ctx));
  if (next === records) return { scheduled: describeTask(record), note: "Already there." };
  await saveAll(ctx, "task", records, next);
  return { scheduled: describeTask(next[record.id]) };
}

/** Complete a task, or a repeat due today (which creates its real task row). */
export async function completeTaskTool(ctx: MemoryContext, input: { task: string }) {
  const tasks = await ctx.store.loadRecords("task");
  let task: Task;
  try {
    task = resolveRecord("task", tasks, input.task);
  } catch (error) {
    const repeat = await findDueRepeat(ctx, tasks, input.task);
    if (!repeat) throw error;
    const created = await buildTask(
      ctx,
      { title: repeat.title, area: repeat.area ?? undefined, day: today(ctx), tags: repeat.tags },
      { repeatId: repeat.id },
    );
    const done = {
      ...completeTask({ [created.id]: created }, created.id, now(ctx))[created.id],
      projectId: repeat.projectId,
      whyDecisionId: repeat.whyDecisionId,
    };
    await ctx.store.saveRecord("task", done);
    return { completed: describeTask(done), repeat: repeat.title };
  }
  const next = completeTask(tasks, task.id, now(ctx));
  if (next === tasks) return { completed: describeTask(task), note: "Already done." };
  await saveAll(ctx, "task", tasks, next);
  return { completed: describeTask(next[task.id]) };
}

/** A repeat due today, matched by its virtual id ("repeat:<id>"), id or title. */
async function findDueRepeat(ctx: MemoryContext, tasks: Record<string, Task>, query: string): Promise<Repeat | null> {
  const date = today(ctx);
  const doneToday = new Set(liveRecords(tasks).filter((task) => task.day === date).map((task) => task.repeatId));
  const due = repeatsForDate(await ctx.store.loadRecords("repeat"), date).filter((repeat) => !doneToday.has(repeat.id));
  const trimmed = query.trim();
  const byId = due.find((repeat) => virtualRepeatTaskId(repeat.id) === trimmed || repeat.id === trimmed);
  if (byId) return byId;
  const matches = due.filter((repeat) => repeat.title.toLowerCase().includes(trimmed.toLowerCase()));
  return matches.length === 1 ? matches[0] : null;
}

export async function reopenTaskTool(ctx: MemoryContext, input: { task: string }) {
  const { records, record } = await findRecord(ctx, "task", input.task);
  const next = reopenTask(records, record.id, now(ctx));
  if (next === records) return { reopened: describeTask(record), note: "Already open." };
  await saveAll(ctx, "task", records, next);
  return { reopened: describeTask(next[record.id]) };
}

/** Soft delete (deleted: true) or restore any external-brain record. */
async function setDeletedTool<K extends MemoryKind>(ctx: MemoryContext, kind: K, query: string, deleted: boolean) {
  const { records, record } = await findRecord(ctx, kind, query, !deleted);
  const next = setRecordDeleted(records, record.id, deleted, now(ctx));
  const label = memoryLabel(kind, record);
  if (next === records) return { id: record.id, title: label, note: deleted ? "Already deleted." : "Not deleted." };
  await saveAll(ctx, kind, records, next);
  return { [deleted ? "deleted" : "restored"]: { id: record.id, title: label }, can_undo: true };
}

export const deleteTask = (ctx: MemoryContext, input: { task: string }) => setDeletedTool(ctx, "task", input.task, true);
export const restoreTask = (ctx: MemoryContext, input: { task: string }) =>
  setDeletedTool(ctx, "task", input.task, false);

// ---- Decisions ----

export type LogDecisionInput = {
  title: string;
  why?: string;
  status?: DecisionStatus;
  source?: string;
  people?: string[];
  project?: string;
  tags?: string[];
  replaces?: string;
  revisit_on?: string;
  decided_on?: string;
};

async function logDecisionRecord(ctx: MemoryContext, input: LogDecisionInput, projectId?: string | null) {
  const decisions = await ctx.store.loadRecords("decision");
  const replaces = input.replaces ? resolveRecord("decision", decisions, input.replaces) : null;
  const { decisions: next, created } = logDecision(
    decisions,
    {
      title: input.title,
      why: input.why,
      status: input.status,
      source: input.source,
      people: input.people,
      projectId: projectId !== undefined ? projectId : await optionalProjectId(ctx, input.project),
      tags: input.tags,
      replacesId: replaces?.id ?? null,
      revisitOn: input.revisit_on ? resolveDay(ctx, input.revisit_on) : null,
      decidedOn: input.decided_on ? resolveDay(ctx, input.decided_on) : input.status === "agreed" ? today(ctx) : null,
    },
    now(ctx),
  );
  if (!created) throw new ToolError("A decision needs a title.");
  await saveAll(ctx, "decision", decisions, next);
  return { created, replaced: replaces };
}

export async function logDecisionTool(ctx: MemoryContext, input: LogDecisionInput) {
  const { created, replaced } = await logDecisionRecord(ctx, input);
  return {
    created: describeDecision(created),
    ...(replaced ? { replaced: { id: replaced.id, title: replaced.title } } : {}),
  };
}

export async function listDecisions(
  ctx: MemoryContext,
  input: { status?: DecisionStatus; project?: string; tag?: string; include_replaced?: boolean; include_deleted?: boolean } = {},
) {
  const decisions = await ctx.store.loadRecords("decision");
  const projectId = await optionalProjectId(ctx, input.project);
  const tag = input.tag?.trim().replace(/^#/, "").toLowerCase();
  const matches = Object.values(decisions)
    .filter((decision) => input.include_deleted || decision.deletedAt === null)
    .filter((decision) => input.include_replaced || decision.replacedById === null)
    .filter((decision) => !input.status || decision.status === input.status)
    .filter((decision) => !projectId || decision.projectId === projectId)
    .filter((decision) => !tag || decision.tags.includes(tag))
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
  return { total: matches.length, decisions: matches.map(describeDecision) };
}

export async function getDecision(ctx: MemoryContext, query: string) {
  const { records, record } = await findRecord(ctx, "decision", query, true);
  const chain = decisionChain(records, record.id);
  return {
    ...describeDecision(record),
    ...(chain.length > 1 ? { history: chain.map((item) => ({ id: item.id, title: item.title, status: item.status })) } : {}),
  };
}

export async function updateDecisionTool(
  ctx: MemoryContext,
  input: {
    decision: string;
    title?: string;
    why?: string;
    status?: DecisionStatus;
    source?: string;
    people?: string[];
    project?: string | null;
    tags?: string[];
    revisit_on?: string | null;
    decided_on?: string | null;
  },
) {
  const { records, record } = await findRecord(ctx, "decision", input.decision);
  const day = (value: string | null | undefined) =>
    value === undefined ? undefined : value === null || value === "" ? null : resolveDay(ctx, value);
  const next = updateDecision(
    records,
    record.id,
    {
      title: input.title,
      why: input.why,
      status: input.status,
      source: input.source,
      people: input.people,
      projectId: await optionalProjectId(ctx, input.project),
      tags: input.tags,
      revisitOn: day(input.revisit_on),
      decidedOn:
        input.decided_on !== undefined
          ? day(input.decided_on)
          : input.status === "agreed" && !record.decidedOn
            ? today(ctx)
            : undefined,
    },
    now(ctx),
  );
  if (next === records) return { updated: describeDecision(record), note: "Nothing changed." };
  await saveAll(ctx, "decision", records, next);
  return { updated: describeDecision(next[record.id]) };
}

// ---- Projects ----

export async function listProjects(ctx: MemoryContext, input: { status?: Project["status"] | "all"; area?: LifeArea } = {}) {
  const projects = liveRecords(await ctx.store.loadRecords("project"))
    .filter((project) => (input.status ?? "active") === "all" || project.status === (input.status ?? "active"))
    .filter((project) => !input.area || project.area === input.area)
    .toSorted((left, right) => left.name.localeCompare(right.name));
  return { total: projects.length, projects: projects.map(describeProject) };
}

export async function getProject(ctx: MemoryContext, query: string) {
  const data = await loadMemory(ctx);
  const project = resolveRecord("project", data.project, query, true);
  const linked = <K extends Exclude<MemoryKind, "project">>(kind: K) =>
    liveRecords<MemoryKindMap[K]>(data[kind]).filter(
      (record) => (record as { projectId: string | null }).projectId === project.id,
    );
  const changes = await ctx.store.listChanges({ entityKind: "project", entityId: project.id, limit: 30 });
  const created = (["task", "decision", "meeting", "follow_up"] as const).flatMap((kind) =>
    linked(kind).map((record) => ({
      at: record.createdAt,
      what: `Added ${KIND_NAMES[kind].one} "${memoryLabel(kind, record)}"`,
    })),
  );
  const timeline = [...changes.map((change) => ({ at: change.at, what: change.summary })), ...created]
    .toSorted((left, right) => right.at.localeCompare(left.at))
    .slice(0, 30);
  return {
    ...describeProject(project),
    open_tasks: linked("task").filter((task) => task.status === "open").map(describeTask),
    decisions: linked("decision").filter((decision) => decision.replacedById === null).map(describeDecision),
    waiting_on: linked("follow_up").filter((item) => item.status === "waiting").map(describeFollowUp),
    meetings: linked("meeting")
      .toSorted((left, right) => right.date.localeCompare(left.date))
      .map((meeting) => describeMeeting(meeting)),
    timeline,
  };
}

export async function addProject(
  ctx: MemoryContext,
  input: { name: string; area?: LifeArea; state?: string; next_step?: string; tags?: string[] },
) {
  const projects = await ctx.store.loadRecords("project");
  const duplicate = liveRecords(projects).find((project) => project.name.toLowerCase() === input.name.trim().toLowerCase());
  if (duplicate) throw new ToolError(`A project called "${duplicate.name}" already exists (id: ${duplicate.id}).`);
  const project = createProject(
    { name: input.name, area: input.area, state: input.state, nextStep: input.next_step, tags: input.tags },
    now(ctx),
  );
  if (!project) throw new ToolError("A project needs a name.");
  await ctx.store.saveRecord("project", project);
  return { created: describeProject(project) };
}

export async function updateProjectTool(
  ctx: MemoryContext,
  input: {
    project: string;
    name?: string;
    area?: LifeArea | null;
    state?: string;
    next_step?: string;
    status?: Project["status"];
    tags?: string[];
  },
) {
  const { records, record } = await findRecord(ctx, "project", input.project);
  const next = updateProject(
    records,
    record.id,
    { name: input.name, area: input.area, state: input.state, nextStep: input.next_step, status: input.status, tags: input.tags },
    now(ctx),
  );
  if (next === records) return { updated: describeProject(record), note: "Nothing changed." };
  await saveAll(ctx, "project", records, next);
  return { updated: describeProject(next[record.id]) };
}

// ---- Meetings ----

export type FileMeetingInput = {
  title: string;
  date?: string;
  project?: string;
  summary: string;
  people?: string[];
  tags?: string[];
  transcript?: string;
  store_transcript?: boolean;
  decisions?: Omit<LogDecisionInput, "project" | "replaces">[];
  tasks?: Omit<AddTaskInput, "project">[];
  follow_ups?: { what: string; who: string; since?: string }[];
};

/** File a meeting summary and, in the same call, the decisions, tasks and follow-ups that came out of it. */
export async function fileMeeting(ctx: MemoryContext, input: FileMeetingInput) {
  const date = input.date ? (resolveDay(ctx, input.date) ?? today(ctx)) : today(ctx);
  const projectId = (await optionalProjectId(ctx, input.project)) ?? null;
  const meeting = createMeeting(
    {
      title: input.title,
      date,
      summary: input.summary,
      projectId,
      people: input.people,
      tags: input.tags,
      transcript: input.transcript,
      storeTranscript: input.store_transcript,
    },
    now(ctx),
  );
  if (!meeting) throw new ToolError("A meeting needs a title.");
  await ctx.store.saveRecord("meeting", meeting);

  const from = `${meeting.title} (${date})`;
  const decisions = [];
  for (const decision of input.decisions ?? []) {
    const { created } = await logDecisionRecord(
      ctx,
      { ...decision, source: decision.source ?? `Meeting · ${meeting.title}`, people: decision.people ?? meeting.people },
      projectId,
    );
    decisions.push(describeDecision(created));
  }
  const tasks = [];
  for (const taskInput of input.tasks ?? []) {
    const task = await buildTask(ctx, {
      ...taskInput,
      notes: [taskInput.notes, `From meeting: ${from}`].filter(Boolean).join("\n"),
    });
    const linked = { ...task, projectId };
    await ctx.store.saveRecord("task", linked);
    tasks.push(describeTask(linked));
  }
  const followUps = [];
  for (const item of input.follow_ups ?? []) {
    const followUp = createFollowUp(
      { what: item.what, who: item.who, since: item.since ? (resolveDay(ctx, item.since) ?? date) : date, projectId },
      now(ctx),
    );
    if (!followUp) continue;
    await ctx.store.saveRecord("follow_up", followUp);
    followUps.push(describeFollowUp(followUp));
  }
  return {
    filed: describeMeeting(meeting),
    transcript_stored: Boolean(meeting.transcript),
    decisions,
    tasks,
    follow_ups: followUps,
    batch_id: ctx.store.batchId,
  };
}

export async function listMeetings(ctx: MemoryContext, input: { project?: string; since?: string; limit?: number } = {}) {
  const projectId = await optionalProjectId(ctx, input.project);
  const since = input.since ? resolveDay(ctx, input.since) : null;
  const meetings = liveRecords(await ctx.store.loadRecords("meeting"))
    .filter((meeting) => !projectId || meeting.projectId === projectId)
    .filter((meeting) => !since || meeting.date >= since)
    .toSorted((left, right) => right.date.localeCompare(left.date));
  return { total: meetings.length, meetings: meetings.slice(0, input.limit ?? 20).map((meeting) => describeMeeting(meeting)) };
}

export async function getMeeting(ctx: MemoryContext, query: string) {
  return describeMeeting((await findRecord(ctx, "meeting", query, true)).record, true);
}

// ---- Follow-ups ----

export async function addFollowUp(
  ctx: MemoryContext,
  input: { what: string; who: string; since?: string; project?: string; tags?: string[] },
) {
  const followUp = createFollowUp(
    {
      what: input.what,
      who: input.who,
      since: input.since ? (resolveDay(ctx, input.since) ?? today(ctx)) : today(ctx),
      projectId: await optionalProjectId(ctx, input.project),
      tags: input.tags,
    },
    now(ctx),
  );
  if (!followUp) throw new ToolError("Say what you are waiting for.");
  await ctx.store.saveRecord("follow_up", followUp);
  return { created: describeFollowUp(followUp) };
}

export async function listFollowUps(
  ctx: MemoryContext,
  input: { status?: "waiting" | "done" | "all"; who?: string; project?: string } = {},
) {
  const projectId = await optionalProjectId(ctx, input.project);
  const who = input.who?.trim().toLowerCase();
  const items = liveRecords(await ctx.store.loadRecords("follow_up"))
    .filter((item) => (input.status ?? "waiting") === "all" || item.status === (input.status ?? "waiting"))
    .filter((item) => !who || item.who.toLowerCase().includes(who))
    .filter((item) => !projectId || item.projectId === projectId)
    .toSorted((left, right) => left.since.localeCompare(right.since));
  return { total: items.length, follow_ups: items.map(describeFollowUp) };
}

export async function resolveFollowUpTool(ctx: MemoryContext, input: { follow_up: string }) {
  const { records, record } = await findRecord(ctx, "follow_up", input.follow_up);
  const next = resolveFollowUp(records, record.id, now(ctx));
  if (next === records) return { resolved: describeFollowUp(record), note: "Already done." };
  await saveAll(ctx, "follow_up", records, next);
  return { resolved: describeFollowUp(next[record.id]) };
}

// ---- Repeats ----

export async function addRepeat(
  ctx: MemoryContext,
  input: { title: string; days: string[]; time?: string; area?: LifeArea; project?: string; why_decision?: string; tags?: string[] },
) {
  const repeat = createRepeat(
    {
      title: input.title,
      days: input.days,
      time: input.time,
      area: input.area,
      projectId: await optionalProjectId(ctx, input.project),
      whyDecisionId: await optionalDecisionId(ctx, input.why_decision),
      tags: input.tags,
    },
    now(ctx),
  );
  if (!repeat) throw new ToolError('A repeat needs a title and at least one weekday ("mon"…"sun").');
  await ctx.store.saveRecord("repeat", repeat);
  return { created: describeRepeat(repeat) };
}

export async function listRepeats(ctx: MemoryContext, input: { include_paused?: boolean } = {}) {
  const repeats = liveRecords(await ctx.store.loadRecords("repeat"))
    .filter((repeat) => input.include_paused || repeat.active)
    .toSorted((left, right) => left.title.localeCompare(right.title));
  return { total: repeats.length, repeats: repeats.map(describeRepeat) };
}

export async function updateRepeatTool(
  ctx: MemoryContext,
  input: { repeat: string; title?: string; days?: string[]; time?: string; area?: LifeArea | null; active?: boolean; tags?: string[] },
) {
  const { records, record } = await findRecord(ctx, "repeat", input.repeat);
  const next = updateRepeat(
    records,
    record.id,
    { title: input.title, days: input.days, time: input.time, area: input.area, active: input.active, tags: input.tags },
    now(ctx),
  );
  if (next === records) return { updated: describeRepeat(record), note: "Nothing changed." };
  await saveAll(ctx, "repeat", records, next);
  return { updated: describeRepeat(next[record.id]) };
}

// ---- Memory ----

export async function searchMemoryTool(ctx: MemoryContext, input: { query: string; tag?: string; kinds?: MemoryKind[]; limit?: number }) {
  const hits = searchMemory(await loadMemory(ctx), input.query, input);
  return {
    total: hits.length,
    results: hits.map(({ updatedAt, ...hit }) => ({ ...hit, updated_at: updatedAt })),
  };
}

export async function listTags(ctx: MemoryContext) {
  return { tags: collectTags(await loadMemory(ctx)) };
}

export async function standupAgenda(ctx: MemoryContext, input: { date?: string; since?: string; area?: LifeArea | "all" } = {}) {
  const date = input.date ? (resolveDay(ctx, input.date) ?? today(ctx)) : today(ctx);
  const since = input.since ? (resolveDay(ctx, input.since) ?? undefined) : undefined;
  const agenda = buildStandupAgenda(date, await loadMemory(ctx), { since, timeZone: ctx.timeZone, area: input.area });
  return {
    date: agenda.date,
    since: agenda.since,
    what_i_did: {
      tasks: agenda.whatIDid.tasks.map((task) => task.title),
      decisions: agenda.whatIDid.decisions.map((decision) => decision.title),
    },
    today: agenda.today.map((task) => ({ title: task.title, day: task.day })),
    waiting_on_others: agenda.waitingOnOthers.map(({ who, items }) => ({
      who,
      items: items.map((item) => ({ what: item.what, since: item.since })),
    })),
    open_proposals: agenda.openProposals.map((decision) => ({ title: decision.title, source: decision.source })),
    next: agenda.next,
  };
}

// ---- History ----

export async function listChanges(ctx: MemoryContext, input: { limit?: number; kind?: string; id?: string } = {}) {
  const changes = await ctx.store.listChanges({
    entityKind: input.kind as never,
    entityId: input.id,
    limit: input.limit ?? 20,
  });
  return {
    changes: changes.map((change) => ({
      change_id: change.id,
      batch_id: change.batchId,
      at: change.at,
      action: change.action,
      kind: change.entityKind,
      record_id: change.entityId,
      summary: change.summary,
      source: change.source,
    })),
  };
}

export async function undoChange(ctx: MemoryContext, input: { change: string }) {
  return ctx.store.undo(input.change);
}

export async function redoChange(ctx: MemoryContext, input: { change: string }) {
  return ctx.store.redo(input.change);
}
