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
  "RAW IDEA",
  "IDEA NOTE",
  "SHOOT CARD",
  "SATELLITES",
] as const;
export type ConveyorSection = (typeof CONVEYOR_SECTIONS)[number];

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
  return (CONVEYOR_SECTIONS as readonly string[]).includes(upper)
    ? (upper as ConveyorSection)
    : null;
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
 * wrapped under `## RAW IDEA` so the original dump is preserved and labelled.
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
    base = `## RAW IDEA\n\n${base}`;
  }

  const heading = `## ${name}`;
  return base ? `${base}\n\n${heading}\n` : `${heading}\n`;
}

function cardFullText(card: Pick<ContentCard, "title" | "notes">): string {
  return card.notes ? `${card.title}\n\n${card.notes}` : card.title;
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
 * Build the clipboard payload for "Copy for ChatGPT": the stage's hidden prompt
 * followed by the relevant source text. The prompt is never shown on the card.
 * Returns `null` when the stage has no prompt.
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
    ? getSectionBody(card.notes, config.sourceSection) || cardFullText(card)
    : cardFullText(card);

  return `${config.prompt}\n\n${source}`.trim();
}
