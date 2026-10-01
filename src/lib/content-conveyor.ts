import {
  CONTENT_COLUMN_DEVELOP_ID,
  CONTENT_COLUMN_INBOX_ID,
  CONTENT_COLUMN_PUBLISHED_ID,
  CONTENT_COLUMN_SHOOT_NEXT_ID,
} from "@/lib/store";
import type { ContentCard } from "@/lib/types";

/**
 * Content Conveyor helpers.
 *
 * The content planner models one canonical card per video that "grows" through
 * four fixed states. All of that knowledge lives here as pure functions so the
 * UI stays thin and the behaviour is unit-testable. Card stages come from the
 * card's column id (never its user-editable title); section content lives as
 * markdown `##` headings inside the existing `notes` field, so nothing about
 * the persisted shape changes.
 */

export type ConveyorStage = "inbox" | "develop" | "shoot-next" | "published";

export const CONVEYOR_SECTIONS = [
  "ORIGINAL THOUGHT",
  "IDEA NOTE",
  "SHOOT CARD",
  "SATELLITES",
] as const;
export type ConveyorSection = (typeof CONVEYOR_SECTIONS)[number];

/**
 * Legacy section headings that map onto a canonical section. Older cards were
 * saved with `## RAW IDEA`; they still parse (and label) as ORIGINAL THOUGHT so
 * no data migration is needed.
 */
const SECTION_ALIASES: Record<string, ConveyorSection> = {
  "RAW IDEA": "ORIGINAL THOUGHT",
};

const COLUMN_TO_STAGE: Record<string, ConveyorStage> = {
  [CONTENT_COLUMN_INBOX_ID]: "inbox",
  [CONTENT_COLUMN_DEVELOP_ID]: "develop",
  [CONTENT_COLUMN_SHOOT_NEXT_ID]: "shoot-next",
  [CONTENT_COLUMN_PUBLISHED_ID]: "published",
};

/** Stage for a column, or `null` for a custom column (no conveyor UI). */
export function getStageForColumn(columnId: string): ConveyorStage | null {
  return COLUMN_TO_STAGE[columnId] ?? null;
}

export type ConveyorNextStep = {
  /** Button label shown on the card. */
  label: string;
  /** Column the card moves to when the button is pressed. */
  nextColumnId: string;
  /** Section to append to `notes` on the way (null = just move). */
  sectionToAdd: ConveyorSection | null;
};

const NEXT_STEP: Partial<Record<ConveyorStage, ConveyorNextStep>> = {
  inbox: {
    label: "Develop this",
    nextColumnId: CONTENT_COLUMN_DEVELOP_ID,
    sectionToAdd: "IDEA NOTE",
  },
  develop: {
    label: "Ready to shoot",
    nextColumnId: CONTENT_COLUMN_SHOOT_NEXT_ID,
    sectionToAdd: "SHOOT CARD",
  },
  "shoot-next": {
    label: "Mark published",
    nextColumnId: CONTENT_COLUMN_PUBLISHED_ID,
    sectionToAdd: null,
  },
};

/** The single next-step action for a column, or `null` if there is none. */
export function getNextStep(columnId: string): ConveyorNextStep | null {
  const stage = getStageForColumn(columnId);
  if (!stage) return null;
  return NEXT_STEP[stage] ?? null;
}

export type ParsedSection = { name: ConveyorSection | null; body: string };

const SECTION_HEADING_RE = /^##\s+(.+?)\s*$/;

function matchSectionName(text: string): ConveyorSection | null {
  const upper = text.trim().toUpperCase();
  if ((CONVEYOR_SECTIONS as readonly string[]).includes(upper)) {
    return upper as ConveyorSection;
  }
  return SECTION_ALIASES[upper] ?? null;
}

/**
 * Split `notes` into sections at recognized `## SECTION` headings. Any content
 * before the first recognized heading is returned as a leading section with a
 * `null` name. An empty leading section is dropped.
 */
export function parseSections(notes: string | undefined): ParsedSection[] {
  const lines = (notes ?? "").split(/\r?\n/);
  const sections: ParsedSection[] = [];
  let currentName: ConveyorSection | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    sections.push({ name: currentName, body: bodyLines.join("\n").trim() });
    bodyLines = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(SECTION_HEADING_RE);
    const sectionName = headingMatch ? matchSectionName(headingMatch[1]) : null;
    if (sectionName) {
      flush();
      currentName = sectionName;
    } else {
      bodyLines.push(line);
    }
  }
  flush();

  return sections.filter(
    (section, index) => !(index === 0 && section.name === null && section.body === ""),
  );
}

/** True when `notes` contains at least one recognized conveyor section. */
export function hasConveyorSections(notes: string | undefined): boolean {
  return parseSections(notes).some((section) => section.name !== null);
}

/** Body text of a named section, or "" when it is absent. */
export function getSectionBody(
  notes: string | undefined,
  name: ConveyorSection,
): string {
  return parseSections(notes).find((section) => section.name === name)?.body ?? "";
}

