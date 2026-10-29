import PocketBase from "pocketbase";
import { CHANGE_REQUEST_KINDS, CONTENT_PLATFORMS } from "@/lib/types";
import type { ChangeRequest, ContentBoard, ContentCard, ContentLinks, ContentSeries } from "@/lib/types";
import { createPocketBaseMemoryStore, type MemoryStore } from "./memory-store";

/**
 * Where the MCP tools read and write Content Planner data. Writes are one
 * record at a time (server-first sync): nothing is ever deleted or replaced
 * wholesale, so a device's missing data can never wipe the server.
 */
export type ContentStore = {
  /** The board, or null when the user has never opened the Content Planner. */
  loadBoard(): Promise<ContentBoard | null>;
  loadCards(): Promise<Record<string, ContentCard>>;
  saveBoard(board: ContentBoard): Promise<void>;
  saveCard(card: ContentCard): Promise<void>;
  loadChangeRequests(): Promise<Record<string, ChangeRequest>>;
  /** Change requests are only ever soft-deleted (deletedAt), so there is no delete. */
  saveChangeRequest(note: ChangeRequest): Promise<void>;
};

/** Everything the MCP server reads and writes. */
export type AppStore = ContentStore & MemoryStore;

type Row = Record<string, unknown> & { id: string };

// Mirrors the readers in src/lib/pocketbase/persistence-repository.ts so the
// app and the MCP server see records the same way.
function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const time = Date.parse(value.replace(" ", "T"));
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function normalizeLinks(value: unknown): ContentLinks | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const links: ContentLinks = {};
  for (const platform of CONTENT_PLATFORMS) {
    const url = (value as Record<string, unknown>)[platform];
    if (typeof url === "string" && url.trim()) links[platform] = url.trim();
  }
  return Object.keys(links).length > 0 ? links : null;
}

function normalizeSeries(value: unknown): ContentSeries[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { id, title, about, createdAt } = entry as Record<string, unknown>;
    if (typeof id !== "string" || !id || typeof title !== "string" || !title.trim()) return [];
    return [
      {
        id,
        title: title.trim(),
        about: typeof about === "string" ? about : "",
        createdAt: typeof createdAt === "string" ? createdAt : new Date(0).toISOString(),
      },
    ];
  });
}

export function rowToBoard(row: Row): ContentBoard {
  const series = normalizeSeries(row.series_json);
  return {
    columns: Array.isArray(row.columns_json) ? row.columns_json : [],
    ...(series.length > 0 ? { series } : {}),
    updatedAt: String(row.updated_at_client ?? row.updated ?? new Date(0).toISOString()),
  };
}

export function rowToCard(row: Row): ContentCard | null {
  if (!row.card_id || !row.column_id || !row.title) return null;
  const links = normalizeLinks(row.links);
  return {
    id: String(row.card_id),
    columnId: String(row.column_id),
    title: String(row.title),
    notes: typeof row.notes === "string" ? row.notes : "",
    order: Math.max(0, Math.trunc(Number(row.position ?? 0))),
    updatedAt: String(row.updated_at_client ?? row.updated ?? new Date(0).toISOString()),
    publishedAt: normalizeDate(row.published_at),
    ...(links ? { links } : {}),
    ...(typeof row.transcript === "string" && row.transcript ? { transcript: row.transcript } : {}),
    ...(typeof row.series_id === "string" && row.series_id ? { seriesId: row.series_id } : {}),
  };
}

export function cardToPayload(card: ContentCard, owner: string) {
  return {
    owner,
    card_id: card.id,
    column_id: card.columnId,
    title: card.title,
    notes: card.notes,
    position: card.order,
    // Empty strings clear optional fields in PocketBase.
    published_at: card.publishedAt ?? "",
    links: card.links ?? {},
    transcript: card.transcript ?? "",
    series_id: card.seriesId ?? "",
    updated_at_client: card.updatedAt,
  };
}

// Mirrors changeRequestFromRow / changeRequestToRow in persistence-repository.ts.
export function rowToChangeRequest(row: Row): ChangeRequest | null {
  if (!row.note_id) return null;
  const updatedAt = String(row.updated_at_client ?? row.updated ?? new Date(0).toISOString());
  const kind = String(row.kind ?? "");
  return {
    id: String(row.note_id),
    text: typeof row.text === "string" ? row.text : "",
    kind: (CHANGE_REQUEST_KINDS as readonly string[]).includes(kind) ? (kind as ChangeRequest["kind"]) : "idea",
    status: row.status === "done" ? "done" : "open",
    screen: typeof row.screen === "string" ? row.screen : "",
    createdAt: normalizeDate(row.created_at_client) ?? updatedAt,
    updatedAt,
    deletedAt: normalizeDate(row.deleted_at),
  };
}

