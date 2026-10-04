import { describe, expect, it } from "vitest";

import {
  CONTENT_COLUMN_DEVELOP_ID,
  CONTENT_COLUMN_INBOX_ID,
  CONTENT_COLUMN_PUBLISHED_ID,
  CONTENT_COLUMN_SHOOT_NEXT_ID,
} from "@/lib/store";
import {
  appendSection,
  buildChatGptClipboard,
  cleanPastedShootCard,
  countShippedThisWeek,
  draftToNotes,
  getEditorSections,
  getNextUpCard,
  getRowSnippet,
  getSectionFill,
  getShootIntent,
  getWeekStart,
  isInCurrentWeek,
  notesToDraft,
  getNextStep,
  getSectionBody,
  getStageForColumn,
  hasChatGptPrompt,
  hasConveyorSections,
  parseSections,
  parseShootCard,
  stripSectionHeadings,
} from "@/lib/content-conveyor";
import type { ContentCard } from "@/lib/types";

describe("getStageForColumn", () => {
  it("maps canonical columns to stages", () => {
    expect(getStageForColumn(CONTENT_COLUMN_INBOX_ID)).toBe("inbox");
    expect(getStageForColumn(CONTENT_COLUMN_DEVELOP_ID)).toBe("develop");
    expect(getStageForColumn(CONTENT_COLUMN_SHOOT_NEXT_ID)).toBe("shoot-next");
    expect(getStageForColumn(CONTENT_COLUMN_PUBLISHED_ID)).toBe("published");
  });

  it("returns null for custom columns", () => {
    expect(getStageForColumn("content-column-ideas")).toBeNull();
    expect(getStageForColumn("whatever")).toBeNull();
  });
});

describe("getNextStep", () => {
  it("advances inbox → develop and adds an Idea Note", () => {
    expect(getNextStep(CONTENT_COLUMN_INBOX_ID)).toEqual({
      label: "Develop this",
      nextColumnId: CONTENT_COLUMN_DEVELOP_ID,
      sectionToAdd: "IDEA NOTE",
    });
  });

  it("advances develop → shoot next and adds a Shoot Card", () => {
    expect(getNextStep(CONTENT_COLUMN_DEVELOP_ID)).toEqual({
      label: "Ready to shoot",
      nextColumnId: CONTENT_COLUMN_SHOOT_NEXT_ID,
      sectionToAdd: "SHOOT CARD",
    });
  });

  it("advances shoot next → published without adding a section", () => {
    expect(getNextStep(CONTENT_COLUMN_SHOOT_NEXT_ID)).toEqual({
      label: "Mark published",
      nextColumnId: CONTENT_COLUMN_PUBLISHED_ID,
      sectionToAdd: null,
    });
  });

  it("has no next step from published or custom columns", () => {
    expect(getNextStep(CONTENT_COLUMN_PUBLISHED_ID)).toBeNull();
    expect(getNextStep("content-column-ideas")).toBeNull();
  });
});

describe("parseSections", () => {
  it("treats unsectioned notes as a single nameless block", () => {
    expect(parseSections("just a raw dump")).toEqual([
      { name: null, body: "just a raw dump" },
    ]);
  });

  it("returns an empty array for empty notes", () => {
    expect(parseSections("")).toEqual([]);
    expect(parseSections(undefined)).toEqual([]);
  });

  it("splits recognized headings and keeps a leading preamble", () => {
    const notes = "raw stuff\n\n## IDEA NOTE\n\nthe angle\n\n## SHOOT CARD\n\nbeats";
    expect(parseSections(notes)).toEqual([
      { name: null, body: "raw stuff" },
      { name: "IDEA NOTE", body: "the angle" },
      { name: "SHOOT CARD", body: "beats" },
    ]);
  });

  it("matches heading names case-insensitively and ignores unknown headings", () => {
    const notes = "## idea note\n\nlower\n\n## Random\n\nkept as body";
    expect(parseSections(notes)).toEqual([
      { name: "IDEA NOTE", body: "lower\n\n## Random\n\nkept as body" },
    ]);
  });

  it("parses the legacy RAW IDEA heading as ORIGINAL THOUGHT", () => {
    const notes = "## RAW IDEA\n\ndump\n\n## IDEA NOTE\n\nangle";
    expect(parseSections(notes)).toEqual([
      { name: "ORIGINAL THOUGHT", body: "dump" },
      { name: "IDEA NOTE", body: "angle" },
    ]);
  });
});

describe("hasConveyorSections / getSectionBody", () => {
  it("detects sections", () => {
    expect(hasConveyorSections("plain text")).toBe(false);
    expect(hasConveyorSections("## IDEA NOTE\n\nx")).toBe(true);
  });

  it("reads a section body", () => {
    const notes = "## RAW IDEA\n\ndump\n\n## IDEA NOTE\n\nthe angle";
    expect(getSectionBody(notes, "IDEA NOTE")).toBe("the angle");
    expect(getSectionBody(notes, "SHOOT CARD")).toBe("");
  });
});

