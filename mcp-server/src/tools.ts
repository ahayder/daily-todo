import {
  appendSection,
  cleanPastedShootCard,
  draftToNotes,
  getColumnForStage,
  getEditorSections,
  getNextStep,
  getRowSnippet,
  getStageForColumn,
  notesToDraft,
  SHELF_STAGE_ORDER,
  type ConveyorSection,
  type ConveyorStage,
} from "@/lib/content-conveyor";
import { getSeriesList, getSeriesStats } from "@/lib/content-series";
import {
  addContentSeries,
  createAppNote,
  setAppNoteDeleted,
  updateAppNote,
  CONTENT_COLUMN_SHOOT_NEXT_ID,
  createContentCard,
  createContentSeries,
  getContentCardsForColumn,
  moveContentCard,
  setContentCardSeries,
  SHOOT_NEXT_SOFT_CAP,
  updateContentCard,
  updateContentCardPublishInfo,
  updateContentSeries,
} from "@/lib/store";
import { CONTENT_PLATFORMS } from "@/lib/types";
import type {
  AppNote,
  AppNoteKind,
  AppNoteStatus,
  ContentBoard,
  ContentCard,
  ContentLinks,
  ContentSeries,
} from "@/lib/types";
import type { ContentStore } from "./content-store";

/**
 * Content Planner actions for the MCP server. Every rule (moving, renumbering,
 * Published dates, sections, series) comes from the app's own pure helpers so
 * chat edits behave exactly like edits in the UI. Nothing is ever hard-deleted:
 * cards and series have no delete actions, and app notes are soft-deleted.
 */

export class ToolError extends Error {}

const PUBLISHED_LIMIT = 10;

/** Stage names as the user says them; "ideas" is the app's label for inbox. */
export const STAGE_NAMES = ["ideas", "develop", "shoot-next", "editing", "published"] as const;
export type StageName = (typeof STAGE_NAMES)[number];

function toConveyorStage(name: StageName): ConveyorStage {
  return name === "ideas" ? "inbox" : name;
}

function stageName(columnId: string): string {
  const stage = getStageForColumn(columnId);
  if (!stage) return columnId;
  return stage === "inbox" ? "ideas" : stage;
}

export type SectionInput = {
  original_thought?: string;
  idea_note?: string;
  shoot_card?: string;
  satellites?: string;
};

const SECTION_KEYS: Record<keyof SectionInput, ConveyorSection> = {
  original_thought: "ORIGINAL THOUGHT",
  idea_note: "IDEA NOTE",
  shoot_card: "SHOOT CARD",
  satellites: "SATELLITES",
};

async function requireBoard(store: ContentStore): Promise<ContentBoard> {
  const board = await store.loadBoard();
  if (!board) {
    throw new ToolError("No Content Planner board yet. Open the Content Planner in the app once, then try again.");
  }
  return board;
}

/** Find a card by exact id, else by title (exact, then contains). Never guesses between several. */
export function resolveCard(cards: Record<string, ContentCard>, query: string): ContentCard {
  const trimmed = query.trim();
  if (cards[trimmed]) return cards[trimmed];
  const all = Object.values(cards);
  const lower = trimmed.toLowerCase();
  const exact = all.filter((card) => card.title.trim().toLowerCase() === lower);
  const matches = exact.length > 0 ? exact : all.filter((card) => card.title.toLowerCase().includes(lower));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new ToolError(`No card matches "${query}". Use list_board to see cards and ids.`);
  const list = matches.map((card) => `- ${card.title} (id: ${card.id}, stage: ${stageName(card.columnId)})`).join("\n");
  throw new ToolError(`Several cards match "${query}". Call again with one of these ids:\n${list}`);
}

