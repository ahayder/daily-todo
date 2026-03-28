const COLLECTION_ACCESS_RULE = '@request.auth.id != "" && owner = @request.auth.id';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeFieldForCompare(field) {
  const normalized = {};

  for (const [key, value] of Object.entries(field)) {
    if (["id", "system", "hidden", "presentable"].includes(key)) {
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

export function buildSchemaDefinitions({ usersCollectionId }) {
  return [
    {
      name: "daily_pages",
      type: "base",
      listRule: COLLECTION_ACCESS_RULE,
      viewRule: COLLECTION_ACCESS_RULE,
      createRule: COLLECTION_ACCESS_RULE,
      updateRule: COLLECTION_ACCESS_RULE,
      deleteRule: COLLECTION_ACCESS_RULE,
      fields: [
        {
          name: "owner",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: usersCollectionId,
          cascadeDelete: true,
        },
        {
          name: "date",
          type: "text",
          required: true,
        },
        {
          name: "markdown",
          type: "text",
        },
        {
          name: "todos_json",
          type: "json",
          required: true,
        },
        {
          name: "updated_at_client",
          type: "date",
          required: true,
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_daily_pages_owner_date ON daily_pages (owner, date)",
      ],
    },
    {
      name: "notes",
      type: "base",
      listRule: COLLECTION_ACCESS_RULE,
      viewRule: COLLECTION_ACCESS_RULE,
      createRule: COLLECTION_ACCESS_RULE,
      updateRule: COLLECTION_ACCESS_RULE,
      deleteRule: COLLECTION_ACCESS_RULE,
      fields: [
        {
          name: "owner",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: usersCollectionId,
          cascadeDelete: true,
        },
        {
          name: "note_id",
          type: "text",
          required: true,
        },
        {
          name: "title",
          type: "text",
        },
        {
          name: "folder_id",
          type: "text",
        },
        {
          name: "markdown",
          type: "text",
        },
        {
          name: "updated_at_client",
          type: "date",
          required: true,
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_notes_owner_note_id ON notes (owner, note_id)",
      ],
    },
    {
      name: "note_folders",
      type: "base",
      listRule: COLLECTION_ACCESS_RULE,
      viewRule: COLLECTION_ACCESS_RULE,
      createRule: COLLECTION_ACCESS_RULE,
      updateRule: COLLECTION_ACCESS_RULE,
      deleteRule: COLLECTION_ACCESS_RULE,
      fields: [
        {
          name: "owner",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: usersCollectionId,
          cascadeDelete: true,
        },
        {
          name: "folder_id",
          type: "text",
          required: true,
        },
        {
          name: "name",
          type: "text",
          required: true,
        },
        {
          name: "parent_folder_id",
          type: "text",
        },
        {
          name: "updated_at_client",
          type: "date",
          required: true,
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_note_folders_owner_folder_id ON note_folders (owner, folder_id)",
      ],
    },
    {
      name: "planner_presets",
      type: "base",
      listRule: COLLECTION_ACCESS_RULE,
      viewRule: COLLECTION_ACCESS_RULE,
      createRule: COLLECTION_ACCESS_RULE,
      updateRule: COLLECTION_ACCESS_RULE,
      deleteRule: COLLECTION_ACCESS_RULE,
      fields: [
        {
          name: "owner",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: usersCollectionId,
          cascadeDelete: true,
        },
        {
          name: "preset_id",
          type: "text",
          required: true,
        },
        {
          name: "name",
          type: "text",
          required: true,
        },
        {
          name: "day_order_json",
          type: "json",
          required: true,
        },
        {
          name: "days_json",
          type: "json",
          required: true,
        },
        {
          name: "updated_at_client",
          type: "date",
          required: true,
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_planner_presets_owner_preset_id ON planner_presets (owner, preset_id)",
      ],
    },
    {
      name: "workspace_state",
      type: "base",
      listRule: COLLECTION_ACCESS_RULE,
      viewRule: COLLECTION_ACCESS_RULE,
      createRule: COLLECTION_ACCESS_RULE,
      updateRule: COLLECTION_ACCESS_RULE,
      deleteRule: COLLECTION_ACCESS_RULE,
      fields: [
        {
          name: "owner",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: usersCollectionId,
          cascadeDelete: true,
        },
        {
          name: "selected_daily_date",
          type: "text",
        },
        {
          name: "selected_note_id",
          type: "text",
        },
        {
          name: "selected_note_folder_id",
          type: "text",
        },
        {
          name: "selected_planner_preset_id",
          type: "text",
        },
        {
          name: "expanded_years_json",
          type: "json",
          required: true,
        },
        {
          name: "expanded_months_json",
          type: "json",
          required: true,
        },
        {
          name: "last_view",
          type: "text",
          required: true,
        },
        {
          name: "updated_at_client",
          type: "date",
          required: true,
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_workspace_state_owner ON workspace_state (owner)",
      ],
    },
    {
      name: "app_state_snapshots",
      type: "base",
      listRule: COLLECTION_ACCESS_RULE,
      viewRule: COLLECTION_ACCESS_RULE,
      createRule: COLLECTION_ACCESS_RULE,
      updateRule: COLLECTION_ACCESS_RULE,
      deleteRule: COLLECTION_ACCESS_RULE,
      fields: [
        {
          name: "owner",
          type: "relation",
          required: true,
          maxSelect: 1,
          collectionId: usersCollectionId,
          cascadeDelete: true,
        },
        {
          name: "state_json",
          type: "json",
          required: true,
        },
        {
          name: "state_version",
          type: "number",
          required: true,
        },
        {
          name: "updated_at_client",
          type: "date",
          required: true,
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_app_state_snapshots_owner ON app_state_snapshots (owner)",
      ],
    },
  ];
}

export function mergeCollectionDefinition(existingCollection, desiredCollection) {
  const existingFields = Array.isArray(existingCollection.fields) ? existingCollection.fields : [];
  const desiredFieldsByName = new Map(desiredCollection.fields.map((field) => [field.name, field]));
  const mergedFields = [];
  const preservedManagedNames = new Set();

  for (const field of existingFields) {
    const desiredField = desiredFieldsByName.get(field.name);

    if (desiredField) {
      preservedManagedNames.add(field.name);
      mergedFields.push({
        ...clone(field),
        ...clone(desiredField),
        id: field.id,
      });
      continue;
    }

    mergedFields.push(clone(field));
  }

  for (const desiredField of desiredCollection.fields) {
    if (!preservedManagedNames.has(desiredField.name)) {
      mergedFields.push(clone(desiredField));
    }
  }

  const merged = {
    ...clone(existingCollection),
    name: desiredCollection.name,
    type: desiredCollection.type,
    listRule: desiredCollection.listRule,
    viewRule: desiredCollection.viewRule,
    createRule: desiredCollection.createRule,
    updateRule: desiredCollection.updateRule,
    deleteRule: desiredCollection.deleteRule,
    indexes: uniqueStrings([
      ...(Array.isArray(existingCollection.indexes) ? existingCollection.indexes : []),
      ...desiredCollection.indexes,
    ]),
    fields: mergedFields,
  };

  const comparableExisting = {
    name: existingCollection.name,
    type: existingCollection.type,
    listRule: existingCollection.listRule ?? null,
    viewRule: existingCollection.viewRule ?? null,
    createRule: existingCollection.createRule ?? null,
    updateRule: existingCollection.updateRule ?? null,
    deleteRule: existingCollection.deleteRule ?? null,
    indexes: uniqueStrings(Array.isArray(existingCollection.indexes) ? existingCollection.indexes : []),
    fields: existingFields.map((field) => normalizeFieldForCompare(field)),
  };

  const comparableMerged = {
    name: merged.name,
    type: merged.type,
    listRule: merged.listRule ?? null,
    viewRule: merged.viewRule ?? null,
    createRule: merged.createRule ?? null,
    updateRule: merged.updateRule ?? null,
    deleteRule: merged.deleteRule ?? null,
    indexes: uniqueStrings(merged.indexes),
    fields: merged.fields.map((field) => normalizeFieldForCompare(field)),
  };

  return {
    payload: merged,
    changed: stableStringify(comparableExisting) !== stableStringify(comparableMerged),
  };
}

export async function reconcileCollection({ client, desiredCollection, existingCollection }) {
  if (!existingCollection) {
    const created = await client.collections.create(desiredCollection);
    return {
      action: "created",
      collection: created,
      name: desiredCollection.name,
    };
  }

  const { payload, changed } = mergeCollectionDefinition(existingCollection, desiredCollection);

  if (!changed) {
    return {
      action: "unchanged",
      collection: existingCollection,
      name: desiredCollection.name,
    };
  }

  const updated = await client.collections.update(existingCollection.id || existingCollection.name, payload);
  return {
    action: "updated",
    collection: updated,
    name: desiredCollection.name,
  };
}

export async function applyPocketBaseSchema({ client, logger = console }) {
  const collections = await client.collections.getFullList();
  const collectionByName = new Map(collections.map((collection) => [collection.name, collection]));
  const usersCollection = collectionByName.get("users");

  if (!usersCollection) {
    throw new Error("PocketBase `users` auth collection was not found.");
  }

  const definitions = buildSchemaDefinitions({ usersCollectionId: usersCollection.id });
  const summary = {
    created: [],
    updated: [],
    unchanged: [],
    failed: [],
  };

  for (const definition of definitions) {
    try {
      const result = await reconcileCollection({
        client,
        desiredCollection: definition,
        existingCollection: collectionByName.get(definition.name) ?? null,
      });

      summary[result.action].push(definition.name);
      logger.log(`${result.action.toUpperCase()}: ${definition.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      summary.failed.push({ name: definition.name, message });
      logger.error(`FAILED: ${definition.name} — ${message}`);
    }
  }

  return summary;
}

export function formatSchemaSummary(summary) {
  const failedLines = summary.failed.map((item) => `  - ${item.name}: ${item.message}`);

  return [
    "PocketBase schema apply summary",
    `Created: ${summary.created.length ? summary.created.join(", ") : "none"}`,
    `Updated: ${summary.updated.length ? summary.updated.join(", ") : "none"}`,
    `Unchanged: ${summary.unchanged.length ? summary.unchanged.join(", ") : "none"}`,
    `Failed: ${summary.failed.length ? summary.failed.length : "none"}`,
    ...failedLines,
  ].join("\n");
}

export function hasSchemaFailures(summary) {
  return summary.failed.length > 0;
}

export { COLLECTION_ACCESS_RULE };
