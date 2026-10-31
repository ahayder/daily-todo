import { describe, expect, it } from "vitest";
import type { ChangeRequest } from "@/lib/types";
import { withHistory } from "./history";
import { createMemoryTestStore } from "./memory-test-store";

// Direct tests for the history wrapper. Tool-level undo/redo flows live in
// memory-tools.test.ts; these lock in the batch and "never delete" rules.

function changeRequest(id: string, text: string): ChangeRequest {
  return {
    id,
    text,
    kind: "idea",
    status: "open",
    screen: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };
}

describe("withHistory", () => {
  it("logs one change per save, all in the same batch", async () => {
    const { store, state } = createMemoryTestStore();
    const history = withHistory(store, "chat:test");

    await history.saveChangeRequest(changeRequest("cr_1", "first"));
    await history.saveChangeRequest(changeRequest("cr_2", "second"));

    expect(state.changes).toHaveLength(2);
    expect(new Set(state.changes.map((entry) => entry.batchId))).toEqual(new Set([history.batchId]));
    expect(state.changes.map((entry) => entry.action)).toEqual(["create", "create"]);
    expect(state.changes.every((entry) => entry.source === "chat:test")).toBe(true);
  });

  it("undoing a new record soft-deletes it instead of removing it", async () => {
    const { store, state } = createMemoryTestStore();
    const history = withHistory(store, "chat:test");
    await history.saveChangeRequest(changeRequest("cr_1", "hello"));

    const undo = withHistory(store, "chat:undo");
    await undo.undo(state.changes[0].id);

    expect(state.changeRequests.cr_1).toBeDefined();
    expect(state.changeRequests.cr_1.deletedAt).not.toBeNull();
    expect(state.changes.at(-1)?.action).toBe("undo");
  });

  it("undoes a whole batch or nothing when one record changed since", async () => {
    const { store, state } = createMemoryTestStore({
      changeRequests: [changeRequest("cr_1", "one"), changeRequest("cr_2", "two")],
    });
    const batch = withHistory(store, "chat:test");
    await batch.saveChangeRequest({ ...changeRequest("cr_1", "one edited"), updatedAt: "2026-02-01T00:00:00.000Z" });
    await batch.saveChangeRequest({ ...changeRequest("cr_2", "two edited"), updatedAt: "2026-02-01T00:00:00.000Z" });

    // Someone edits cr_2 again outside the batch.
    await store.saveChangeRequest({ ...changeRequest("cr_2", "newer work"), updatedAt: "2026-03-01T00:00:00.000Z" });

    const undo = withHistory(store, "chat:undo");
    await expect(undo.undo(state.changes[0].id)).rejects.toThrow(/Can't undo/);
    expect(state.changeRequests.cr_1.text).toBe("one edited");
    expect(state.changeRequests.cr_2.text).toBe("newer work");
  });

  it("undo then redo brings the board back to the edited version", async () => {
    const { store, state } = createMemoryTestStore();
    const original = await store.loadBoard();
    const history = withHistory(store, "chat:test");
    const edited = { ...original!, columns: [], updatedAt: "2026-02-01T00:00:00.000Z" };
    await history.saveBoard(edited);

    await withHistory(store, "chat:undo").undo(state.changes[0].id);
    expect(state.board?.columns).toEqual(original!.columns);

    await withHistory(store, "chat:redo").redo(state.changes[0].id);
    expect(state.board?.columns).toEqual([]);
  });
});