export function changeRequestToPayload(note: ChangeRequest, owner: string) {
  return {
    owner,
    note_id: note.id,
    text: note.text,
    kind: note.kind,
    status: note.status,
    screen: note.screen,
    created_at_client: note.createdAt,
    deleted_at: note.deletedAt ?? "",
    updated_at_client: note.updatedAt,
  };
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { status?: unknown }).status === 404;
}

/** The user id inside a PocketBase auth token, or null when it isn't one. */
export function tokenUserId(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.id === "string" && payload.type === "auth" ? payload.id : null;
  } catch {
    return null;
  }
}

export type PocketBaseAuth = { token: string } | { email: string; password: string };

/**
 * PocketBase store signed in as the app user (never a superuser), so the
 * collections' `owner = @request.auth.id` rules keep it to that user's data.
 * Prefer a long-lived impersonation token (no password stored on the server);
 * email + password is the fallback.
 */
export function createPocketBaseStore(options: { url: string; auth: PocketBaseAuth }): AppStore {
  const pb = new PocketBase(options.url);
  pb.autoCancellation(false);
  const { auth } = options;
  const tokenOwner = "token" in auth ? tokenUserId(auth.token) : null;
  if ("token" in auth && !tokenOwner) throw new Error("POCKETBASE_USER_TOKEN is not a PocketBase user token");

  async function ownerId(): Promise<string> {
    if ("token" in auth) {
      pb.authStore.save(auth.token);
      if (!pb.authStore.isValid) throw new Error("POCKETBASE_USER_TOKEN has expired; create a new one");
      return tokenOwner!;
    }
    if (!pb.authStore.isValid || !pb.authStore.record) {
      await pb.collection("users").authWithPassword(auth.email, auth.password);
    }
    return pb.authStore.record!.id;
  }

  async function findOne(collection: string, filter: string): Promise<Row | null> {
    try {
      return await pb.collection(collection).getFirstListItem<Row>(filter);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  return {
    ...createPocketBaseMemoryStore({ pb, ownerId, findOne }),

    async loadBoard() {
      const owner = await ownerId();
      const row = await findOne("content_boards", pb.filter("owner = {:owner}", { owner }));
      return row ? rowToBoard(row) : null;
    },

    async loadCards() {
      const owner = await ownerId();
      const rows = await pb
        .collection("content_cards")
        .getFullList<Row>({ filter: pb.filter("owner = {:owner}", { owner }) });
      const cards: Record<string, ContentCard> = {};
      for (const row of rows) {
        const card = rowToCard(row);
        if (card) cards[card.id] = card;
      }
      return cards;
    },

    async saveBoard(board) {
      const owner = await ownerId();
      const existing = await findOne("content_boards", pb.filter("owner = {:owner}", { owner }));
      const payload = {
        owner,
        columns_json: board.columns,
        series_json: board.series ?? [],
        updated_at_client: board.updatedAt,
      };
      if (existing) await pb.collection("content_boards").update(existing.id, payload);
      else await pb.collection("content_boards").create(payload);
    },

    async loadChangeRequests() {
      const owner = await ownerId();
      const rows = await pb
        // Stored name kept: change requests live in the `app_notes` collection.
        .collection("app_notes")
        .getFullList<Row>({ filter: pb.filter("owner = {:owner}", { owner }) });
      const notes: Record<string, ChangeRequest> = {};
      for (const row of rows) {
        const note = rowToChangeRequest(row);
        if (note) notes[note.id] = note;
      }
      return notes;
    },

    async saveChangeRequest(note) {
      const owner = await ownerId();
      const existing = await findOne(
        "app_notes",
        pb.filter("owner = {:owner} && note_id = {:noteId}", { owner, noteId: note.id }),
      );
      const payload = changeRequestToPayload(note, owner);
      if (existing) await pb.collection("app_notes").update(existing.id, payload);
      else await pb.collection("app_notes").create(payload);
    },

    async saveCard(card) {
      const owner = await ownerId();
      const existing = await findOne(
        "content_cards",
        pb.filter("owner = {:owner} && card_id = {:cardId}", { owner, cardId: card.id }),
      );
      const payload = cardToPayload(card, owner);
      if (existing) await pb.collection("content_cards").update(existing.id, payload);
      else await pb.collection("content_cards").create(payload);
    },
  };
}