export function resolveSeries(board: ContentBoard, query: string): ContentSeries {
  const series = getSeriesList(board);
  const trimmed = query.trim();
  const byId = series.find((entry) => entry.id === trimmed);
  if (byId) return byId;
  const lower = trimmed.toLowerCase();
  const exact = series.filter((entry) => entry.title.toLowerCase() === lower);
  const matches = exact.length > 0 ? exact : series.filter((entry) => entry.title.toLowerCase().includes(lower));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new ToolError(`No series matches "${query}". Use list_series to see them.`);
  const list = matches.map((entry) => `- ${entry.title} (id: ${entry.id})`).join("\n");
  throw new ToolError(`Several series match "${query}". Call again with one of these ids:\n${list}`);
}

/** Save only the cards that actually changed, one record at a time. */
async function saveChangedCards(
  store: ContentStore,
  before: Record<string, ContentCard>,
  after: Record<string, ContentCard>,
): Promise<void> {
  for (const card of Object.values(after)) {
    if (before[card.id] !== card) await store.saveCard(card);
  }
}

function describeCard(card: ContentCard, board: ContentBoard | null) {
  const series = board ? getSeriesList(board).find((entry) => entry.id === card.seriesId) : undefined;
  return {
    id: card.id,
    title: card.title,
    stage: stageName(card.columnId),
    series: series?.title ?? null,
  };
}

export async function listBoard(store: ContentStore) {
  const [board, cards] = await Promise.all([requireBoard(store), store.loadCards()]);
  const stages = SHELF_STAGE_ORDER.map((stage) => {
    const columnCards = getContentCardsForColumn(cards, getColumnForStage(stage));
    // Published only grows; the newest few are enough for chat.
    const shown = stage === "published" ? columnCards.slice(0, PUBLISHED_LIMIT) : columnCards;
    return {
      stage: stage === "inbox" ? "ideas" : stage,
      total: columnCards.length,
      cards: shown.map((card) => ({ ...describeCard(card, board), snippet: getRowSnippet(card) })),
    };
  });
  return { stages, series: listSeriesFrom(board, cards) };
}

export async function getCard(store: ContentStore, query: string) {
  const [board, cards] = await Promise.all([store.loadBoard(), store.loadCards()]);
  const card = resolveCard(cards, query);
  const draft = notesToDraft(card.notes);
  return {
    ...describeCard(card, board),
    sections: {
      original_thought: draft["ORIGINAL THOUGHT"] ?? "",
      idea_note: draft["IDEA NOTE"] ?? "",
      shoot_card: draft["SHOOT CARD"] ?? "",
      satellites: draft.SATELLITES ?? "",
    },
    published_at: card.publishedAt ?? null,
    links: card.links ?? {},
    transcript: card.transcript ?? "",
  };
}

export async function addIdea(
  store: ContentStore,
  input: { title: string; original_thought?: string; series?: string },
) {
  const [board, cards] = await Promise.all([requireBoard(store), store.loadCards()]);
  const series = input.series ? resolveSeries(board, input.series) : null;
  const columnId = getColumnForStage("inbox");
  const card = createContentCard({
    columnId,
    title: input.title,
    notes: input.original_thought,
    order: getContentCardsForColumn(cards, columnId).length,
    seriesId: series?.id,
  });
  if (!card) throw new ToolError("A title is required.");
  // New ideas go to the top of Ideas, like capturing in the app.
  const next = moveContentCard({ ...cards, [card.id]: card }, card.id, columnId, 0);
  await saveChangedCards(store, cards, next);
  return { created: describeCard(next[card.id], board) };
}

export async function updateCard(
  store: ContentStore,
  input: { card: string; title?: string } & SectionInput,
) {
  const [board, cards] = await Promise.all([store.loadBoard(), store.loadCards()]);
  const card = resolveCard(cards, input.card);
  const draft = notesToDraft(card.notes);
  const sections = new Set(getEditorSections(card.columnId, card.notes));
  for (const [key, section] of Object.entries(SECTION_KEYS) as [keyof SectionInput, ConveyorSection][]) {
    const value = input[key];
    if (value === undefined) continue;
    draft[section] = section === "SHOOT CARD" ? cleanPastedShootCard(value) : value;
    sections.add(section);
  }
  const notes = draftToNotes(draft, [...sections]);
  const next = updateContentCard(cards, card.id, { title: input.title ?? card.title, notes });
  if (next === cards) throw new ToolError("Nothing to update (the title can't be blank).");
  await saveChangedCards(store, cards, next);
  return { updated: describeCard(next[card.id], board) };
}

