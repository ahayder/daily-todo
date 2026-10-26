import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { CONTENT_PLATFORMS } from "@/lib/types";
import { createPocketBaseStore, type ContentStore } from "./content-store";
import {
  addIdea,
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
 * /mcp/<MCP_SECRET>; every other path is a 404. Read, add and edit only —
 * there are deliberately no delete tools.
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
  const store = createPocketBaseStore({
    url: requiredEnv("POCKETBASE_URL"),
    email: requiredEnv("POCKETBASE_USER_EMAIL"),
    password: requiredEnv("POCKETBASE_USER_PASSWORD"),
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
