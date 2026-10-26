import { describe, expect, it } from "vitest";
import { emptyMemoryData } from "./data";
import { createDecision } from "./decisions";
import { createMeeting } from "./meetings";
import { collectTags, searchMemory } from "./search";
import { createTask } from "./tasks";

const NOW = new Date("2026-10-27T05:00:00.000Z");

function data() {
  const result = emptyMemoryData();
  const link = createTask({ title: "Send Brian the compare link", tags: ["velox"] }, NOW)!;
  const other = createTask({ title: "Compare prices", tags: ["home"] }, NOW)!;
  const gone = { ...createTask({ title: "compare link old" }, NOW)!, deletedAt: NOW.toISOString() };
  const decision = createDecision({ title: "Use the link checker", why: "Compare is slow", tags: ["Velox"] }, NOW)!;
  const meeting = createMeeting({ title: "Standup", date: "2026-10-27", summary: "Talked about the compare link" }, NOW)!;
  result.task = { [link.id]: link, [other.id]: other, [gone.id]: gone };
  result.decision = { [decision.id]: decision };
  result.meeting = { [meeting.id]: meeting };
  return result;
}

describe("searchMemory", () => {
  it("needs every word, across kinds, and skips deleted records", () => {
    const hits = searchMemory(data(), "compare link");
    expect(hits.map((hit) => [hit.kind, hit.label]).toSorted()).toEqual(
      [
        ["decision", "Use the link checker"],
        ["meeting", "Standup"],
        ["task", "Send Brian the compare link"],
      ].toSorted(),
    );
  });

  it("filters by tag and kind", () => {
    expect(searchMemory(data(), "", { tag: "#velox" }).map((hit) => hit.kind).toSorted()).toEqual(["decision", "task"]);
    expect(searchMemory(data(), "compare", { kinds: ["task"] })).toHaveLength(2);
  });

  it("counts tags across kinds", () => {
    expect(collectTags(data())).toEqual([
      { tag: "velox", count: 2 },
      { tag: "home", count: 1 },
    ]);
  });
});
