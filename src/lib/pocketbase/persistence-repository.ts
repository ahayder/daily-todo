import { createBrowserLocalCacheStorage } from "@/lib/local-cache-storage";
import { APP_STATE_VERSION, type RemoteAppStateStore } from "@/lib/persistence";
import { getPocketBaseClient } from "@/lib/pocketbase/client";
import { SnapshotPersistenceRepository } from "@/lib/snapshot-persistence-repository";
import type { AppState } from "@/lib/types";

type PocketBaseSnapshotRecord = {
  id: string;
  state_json?: unknown;
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

class PocketBaseRemoteAppStateStore implements RemoteAppStateStore {
  async loadSnapshot({ userId }: { userId: string }): Promise<unknown | null> {
    const client = getPocketBaseClient();

    try {
      const record = await client
        .collection("app_state_snapshots")
        .getFirstListItem<PocketBaseSnapshotRecord>(`owner="${userId}"`);

      return record.state_json ?? null;
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  async saveSnapshot({ userId, state }: { userId: string; state: AppState }): Promise<void> {
    const client = getPocketBaseClient();

    try {
      const existing = await client
        .collection("app_state_snapshots")
        .getFirstListItem<PocketBaseSnapshotRecord>(`owner="${userId}"`);

      await client.collection("app_state_snapshots").update(existing.id, {
        owner: userId,
        state_json: state,
        state_version: APP_STATE_VERSION,
        updated_at_client: new Date().toISOString(),
      });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }

      await client.collection("app_state_snapshots").create({
        owner: userId,
        state_json: state,
        state_version: APP_STATE_VERSION,
        updated_at_client: new Date().toISOString(),
      });
    }
  }
}

export function createPocketBasePersistenceRepository() {
  return new SnapshotPersistenceRepository(
    new PocketBaseRemoteAppStateStore(),
    createBrowserLocalCacheStorage(),
  );
}