export async function moveCard(store: ContentStore, input: { card: string; to: StageName | "next" }) {
  const [board, cards] = await Promise.all([store.loadBoard(), store.loadCards()]);
  const card = resolveCard(cards, input.card);
  let working = cards;
  let targetColumnId: string;

  if (input.to === "next") {
    // Same as the card's advance button: add the next section, then move.
    const step = getNextStep(card.columnId);
    if (!step) throw new ToolError(`"${card.title}" is already ${stageName(card.columnId)}; there is no next stage.`);
    if (step.sectionToAdd) {
      working = updateContentCard(working, card.id, {
        title: card.title,
        notes: appendSection(card.notes, step.sectionToAdd),
      });
    }
    targetColumnId = step.nextColumnId;
  } else {
    targetColumnId = getColumnForStage(toConveyorStage(input.to));
  }

  if (targetColumnId === card.columnId && working === cards) {
    return { moved: describeCard(card, board), note: "Already in that stage." };
  }
  const next = moveContentCard(working, card.id, targetColumnId, 0);
  await saveChangedCards(store, cards, next);

  const shootCount = getContentCardsForColumn(next, CONTENT_COLUMN_SHOOT_NEXT_ID).length;
  return {
    moved: describeCard(next[card.id], board),
    ...(targetColumnId === CONTENT_COLUMN_SHOOT_NEXT_ID && shootCount > SHOOT_NEXT_SOFT_CAP
      ? { note: `Shoot next now has ${shootCount} cards (soft cap is ${SHOOT_NEXT_SOFT_CAP}).` }
      : {}),
  };
}

export async function setPublishInfo(
  store: ContentStore,
  input: { card: string; links?: ContentLinks; transcript?: string },
) {
  const [board, cards] = await Promise.all([store.loadBoard(), store.loadCards()]);
  const card = resolveCard(cards, input.card);
  // Only the platforms given change; the rest keep their current link.
  const links: ContentLinks = { ...card.links };
  for (const platform of CONTENT_PLATFORMS) {
    const url = input.links?.[platform];
    if (url !== undefined) links[platform] = url;
  }
  const next = updateContentCardPublishInfo(cards, card.id, {
    links,
    transcript: input.transcript ?? card.transcript ?? "",
  });
  await saveChangedCards(store, cards, next);
  const saved = next[card.id];
  return { updated: describeCard(saved, board), links: saved.links ?? {}, has_transcript: Boolean(saved.transcript) };
}

function listSeriesFrom(board: ContentBoard, cards: Record<string, ContentCard>) {
  return getSeriesList(board).map((series) => {
    const stats = getSeriesStats(series.id, Object.values(cards));
    return { id: series.id, title: series.title, about: series.about, ...stats };
  });
}

export async function listSeries(store: ContentStore) {
  const [board, cards] = await Promise.all([requireBoard(store), store.loadCards()]);
  return { series: listSeriesFrom(board, cards) };
}

export async function addSeries(store: ContentStore, input: { title: string; about?: string }) {
  const board = await requireBoard(store);
  const series = createContentSeries(input);
  if (!series) throw new ToolError("A series title is required.");
  const duplicate = getSeriesList(board).find((entry) => entry.title.toLowerCase() === series.title.toLowerCase());
  if (duplicate) throw new ToolError(`A series called "${duplicate.title}" already exists (id: ${duplicate.id}).`);
  await store.saveBoard(addContentSeries(board, series));
  return { created: { id: series.id, title: series.title, about: series.about } };
}