describe("appendSection", () => {
  it("wraps existing unsectioned notes under ORIGINAL THOUGHT before adding", () => {
    expect(appendSection("my raw dump", "IDEA NOTE")).toBe(
      "## ORIGINAL THOUGHT\n\nmy raw dump\n\n## IDEA NOTE\n",
    );
  });

  it("adds a section without ORIGINAL THOUGHT when notes are empty", () => {
    expect(appendSection("", "IDEA NOTE")).toBe("## IDEA NOTE\n");
    expect(appendSection(undefined, "SHOOT CARD")).toBe("## SHOOT CARD\n");
  });

  it("appends to already-sectioned notes without re-wrapping", () => {
    const notes = "## ORIGINAL THOUGHT\n\ndump\n\n## IDEA NOTE\n\nangle";
    expect(appendSection(notes, "SHOOT CARD")).toBe(`${notes}\n\n## SHOOT CARD\n`);
  });

  it("does not re-wrap legacy RAW IDEA notes (alias is recognized)", () => {
    const notes = "## RAW IDEA\n\ndump";
    expect(appendSection(notes, "IDEA NOTE")).toBe(`${notes}\n\n## IDEA NOTE\n`);
  });

  it("is idempotent when the section already exists", () => {
    const notes = "## ORIGINAL THOUGHT\n\ndump\n\n## IDEA NOTE\n\nangle";
    expect(appendSection(notes, "IDEA NOTE")).toBe(notes);
  });
});

describe("stripSectionHeadings", () => {
  it("removes recognized headings (incl. legacy alias) but keeps bodies", () => {
    const notes = "## ORIGINAL THOUGHT\n\ndump\n\n## IDEA NOTE\n\nangle";
    expect(stripSectionHeadings(notes)).toBe("dump\n\nangle");
    expect(stripSectionHeadings("## RAW IDEA\n\ndump")).toBe("dump");
  });

  it("leaves unsectioned notes untouched", () => {
    expect(stripSectionHeadings("just a raw dump")).toBe("just a raw dump");
  });
});

describe("buildChatGptClipboard", () => {
  it("builds an Idea Note prompt from the whole card in inbox", () => {
    const result = buildChatGptClipboard(CONTENT_COLUMN_INBOX_ID, {
      title: "Remote job websites",
      notes: "positioning is the bottleneck",
    });
    expect(result).toContain("Turn this raw idea into my Idea Note format");
    expect(result).toContain("Remote job websites");
    expect(result).toContain("positioning is the bottleneck");
  });

  it("builds a Shoot Card prompt from the Idea Note section in develop", () => {
    const result = buildChatGptClipboard(CONTENT_COLUMN_DEVELOP_ID, {
      title: "Remote job websites",
      notes: "## ORIGINAL THOUGHT\n\ndump\n\n## IDEA NOTE\n\nangle and hook",
    });
    expect(result).toContain("Turn this Idea Note into my Shoot Card format");
    expect(result).toContain("Remote job websites");
    expect(result).toContain("angle and hook");
    expect(result).not.toContain("dump");
  });

  it("never leaks conveyor headings into the payload", () => {
    const result = buildChatGptClipboard(CONTENT_COLUMN_INBOX_ID, {
      title: "Remote job websites",
      notes: "## ORIGINAL THOUGHT\n\npositioning is the bottleneck",
    });
    expect(result).not.toContain("##");
    expect(result).toContain("positioning is the bottleneck");
  });

  it("falls back to the original-thought body when the Idea Note is still empty", () => {
    const result = buildChatGptClipboard(CONTENT_COLUMN_DEVELOP_ID, {
      title: "Remote job websites",
      notes: "## ORIGINAL THOUGHT\n\nspend 7 days watching randomly\n\n## IDEA NOTE\n",
    });
    expect(result).toContain("spend 7 days watching randomly");
    expect(result).not.toContain("##");
  });

  it("returns null when the stage has no prompt", () => {
    expect(
      buildChatGptClipboard(CONTENT_COLUMN_SHOOT_NEXT_ID, { title: "x", notes: "" }),
    ).toBeNull();
    expect(hasChatGptPrompt(CONTENT_COLUMN_INBOX_ID)).toBe(true);
    expect(hasChatGptPrompt(CONTENT_COLUMN_PUBLISHED_ID)).toBe(false);
  });
});

