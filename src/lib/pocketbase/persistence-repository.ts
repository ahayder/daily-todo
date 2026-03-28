import { createBrowserLocalCacheStorage } from "@/lib/local-cache-storage";
import { APP_STATE_VERSION, type RemoteAppStateStore, type RemoteSnapshot } from "@/lib/persistence";
import { getPocketBaseClient } from "@/lib/pocketbase/client";
import { SnapshotPersistenceRepository } from "@/lib/snapshot-persistence-repository";
import type { AppState } from "@/lib/types";

type PocketBaseSnapshotRecord = {
  id: string;
  state_json?: unknown;
  state_version?: number;
  updated?: string;
  updated_at_client?: string;
};

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number" &&
    (error as { status: number }).status === 404
  );
}

function toSnapshot(record: PocketBaseSnapshotRecord): RemoteSnapshot {
  return {
    state: record.state_json ?? null,
    stateVersion: record.state_version ?? APP_STATE_VERSION,
    updatedAt: record.updated ?? null,
    updatedAtClient: record.updated_at_client ?? null,
  };
}

class PocketBaseRemoteAppStateStore implements RemoteAppStateStore {
  async loadSnapshot({ userId }: { userId: string }): Promise<RemoteSnapshot | null> {
    const client = getPocketBaseClient();

    try {
      const record = await client
        .collection("app_state_snapshots")
        .getFirstListItem<PocketBaseSnapshotRecord>(`owner="${userId}"`);

      return toSnapshot(record);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async saveSnapshot({
    userId,
    state,
    updatedAtClient,
    knownRemoteUpdatedAt,
  }: {
    userId: string;
    state: AppState;
    updatedAtClient: string;
    knownRemoteUpdatedAt: string | null;
  }): Promise<RemoteSnapshot> {
    const client = getPocketBaseClient();
    const payload = {
      owner: userId,
      state_json: state,
      state_version: APP_STATE_VERSION,
      updated_at_client: updatedAtClient,
    };

    try {
      const existing = await client
        .collection("app_state_snapshots")
        .getFirstListItem<PocketBaseSnapshotRecord>(`owner="${userId}"`);

      if (knownRemoteUpdatedAt && existing.updated && existing.updated !== knownRemoteUpdatedAt) {
        return toSnapshot(existing);
      }

      const updated = await client
        .collection("app_state_snapshots")
        .update<PocketBaseSnapshotRecord>(existing.id, payload);

      return toSnapshot(updated);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }

      const created = await client
        .collection("app_state_snapshots")
        .create<PocketBaseSnapshotRecord>(payload);

      return toSnapshot(created);
    }
  }
}

export function createPocketBasePersistenceRepository() {
  return new SnapshotPersistenceRepository(
    new PocketBaseRemoteAppStateStore(),
    createBrowserLocalCacheStorage(),
  );
}
