import { describe, expect, test, vi } from "vitest";
import {
  COLLECTION_ACCESS_RULE,
  applyPocketBaseSchema,
  buildSchemaDefinitions,
  formatSchemaSummary,
  hasSchemaFailures,
  mergeCollectionDefinition,
} from "../../scripts/lib/pocketbase-schema.mjs";

function createBaseCollection(
  input: Partial<{
    id: string;
    name: string;
    listRule: string | null;
    viewRule: string | null;
    createRule: string | null;
    updateRule: string | null;
    deleteRule: string | null;
    indexes: string[];
    fields: Array<Record<string, unknown>>;
  }> = {},
) {
  return {
    id: input.id ?? "col_1",
    name: input.name ?? "example",
    type: "base",
    listRule: input.listRule ?? COLLECTION_ACCESS_RULE,
    viewRule: input.viewRule ?? COLLECTION_ACCESS_RULE,
    createRule: input.createRule ?? COLLECTION_ACCESS_RULE,
    updateRule: input.updateRule ?? COLLECTION_ACCESS_RULE,
    deleteRule: input.deleteRule ?? COLLECTION_ACCESS_RULE,
    indexes: input.indexes ?? [],
    fields: input.fields ?? [],
    system: false,
  };
}

describe("buildSchemaDefinitions", () => {
  test("contains the required collections and rules", () => {
    const definitions = buildSchemaDefinitions({ usersCollectionId: "users_1" });
    const names = definitions.map((item) => item.name);

    expect(names).toEqual([
      "daily_pages",
      "notes",
      "planner_presets",
      "workspace_state",
      "app_state_snapshots",
    ]);

    for (const definition of definitions) {
      expect(definition.listRule).toBe(COLLECTION_ACCESS_RULE);
      expect(definition.viewRule).toBe(COLLECTION_ACCESS_RULE);
      expect(definition.createRule).toBe(COLLECTION_ACCESS_RULE);
      expect(definition.updateRule).toBe(COLLECTION_ACCESS_RULE);
      expect(definition.deleteRule).toBe(COLLECTION_ACCESS_RULE);
      expect(definition.fields.find((field: { name: string }) => field.name === "owner")?.collectionId).toBe(
        "users_1",
      );
    }
  });
});

describe("mergeCollectionDefinition", () => {
  test("marks a matching collection as unchanged", () => {
    const desired = buildSchemaDefinitions({ usersCollectionId: "users_1" })[0];
    const existing = createBaseCollection({
      id: "daily_pages_1",
      name: desired.name,
      indexes: desired.indexes,
      fields: desired.fields.map((field, index) => ({
        id: `field_${index}`,
        system: false,
        hidden: false,
        presentable: false,
        ...field,
      })),
    });

    const merged = mergeCollectionDefinition(existing, desired);

    expect(merged.changed).toBe(false);
  });

  test("detects rule and index drift", () => {
    const desired = buildSchemaDefinitions({ usersCollectionId: "users_1" })[1];
    const existing = createBaseCollection({
      id: "notes_1",
      name: desired.name,
      listRule: null,
      indexes: [],
      fields: desired.fields.map((field, index) => ({
        id: `field_${index}`,
        ...field,
      })),
    });

    const merged = mergeCollectionDefinition(existing, desired);

    expect(merged.changed).toBe(true);
    expect(merged.payload.listRule).toBe(COLLECTION_ACCESS_RULE);
    expect(merged.payload.indexes).toContain(desired.indexes[0]);
  });

  test("preserves extra unknown fields while applying managed fields", () => {
    const desired = buildSchemaDefinitions({ usersCollectionId: "users_1" })[2];
    const existing = createBaseCollection({
      id: "planner_1",
      name: desired.name,
      fields: [
        ...desired.fields.map((field, index) => ({
          id: `field_${index}`,
          ...field,
        })),
        {
          id: "field_extra",
          name: "legacy_extra",
          type: "text",
          required: false,
        },
      ],
    });

    const merged = mergeCollectionDefinition(existing, desired);
    const extraField = merged.payload.fields.find((field: { name: string }) => field.name === "legacy_extra");

    expect(extraField).toBeDefined();
  });
});

describe("applyPocketBaseSchema", () => {
  test("creates missing collections", async () => {
    const create = vi.fn(async (payload: Record<string, unknown>) => ({ id: String(payload.name), ...payload }));
    const client = {
      collections: {
        getFullList: vi.fn(async () => [
          { id: "users_1", name: "users", type: "auth", fields: [] },
        ]),
        create,
        update: vi.fn(),
      },
    };

    const summary = await applyPocketBaseSchema({
      client,
      logger: { log: vi.fn(), error: vi.fn() } as unknown as Console,
    });

    expect(summary.created).toHaveLength(5);
    expect(create).toHaveBeenCalledTimes(5);
  });

  test("updates existing collection with drift and preserves unchanged ones", async () => {
    const definitions = buildSchemaDefinitions({ usersCollectionId: "users_1" });
    const dailyPages = createBaseCollection({
      id: "daily_pages_1",
      name: definitions[0].name,
      indexes: definitions[0].indexes,
      fields: definitions[0].fields.map((field, index) => ({ id: `field_${index}`, ...field })),
    });
    const notes = createBaseCollection({
      id: "notes_1",
      name: definitions[1].name,
      listRule: null,
      indexes: [],
      fields: definitions[1].fields.map((field, index) => ({ id: `note_${index}`, ...field })),
    });

    const update = vi.fn(async (_id: string, payload: Record<string, unknown>) => payload);
    const client = {
      collections: {
        getFullList: vi.fn(async () => [
          { id: "users_1", name: "users", type: "auth", fields: [] },
          dailyPages,
          notes,
        ]),
        create: vi.fn(async (payload: Record<string, unknown>) => ({ id: String(payload.name), ...payload })),
        update,
      },
    };

    const summary = await applyPocketBaseSchema({
      client,
      logger: { log: vi.fn(), error: vi.fn() } as unknown as Console,
    });

    expect(summary.unchanged).toContain("daily_pages");
    expect(summary.updated).toContain("notes");
    expect(update).toHaveBeenCalledTimes(1);
  });

  test("records failures and exposes them in the summary", async () => {
    const client = {
      collections: {
        getFullList: vi.fn(async () => [
          { id: "users_1", name: "users", type: "auth", fields: [] },
        ]),
        create: vi
          .fn()
          .mockRejectedValueOnce(new Error("boom"))
          .mockImplementation(async (payload: Record<string, unknown>) => ({ id: String(payload.name), ...payload })),
        update: vi.fn(),
      },
    };

    const logger = { log: vi.fn(), error: vi.fn() } as unknown as Console;
    const summary = await applyPocketBaseSchema({ client, logger });

    expect(summary.failed).toHaveLength(1);
    expect(hasSchemaFailures(summary)).toBe(true);
    expect(formatSchemaSummary(summary)).toContain("Failed: 1");
  });
});
