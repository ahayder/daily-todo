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
  getNextStep,
  getSectionBody,
  getStageForColumn,
  hasChatGptPrompt,
  hasConveyorSections,
  parseSections,
  stripSectionHeadings,
} from "@/lib/content-conveyor";

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
