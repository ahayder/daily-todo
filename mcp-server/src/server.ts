import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { APP_NOTE_KINDS, CONTENT_PLATFORMS } from "@/lib/types";
import { createPocketBaseStore, type ContentStore } from "./content-store";
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
 * Content Planner MCP server (Streamable HTTP, stateless). Reachable only at
 * /mcp/<MCP_SECRET>; every other path is a 404. Nothing is ever hard-deleted:
 * content has no delete tools, and app notes are soft-deleted only.
 */

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

function buildServer(store: ContentStore): McpServer {
  const server = new McpServer({ name: "dailytodo-content-planner", version: "1.0.0" });

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

  const httpServer = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/health") return res.writeHead(200).end("ok");
    const match = path.match(/^\/mcp\/([^/]+)\/?$/);
    if (!match || !secretMatches(match[1], secret)) return notFound(res);

    // Stateless: a fresh server + transport per request.
    const server = buildServer(store);
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

  httpServer.listen(port, () => console.log(`Content Planner MCP listening on :${port}`));
  return httpServer;
}

startServer();