describe("shelf helpers", () => {
  it("getEditorSections shows stage sections plus any already present", () => {
    expect(getEditorSections(CONTENT_COLUMN_INBOX_ID, "plain")).toEqual(["ORIGINAL THOUGHT"]);
    expect(getEditorSections(CONTENT_COLUMN_DEVELOP_ID, "")).toEqual(["ORIGINAL THOUGHT", "IDEA NOTE"]);
    expect(getEditorSections(CONTENT_COLUMN_INBOX_ID, "## SHOOT CARD\n\nbeats")).toEqual([
      "ORIGINAL THOUGHT",
      "SHOOT CARD",
    ]);
  });

  it("notesToDraft folds unlabelled text and legacy RAW IDEA into Original thought", () => {
    expect(notesToDraft("just a thought")).toEqual({ "ORIGINAL THOUGHT": "just a thought" });
    expect(notesToDraft("## RAW IDEA\n\nraw\n\n## IDEA NOTE\n\nangle")).toEqual({
      "ORIGINAL THOUGHT": "raw",
      "IDEA NOTE": "angle",
    });
  });

  it("draftToNotes keeps an Inbox card plain and writes headings once it grows", () => {
    expect(draftToNotes({ "ORIGINAL THOUGHT": " hi " }, ["ORIGINAL THOUGHT"])).toBe("hi");
    expect(
      draftToNotes({ "ORIGINAL THOUGHT": "hi", "IDEA NOTE": "" }, ["ORIGINAL THOUGHT", "IDEA NOTE"]),
    ).toBe("## ORIGINAL THOUGHT\n\nhi\n\n## IDEA NOTE");
    const notes = "## ORIGINAL THOUGHT\n\nhi\n\n## IDEA NOTE\n\nangle";
    expect(draftToNotes(notesToDraft(notes), getEditorSections(CONTENT_COLUMN_DEVELOP_ID, notes))).toBe(notes);
  });

  it("getSectionFill reports which growth sections hold text", () => {
    expect(getSectionFill("")).toEqual({ "ORIGINAL THOUGHT": false, "IDEA NOTE": false, "SHOOT CARD": false });
    expect(getSectionFill("plain")).toMatchObject({ "ORIGINAL THOUGHT": true });
    expect(getSectionFill("## ORIGINAL THOUGHT\n\nx\n\n## IDEA NOTE\n")).toEqual({
      "ORIGINAL THOUGHT": true,
      "IDEA NOTE": false,
      "SHOOT CARD": false,
    });
  });

  it("getRowSnippet previews the section the card is working on, as plain text", () => {
    const notes = "## ORIGINAL THOUGHT\n\nthe thought\n\n## IDEA NOTE\n\n- **angle** one\n- hook two";
    expect(getRowSnippet({ columnId: CONTENT_COLUMN_INBOX_ID, notes })).toBe("the thought");
    expect(getRowSnippet({ columnId: CONTENT_COLUMN_DEVELOP_ID, notes })).toBe("angle one · hook two");
    expect(getRowSnippet({ columnId: CONTENT_COLUMN_SHOOT_NEXT_ID, notes })).toBe("angle one · hook two");
    expect(getRowSnippet({ columnId: CONTENT_COLUMN_INBOX_ID, notes: "" })).toBe("");
  });

  it("getNextUpCard prefers the top of Shoot next, then Develop", () => {
    const make = (id: string, columnId: string): ContentCard => ({
      id,
      columnId,
      title: id,
      notes: "",
      order: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const byColumn: Record<string, ContentCard[]> = {
      [CONTENT_COLUMN_DEVELOP_ID]: [make("dev", CONTENT_COLUMN_DEVELOP_ID)],
      [CONTENT_COLUMN_SHOOT_NEXT_ID]: [],
    };
    expect(getNextUpCard((id) => byColumn[id] ?? [])?.id).toBe("dev");
    byColumn[CONTENT_COLUMN_SHOOT_NEXT_ID] = [make("shoot", CONTENT_COLUMN_SHOOT_NEXT_ID)];
    expect(getNextUpCard((id) => byColumn[id] ?? [])?.id).toBe("shoot");
    expect(getNextUpCard(() => [])).toBeNull();
  });

  it("counts cards shipped since Monday 00:00 local time", () => {
    // Wednesday, 1 Oct 2026 (local).
    const now = new Date(2026, 9, 1, 15, 0);
    expect(getWeekStart(now)).toEqual(new Date(2026, 8, 28));
    expect(getWeekStart(new Date(2026, 9, 4, 23, 0))).toEqual(new Date(2026, 8, 28)); // Sunday
    const card = (publishedAt: string | null, columnId = CONTENT_COLUMN_PUBLISHED_ID): ContentCard => ({
      id: Math.random().toString(),
      columnId,
      title: "x",
      notes: "",
      order: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
      publishedAt,
    });
    const cards = [
      card(new Date(2026, 8, 28, 0, 0).toISOString()), // Monday 00:00 — counts
      card(new Date(2026, 8, 30).toISOString()), // counts
      card(new Date(2026, 8, 27, 23, 59).toISOString()), // last Sunday — no
      card(null), // legacy published, no date — no
      card(new Date(2026, 8, 30).toISOString(), CONTENT_COLUMN_SHOOT_NEXT_ID), // not published — no
    ];
    expect(countShippedThisWeek(cards, now)).toBe(2);
    expect(isInCurrentWeek(undefined, now)).toBe(false);
  });
});

const SAMPLE_SHOOT_CARD = [
  "1. ভিডিওর মূল বক্তব্য",
  "Job পাওয়া শুধু interview ভালো হওয়ার ব্যাপার না।",
  "Employer-এর need আর আপনার skill match করে।",
  "2. Main Beats / Talk Points",
  "",
  "* Job search অনেকটা matchmaking-এর মতো",
  "   * Employer specific skill খুঁজছে।",
  "3. Hook Options",
  "Recommended:",
  "“Job search আসলে matchmaking।”",
].join("\n");

describe("shoot card helpers", () => {
  it("parseShootCard splits numbered parts and keeps nested bullets in their part", () => {
    const parts = parseShootCard(SAMPLE_SHOOT_CARD);
    expect(parts.map((part) => [part.number, part.heading])).toEqual([
      [1, "ভিডিওর মূল বক্তব্য"],
      [2, "Main Beats / Talk Points"],
      [3, "Hook Options"],
    ]);
    expect(parts[1].body).toBe("* Job search অনেকটা matchmaking-এর মতো\n   * Employer specific skill খুঁজছে।");
  });

  it("parseShootCard does not split on an inner numbered list or out-of-order numbers", () => {
    const parts = parseShootCard("1. Intent\nthe point\n2. Beats\n1. first beat\n2. second beat\n3. Hooks\nhook");
    expect(parts.map((part) => part.heading)).toEqual(["Intent", "Beats", "Hooks"]);
    expect(parts[1].body).toBe("1. first beat\n2. second beat");
  });

  it("parseShootCard tolerates markdown headings and keeps text before part 1", () => {
    const parts = parseShootCard("Quick note\n### 1. Intent\nthe point\n**2. Beats**\nbeat");
    expect(parts).toEqual([
      { number: null, heading: "", body: "Quick note" },
      { number: 1, heading: "Intent", body: "the point" },
      { number: 2, heading: "Beats", body: "beat" },
    ]);
  });

  it("parseShootCard returns one headless part for an unnumbered card", () => {
    expect(parseShootCard("just some beats\n- one")).toEqual([
      { number: null, heading: "", body: "just some beats\n- one" },
    ]);
    expect(parseShootCard("")).toEqual([]);
  });

  it("getShootIntent reads part 1 of the Shoot card as plain text", () => {
    const notes = `## ORIGINAL THOUGHT\n\nthought\n\n## SHOOT CARD\n\n${SAMPLE_SHOOT_CARD}`;
    expect(getShootIntent(notes)).toBe(
      "Job পাওয়া শুধু interview ভালো হওয়ার ব্যাপার না। · Employer-এর need আর আপনার skill match করে।",
    );
    expect(getShootIntent("## SHOOT CARD\n\nunnumbered beats")).toBe("");
    expect(getShootIntent("plain idea")).toBe("");
  });

  it("getRowSnippet shows the intent once a card is in Shoot next or Published", () => {
    const notes = `## IDEA NOTE\n\nangle\n\n## SHOOT CARD\n\n1. Intent\nthe point\n2. Beats\nbeat`;
    expect(getRowSnippet({ columnId: CONTENT_COLUMN_SHOOT_NEXT_ID, notes })).toBe("the point");
    expect(getRowSnippet({ columnId: CONTENT_COLUMN_PUBLISHED_ID, notes })).toBe("the point");
    expect(getRowSnippet({ columnId: CONTENT_COLUMN_DEVELOP_ID, notes })).toBe("angle");
  });

  it("cleanPastedShootCard strips ChatGPT citation chips and keeps normal words", () => {
    const pasted = [
      "সেখানেই আপনার chance সবচেয়ে বেশি। Shoot-Card-Instruction",
      "story-driven content-এর জন্য strong fit। Story-Driven-Video-Script-Instr…",
      "A well-known Follow-Up stays",
      "Employer-এর need",
    ].join("\n");
    expect(cleanPastedShootCard(pasted)).toBe(
      [
        "সেখানেই আপনার chance সবচেয়ে বেশি।",
        "story-driven content-এর জন্য strong fit।",
        "A well-known Follow-Up stays",
        "Employer-এর need",
      ].join("\n"),
    );
  });
});
