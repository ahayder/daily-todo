import { describe, expect, test } from "vitest";
import { createInitialState } from "@/lib/store";
import {
  WORKSPACE_EXPORT_VERSION,
  createWorkspaceExport,
  parseWorkspaceImport,
} from "@/lib/workspace-transfer";

describe("workspace transfer", () => {
  test("creates a versioned workspace export payload", () => {
    const state = createInitialState("2026-03-11");
    const exported = createWorkspaceExport(state, {
      now: new Date("2026-03-11T08:00:00.000Z"),
      metadata: { source: "test" },
    });

    expect(exported).toEqual({
      formatVersion: WORKSPACE_EXPORT_VERSION,
      exportedAt: "2026-03-11T08:00:00.000Z",
      state,
      metadata: { source: "test" },
    });
  });

  test("parses imports back into a normalized app state", () => {
    const state = createInitialState("2026-03-11");
    const imported = parseWorkspaceImport(
      {
        formatVersion: WORKSPACE_EXPORT_VERSION,
        exportedAt: "2026-03-11T08:00:00.000Z",
        state,
      },
      new Date("2026-03-11T08:00:00.000Z"),
    );

    expect(imported).toEqual(state);
  });

  test("rejects unknown export versions", () => {
    expect(
      parseWorkspaceImport({
        formatVersion: 999,
        state: createInitialState("2026-03-11"),
      }),
    ).toBeNull();
  });

  test("discards legacy content planner branches during import normalization", () => {
    const state = createInitialState("2026-03-11") as unknown as Record<string, unknown>;
    state.contentIdeas = { legacy: { id: "legacy" } };
    delete state.contentBoard;
    delete state.contentCards;

    const imported = parseWorkspaceImport(
      { formatVersion: WORKSPACE_EXPORT_VERSION, state },
      new Date("2026-03-11T08:00:00.000Z"),
    );

    expect(imported?.contentCards).toEqual({});
    expect(imported?.contentBoard.columns).toHaveLength(5);
    expect(imported && "contentIdeas" in imported).toBe(false);
  });
});