/**
 * Append an empty `## SECTION` heading to `notes`, ready to type under.
 * Idempotent: if the section already exists, `notes` is returned unchanged.
 * When `notes` has no recognized sections yet, its existing body is first
 * wrapped under `## ORIGINAL THOUGHT` so the original dump is preserved and
 * labelled.
 */
export function appendSection(
  notes: string | undefined,
  name: ConveyorSection,
): string {
  const sections = parseSections(notes);
  if (sections.some((section) => section.name === name)) {
    return notes ?? "";
  }

  const hasSections = sections.some((section) => section.name !== null);
  let base = (notes ?? "").trim();
  if (!hasSections && base) {
    base = `## ORIGINAL THOUGHT\n\n${base}`;
  }

  const heading = `## ${name}`;
  return base ? `${base}\n\n${heading}\n` : `${heading}\n`;
}

/**
 * Remove recognized `## SECTION` heading lines (including legacy aliases) while
 * keeping their body text, then collapse the blank lines left behind. Used to
 * build a clean idea payload with no conveyor scaffolding for ChatGPT.
 */
export function stripSectionHeadings(notes: string | undefined): string {
  const kept = (notes ?? "")
    .split(/\r?\n/)
    .filter((line) => {
      const headingMatch = line.match(SECTION_HEADING_RE);
      return !(headingMatch && matchSectionName(headingMatch[1]));
    })
    .join("\n");
  return kept.replace(/\n{3,}/g, "\n\n").trim();
}

type ChatGptPromptConfig = {
  prompt: string;
  /** Section to send as source; null = the whole card. */
  sourceSection: ConveyorSection | null;
};

const CHATGPT_PROMPTS: Partial<Record<ConveyorStage, ChatGptPromptConfig>> = {
  inbox: {
    prompt:
      "Turn this raw idea into my Idea Note format — angle, hook, talk points, risk. Keep it tight, don't write a script.",
    sourceSection: null,
  },
  develop: {
    prompt:
      "Turn this Idea Note into my Shoot Card format — beats, hook options, visual hook, title.",
    sourceSection: "IDEA NOTE",
  },
};

/** True when the card's stage offers a "Copy for ChatGPT" prompt. */
export function hasChatGptPrompt(columnId: string): boolean {
  const stage = getStageForColumn(columnId);
  return Boolean(stage && CHATGPT_PROMPTS[stage]);
}

/**
 * Build the clipboard payload for "Copy for ChatGPT": the stage's hidden prompt,
 * the card title as a headline, then a clean idea body. The body never includes
 * conveyor `## SECTION` heading scaffolding, so pasting it into ChatGPT reads as
 * plain intent. The prompt is never shown on the card. Returns `null` when the
 * stage has no prompt.
 */
export function buildChatGptClipboard(
  columnId: string,
  card: Pick<ContentCard, "title" | "notes">,
): string | null {
  const stage = getStageForColumn(columnId);
  if (!stage) return null;
  const config = CHATGPT_PROMPTS[stage];
  if (!config) return null;

  const source = config.sourceSection
    ? getSectionBody(card.notes, config.sourceSection) ||
      getSectionBody(card.notes, "ORIGINAL THOUGHT") ||
      stripSectionHeadings(card.notes)
    : getSectionBody(card.notes, "ORIGINAL THOUGHT") ||
      stripSectionHeadings(card.notes);

  const idea = [card.title, source].filter(Boolean).join("\n\n");

  return `${config.prompt}\n\n${idea}`.trim();
}

/** Canonical stage order, top of the shelf first (what to do soonest). */
export const SHELF_STAGE_ORDER: ConveyorStage[] = [
  "shoot-next",
  "develop",
  "inbox",
  "published",
];

const STAGE_TO_COLUMN: Record<ConveyorStage, string> = {
  inbox: CONTENT_COLUMN_INBOX_ID,
  develop: CONTENT_COLUMN_DEVELOP_ID,
  "shoot-next": CONTENT_COLUMN_SHOOT_NEXT_ID,
  published: CONTENT_COLUMN_PUBLISHED_ID,
};

/** Column id for a conveyor stage. */
export function getColumnForStage(stage: ConveyorStage): string {
  return STAGE_TO_COLUMN[stage];
}

/** The three sections a card grows through (Satellites is optional extra). */
export const GROWTH_SECTIONS = ["ORIGINAL THOUGHT", "IDEA NOTE", "SHOOT CARD"] as const;
export type GrowthSection = (typeof GROWTH_SECTIONS)[number];

/** Which growth sections hold real text — drives the progress dots on a row. */
export function getSectionFill(notes: string | undefined): Record<GrowthSection, boolean> {
  const sections = parseSections(notes);
  const hasNamed = sections.some((section) => section.name !== null);
  const filled = (name: GrowthSection) =>
    sections.some((section) => section.name === name && section.body !== "");
  return {
    // Plain notes (no headings yet) count as the original thought.
    "ORIGINAL THOUGHT": hasNamed
      ? filled("ORIGINAL THOUGHT") || sections.some((s) => s.name === null && s.body !== "")
      : (notes ?? "").trim() !== "",
    "IDEA NOTE": filled("IDEA NOTE"),
    "SHOOT CARD": filled("SHOOT CARD"),
  };
}

