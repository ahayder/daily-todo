const LEGACY_WORKSPACE_FIELDS = new Set([
  "content_planner_pillars_json",
  "content_planner_platforms_json",
]);

const DEFAULT_COLUMNS = [
  { id: "content-column-ideas", title: "Ideas", subtitle: "Capture raw concepts" },
  { id: "content-column-planned", title: "Planned", subtitle: "Ready to work on" },
  {
    id: "content-column-in-progress",
    title: "In Progress",
    subtitle: "Currently being created",
  },
  { id: "content-column-ready", title: "Ready", subtitle: "Prepared to publish" },
  { id: "content-column-published", title: "Published", subtitle: "Live and complete" },
];

export function stripLegacyContentPlannerState(state, now = new Date()) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return state;
  }

  const { contentBoard, contentCards, uiState } = state;
  const rest = { ...state };
  delete rest.contentIdeas;
  delete rest.contentPlannerOptions;
  delete rest.contentBoard;
  delete rest.contentCards;
  delete rest.uiState;
  const nextUiState =
    uiState && typeof uiState === "object" && !Array.isArray(uiState)
      ? (() => {
          const currentUiState = { ...uiState };
          delete currentUiState.selectedContentIdeaId;
          delete currentUiState.contentPlanner;
          return currentUiState;
        })()
      : uiState;

  return {
    ...rest,
    contentBoard:
      contentBoard && typeof contentBoard === "object"
        ? contentBoard
        : {
            columns: DEFAULT_COLUMNS.map((column) => ({ ...column })),
            updatedAt: now.toISOString(),
          },
    contentCards:
      contentCards && typeof contentCards === "object" && !Array.isArray(contentCards)
        ? contentCards
        : {},
    uiState: nextUiState,
  };
}

export async function inspectLegacyContentPlanner({ client }) {
  const collections = await client.collections.getFullList();
  const collectionByName = new Map(collections.map((collection) => [collection.name, collection]));
  const legacyCollection = collectionByName.get("content_ideas") ?? null;
  const workspaceCollection = collectionByName.get("workspace_state") ?? null;
  const snapshotsCollection = collectionByName.get("app_state_snapshots") ?? null;
  const legacyRecords = legacyCollection
    ? await client.collection("content_ideas").getList(1, 1)
    : { totalItems: 0 };
  const snapshots = snapshotsCollection
    ? await client.collection("app_state_snapshots").getFullList()
    : [];
  const snapshotsWithLegacyState = snapshots.filter((record) => {
    const state = record.state_json;
    if (!state || typeof state !== "object") return false;
    const uiState = state.uiState;
    return (
      "contentIdeas" in state ||
      "contentPlannerOptions" in state ||
      (uiState &&
        typeof uiState === "object" &&
        ("selectedContentIdeaId" in uiState || "contentPlanner" in uiState))
    );
  });
  const obsoleteWorkspaceFields =
    workspaceCollection?.fields?.filter((field) => LEGACY_WORKSPACE_FIELDS.has(field.name)) ?? [];

  return {
    collectionByName,
    legacyCollection,
    workspaceCollection,
    snapshots,
    legacyRecordCount: legacyRecords.totalItems ?? 0,
    snapshotsWithLegacyState,
    obsoleteWorkspaceFields,
  };
}

export async function cleanupLegacyContentPlanner({ client, confirm = false, logger = console }) {
  const inspection = await inspectLegacyContentPlanner({ client });
  const hasNewBoard = inspection.collectionByName.has("content_boards");
  const hasNewCards = inspection.collectionByName.has("content_cards");

  if (!hasNewBoard || !hasNewCards) {
    throw new Error(
      "Apply the new PocketBase schema before cleaning up the legacy content planner.",
    );
  }

  logger.log(`Legacy content idea records: ${inspection.legacyRecordCount}`);
  logger.log(`Legacy snapshot payloads: ${inspection.snapshotsWithLegacyState.length}`);
  logger.log(`Obsolete workspace fields: ${inspection.obsoleteWorkspaceFields.length}`);

  if (!confirm) {
    logger.log("Dry run only. Pass --confirm-delete-content-planner to apply this cleanup.");
    return {
      applied: false,
      deletedCollection: false,
      updatedSnapshots: 0,
      removedWorkspaceFields: 0,
    };
  }

  const updatedAt = new Date();
  for (const snapshot of inspection.snapshotsWithLegacyState) {
    await client.collection("app_state_snapshots").update(snapshot.id, {
      state_json: stripLegacyContentPlannerState(snapshot.state_json, updatedAt),
      state_version: 3,
      updated_at_client: updatedAt.toISOString(),
    });
  }

  let removedWorkspaceFields = 0;
  if (inspection.workspaceCollection && inspection.obsoleteWorkspaceFields.length > 0) {
    const nextFields = inspection.workspaceCollection.fields.filter(
      (field) => !LEGACY_WORKSPACE_FIELDS.has(field.name),
    );
    await client.collections.update(inspection.workspaceCollection.id, {
      fields: nextFields,
    });
    removedWorkspaceFields = inspection.obsoleteWorkspaceFields.length;
  }

  if (inspection.legacyCollection) {
    await client.collections.delete(inspection.legacyCollection.id);
  }

  logger.log("Legacy content planner cleanup complete.");
  return {
    applied: true,
    deletedCollection: Boolean(inspection.legacyCollection),
    updatedSnapshots: inspection.snapshotsWithLegacyState.length,
    removedWorkspaceFields,
  };
}
