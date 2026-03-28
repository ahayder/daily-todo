import {
  normalizeAppState,
  seedAppState,
  type LocalCacheStorage,
  type PersistenceRepository,
  type RemoteAppStateStore,
} from "@/lib/persistence";
import type { AppState } from "@/lib/types";

export class SnapshotPersistenceRepository implements PersistenceRepository {
  constructor(
    private readonly remoteStore: RemoteAppStateStore,
    private readonly localCache: LocalCacheStorage,
  ) {}

  async load({ userId, now = new Date() }: { userId: string; now?: Date }): Promise<AppState> {
    const cached = this.localCache.loadCached({ userId, now });

    try {
      const remoteSnapshot = await this.remoteStore.loadSnapshot({ userId });
      if (remoteSnapshot) {
        const normalized = normalizeAppState(remoteSnapshot, now);
        this.localCache.saveCached({ userId, state: normalized });
        return normalized;
      }

      if (cached) {
        await this.trySaveRemote(userId, cached);
        return cached;
      }
    } catch {
      if (cached) {
        return cached;
      }
    }

    const seeded = seedAppState(now);
    this.localCache.saveCached({ userId, state: seeded });
    await this.trySaveRemote(userId, seeded);
    return seeded;
  }

  async save({ userId, state }: { userId: string; state: AppState }): Promise<void> {
    this.localCache.saveCached({ userId, state });
    await this.remoteStore.saveSnapshot({ userId, state });
  }

  private async trySaveRemote(userId: string, state: AppState): Promise<void> {
    try {
      await this.remoteStore.saveSnapshot({ userId, state });
    } catch {
      // Keep the local cache as the safe fallback when the remote is unavailable.
    }
  }
}