/** Markdown → one calm line of plain text for list previews. */
function toPlainSnippet(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "")
        .replace(/^>\s?/, "")
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_`~]/g, "")
        .trim(),
    )
    .filter(Boolean)
    .join(" · ");
}

/**
 * The most useful preview text for a card's row on the shelf: the section the
 * card is currently working on, falling back to earlier sections, then to the
 * plain notes. Returns "" when there is nothing to show.
 */
export function getRowSnippet(card: Pick<ContentCard, "columnId" | "notes">): string {
  const stage = getStageForColumn(card.columnId);
  const preference: ConveyorSection[] =
    stage === "shoot-next" || stage === "published"
      ? ["SHOOT CARD", "IDEA NOTE", "ORIGINAL THOUGHT"]
      : stage === "develop"
        ? ["IDEA NOTE", "ORIGINAL THOUGHT"]
        : ["ORIGINAL THOUGHT"];
  for (const name of preference) {
    const body = getSectionBody(card.notes, name);
    if (body) return toPlainSnippet(body);
  }
  return toPlainSnippet(stripSectionHeadings(card.notes));
}

const STAGE_SECTIONS: Record<ConveyorStage, ConveyorSection[]> = {
  inbox: ["ORIGINAL THOUGHT"],
  develop: ["ORIGINAL THOUGHT", "IDEA NOTE"],
  "shoot-next": ["ORIGINAL THOUGHT", "IDEA NOTE", "SHOOT CARD"],
  published: ["ORIGINAL THOUGHT", "IDEA NOTE", "SHOOT CARD"],
};

/**
 * Sections the card editor shows, in canonical order: the ones the card's
 * stage calls for plus any the notes already contain (e.g. after moving a card
 * back a stage, or a Satellites section). Original thought is always shown.
 */
export function getEditorSections(
  columnId: string,
  notes: string | undefined,
): ConveyorSection[] {
  const stage = getStageForColumn(columnId) ?? "inbox";
  const present = new Set<ConveyorSection>(STAGE_SECTIONS[stage]);
  for (const section of parseSections(notes)) {
    if (section.name) present.add(section.name);
  }
  return CONVEYOR_SECTIONS.filter((name) => present.has(name));
}

export type CardDraftSections = Partial<Record<ConveyorSection, string>>;

/**
 * Split stored notes into editable section bodies. Unlabelled text (plain
 * notes, or text before the first heading) belongs to Original thought.
 */
export function notesToDraft(notes: string | undefined): CardDraftSections {
  const draft: CardDraftSections = {};
  for (const section of parseSections(notes)) {
    const name = section.name ?? "ORIGINAL THOUGHT";
    draft[name] = [draft[name], section.body].filter(Boolean).join("\n\n");
  }
  return draft;
}

/**
 * Compose editable sections back into stored notes. A card that only has an
 * original thought stays plain text (no heading scaffolding); otherwise every
 * shown section is written as a `## SECTION` block, empty ones included so the
 * card keeps its place in the conveyor.
 */
export function draftToNotes(
  draft: CardDraftSections,
  sections: ConveyorSection[],
): string {
  const named = CONVEYOR_SECTIONS.filter((name) => sections.includes(name));
  if (named.length === 1 && named[0] === "ORIGINAL THOUGHT") {
    return (draft["ORIGINAL THOUGHT"] ?? "").trim();
  }
  return named
    .map((name) => {
      const body = (draft[name] ?? "").trim();
      return body ? `## ${name}\n\n${body}` : `## ${name}`;
    })
    .join("\n\n");
}

/**
 * The card to work on next: the top of Shoot next, else the top of Develop.
 * `cardsByColumn` must already be sorted by order.
 */
export function getNextUpCard(
  cardsByColumn: (columnId: string) => ContentCard[],
): ContentCard | null {
  return (
    cardsByColumn(CONTENT_COLUMN_SHOOT_NEXT_ID)[0] ??
    cardsByColumn(CONTENT_COLUMN_DEVELOP_ID)[0] ??
    null
  );
}

/** A kind weekly target: four pieces shipped a week; a fifth is a bonus. */
export const WEEKLY_SHIP_GOAL = 4;

/** Monday 00:00 (local time) of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/** True when `iso` falls in the same Monday-start week as `now`. */
export function isInCurrentWeek(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return false;
  const start = getWeekStart(now).getTime();
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return time >= start && time < end;
}

/** Published cards shipped this week (by `publishedAt`). */
export function countShippedThisWeek(cards: ContentCard[], now: Date): number {
  return cards.filter(
    (card) =>
      card.columnId === CONTENT_COLUMN_PUBLISHED_ID && isInCurrentWeek(card.publishedAt, now),
  ).length;
}