export async function updateSeries(
  store: ContentStore,
  input: { series: string; title?: string; about?: string },
) {
  const board = await requireBoard(store);
  const current = resolveSeries(board, input.series);
  const next = updateContentSeries(board, current.id, {
    title: input.title ?? current.title,
    about: input.about ?? current.about,
  });
  if (next === board) return { updated: current, note: "Nothing changed." };
  await store.saveBoard(next);
  return { updated: getSeriesList(next).find((entry) => entry.id === current.id) };
}

export async function setCardSeries(store: ContentStore, input: { card: string; series: string | null }) {
  const [board, cards] = await Promise.all([requireBoard(store), store.loadCards()]);
  const card = resolveCard(cards, input.card);
  const series = input.series ? resolveSeries(board, input.series) : null;
  const next = setContentCardSeries(cards, card.id, series?.id ?? null);
  await saveChangedCards(store, cards, next);
  return { updated: describeCard(next[card.id], board) };
}

// ---- App notes: quick notes about the DailyTodo app itself ----
// Deleting is always a soft delete (deletedAt); nothing is ever removed.

function describeNote(note: AppNote) {
  return {
    id: note.id,
    text: note.text,
    kind: note.kind,
    status: note.status,
    screen: note.screen,
    created_at: note.createdAt,
    ...(note.deletedAt ? { deleted_at: note.deletedAt } : {}),
  };
}

/** Find a note by exact id, else by its text (contains). Never guesses between several. */
export function resolveNote(notes: Record<string, AppNote>, query: string, includeDeleted = false): AppNote {
  const trimmed = query.trim();
  if (notes[trimmed]) return notes[trimmed];
  const lower = trimmed.toLowerCase();
  const matches = Object.values(notes).filter(
    (note) => (includeDeleted || !note.deletedAt) && note.text.toLowerCase().includes(lower),
  );
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new ToolError(`No app note matches "${query}". Use list_app_notes to see them.`);
  const list = matches.map((note) => `- ${note.text.slice(0, 80)} (id: ${note.id})`).join("\n");
  throw new ToolError(`Several app notes match "${query}". Call again with one of these ids:\n${list}`);
}

export async function listAppNotes(
  store: ContentStore,
  input: { status?: AppNoteStatus | "all"; kind?: AppNoteKind; include_deleted?: boolean } = {},
) {
  const notes = Object.values(await store.loadAppNotes())
    .filter((note) => input.include_deleted || !note.deletedAt)
    .filter((note) => (input.status ?? "open") === "all" || note.status === (input.status ?? "open"))
    .filter((note) => !input.kind || note.kind === input.kind)
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
  return { total: notes.length, notes: notes.map(describeNote) };
}

export async function getAppNote(store: ContentStore, query: string) {
  return describeNote(resolveNote(await store.loadAppNotes(), query, true));
}

export async function addAppNote(store: ContentStore, input: { text: string; kind?: AppNoteKind }) {
  const note = createAppNote({ text: input.text, kind: input.kind, screen: "chat" });
  if (!note) throw new ToolError("The note text can't be blank.");
  await store.saveAppNote(note);
  return { created: describeNote(note) };
}

export async function updateAppNoteTool(
  store: ContentStore,
  input: { note: string; text?: string; kind?: AppNoteKind; status?: AppNoteStatus },
) {
  const notes = await store.loadAppNotes();
  const note = resolveNote(notes, input.note);
  const next = updateAppNote(notes, note.id, input);
  if (next === notes) return { updated: describeNote(note), note: "Nothing changed." };
  await store.saveAppNote(next[note.id]);
  return { updated: describeNote(next[note.id]) };
}

/** Soft delete (deleted: true) or restore. The record always stays on the server. */
export async function setAppNoteDeletedTool(store: ContentStore, input: { note: string; deleted: boolean }) {
  const notes = await store.loadAppNotes();
  const note = resolveNote(notes, input.note, !input.deleted);
  const next = setAppNoteDeleted(notes, note.id, input.deleted);
  if (next === notes) return { note: describeNote(note), message: input.deleted ? "Already deleted." : "Not deleted." };
  await store.saveAppNote(next[note.id]);
  return { [input.deleted ? "deleted" : "restored"]: describeNote(next[note.id]) };
}
