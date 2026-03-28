import {
  compareTimestamps,
  createPersistenceMetadata,
  normalizeAppState,
  seedAppState,
  type CachedAppStateEnvelope,
  type LocalCacheStorage,
  type PersistenceLoadResult,
  type PersistenceMetadata,
  type PersistenceRepository,
  type PersistenceSaveResult,
  type RemoteAppStateStore,
  type RemoteSnapshot,
} from "@/lib/persistence";
import type { AppState } from "@/lib/types";

function toRemoteMetadata(
  snapshot: RemoteSnapshot,
  previous?: Partial<PersistenceMetadata>,
): PersistenceMetadata {
  return createPersistenceMetadata({
    ...previous,
    stateVersion: snapshot.stateVersion,
    lastRemoteUpdatedAt: snapshot.updatedAt,
    lastRemoteUpdatedAtClient: snapshot.updatedAtClient,
  });
}

export class SnapshotPersistenceRepository implements PersistenceRepository {
  constructor(
    private readonly remoteStore: RemoteAppStateStore,
    private readonly localCache: LocalCacheStorage,
  ) {}

  async load({
    userId,
    now = new Date(),
  }: {
    userId: string;
    now?: Date;
  }): Promise<PersistenceLoadResult> {
    const cached = this.localCache.loadCached({ userId, now });

    try {
      const remoteSnapshot = await this.remoteStore.loadSnapshot({ userId });

      if (remoteSnapshot) {
        return await this.resolveRemoteSnapshot(userId, remoteSnapshot, cached.envelope, cached.available, now);
      }

      if (cached.envelope) {
        const saved = await this.trySaveRemote(userId, cached.envelope.state, cached.envelope.metadata);
        return {
          state: cached.envelope.state,
          source: "local",
          status: saved.status,
          metadata: saved.metadata,
          conflictResolution: saved.conflictResolution,
          notice: saved.notice,
          errorMessage: saved.errorMessage,
          persistenceAvailable: cached.available,
        };
      }
    } catch {
      if (cached.envelope) {
        return {
          state: cached.envelope.state,
          source: "local",
          status: "offline",
          metadata: cached.envelope.metadata,
          conflictResolution: "none",
          notice: "PocketBase is offline, so you’re working from this device for now.",
          errorMessage: "Sync is offline right now.",
          persistenceAvailable: cached.available,
        };
      }
    }

    const seeded = seedAppState(now);
    const seededMetadata = createPersistenceMetadata();
    const localWrite = this.localCache.saveCached({
      userId,
      envelope: {
        state: seeded,
        metadata: seededMetadata,
      },
    });

    const saved = await this.trySaveRemote(userId, seeded, seededMetadata);
    const persistenceAvailable = localWrite.available;

    return {
      state: seeded,
      source: persistenceAvailable ? "seed" : "ephemeral",
      status: persistenceAvailable ? saved.status : "error",
      metadata: saved.metadata,
      conflictResolution: saved.conflictResolution,
      notice:
        persistenceAvailable
          ? saved.notice
          : "This session is temporary until local storage or PocketBase becomes available.",
      errorMessage:
        persistenceAvailable
          ? saved.errorMessage
          : "Changes may not persist until storage or network access returns.",
      persistenceAvailable,
    };
  }

  async save({
    userId,
    state,
    baseMetadata,
    now = new Date(),
  }: {
    userId: string;
    state: AppState;
    baseMetadata: PersistenceMetadata;
    now?: Date;
  }): Promise<PersistenceSaveResult> {
    const metadata = createPersistenceMetadata({
      ...baseMetadata,
      lastLocalMutationAt: now.toISOString(),
    });

    this.localCache.saveCached({
      userId,
      envelope: {
        state,
        metadata,
      },
    });

    return this.trySaveRemote(userId, state, metadata);
  }

  async clearUserData({ userId }: { userId: string }): Promise<void> {
    this.localCache.clearCached({ userId });
  }

  async loadNoteBody(): Promise<{
    markdown: string | null;
    status: "error";
    source: "none";
    updatedAtClient: null;
    notice: null;
    errorMessage: string;
  }> {
    return {
      markdown: null,
      status: "error",
      source: "none",
      updatedAtClient: null,
      notice: null,
      errorMessage: "Note bodies are unavailable in snapshot mode.",
    };
  }

  async saveNoteBody({
    markdown,
    updatedAtClient,
  }: {
    markdown: string;
    updatedAtClient: string;
  }): Promise<{
    markdown: string;
    updatedAtClient: string;
    status: "offline";
    notice: string;
    errorMessage: string;
  }> {
    return {
      markdown,
      updatedAtClient,
      status: "offline",
      notice: "PocketBase is unavailable, so your changes are saved on this device.",
      errorMessage: "Sync is offline right now.",
    };
  }

  async primeRecentNoteCache(): Promise<void> {}

  async evictExpiredCachedBodies(): Promise<void> {}

  private async resolveRemoteSnapshot(
    userId: string,
    remoteSnapshot: RemoteSnapshot,
    cachedEnvelope: CachedAppStateEnvelope | null,
    cacheAvailable: boolean,
    now: Date,
  ): Promise<PersistenceLoadResult> {
    const remoteState = normalizeAppState(remoteSnapshot.state, now);
    const remoteMetadata = toRemoteMetadata(remoteSnapshot);

    if (!cachedEnvelope) {
      this.localCache.saveCached({
        userId,
        envelope: {
          state: remoteState,
          metadata: remoteMetadata,
        },
      });

      return {
        state: remoteState,
        source: "remote",
        status: "synced",
        metadata: remoteMetadata,
        conflictResolution: "none",
        notice: null,
        errorMessage: null,
        persistenceAvailable: cacheAvailable,
      };
    }

    const localIsNewer =
      compareTimestamps(cachedEnvelope.metadata.lastLocalMutationAt, remoteSnapshot.updatedAtClient) > 0;

    if (localIsNewer) {
      const saved = await this.trySaveRemote(userId, cachedEnvelope.state, cachedEnvelope.metadata);
      return {
        state: cachedEnvelope.state,
        source: "local",
        status: saved.status,
        metadata: saved.metadata,
        conflictResolution:
          saved.status === "synced" ? "local-overwrote-remote" : saved.conflictResolution,
        notice:
          saved.status === "synced"
            ? "This device had newer changes, so they were synced."
            : saved.notice,
        errorMessage: saved.errorMessage,
        persistenceAvailable: cacheAvailable,
      };
    }

    this.localCache.saveCached({
      userId,
      envelope: {
        state: remoteState,
        metadata: remoteMetadata,
      },
    });

    return {
      state: remoteState,
      source: "remote",
      status: "synced",
      metadata: remoteMetadata,
      conflictResolution:
        compareTimestamps(cachedEnvelope.metadata.lastRemoteUpdatedAt, remoteSnapshot.updatedAt) !== 0
          ? "remote-overwrote-local"
          : "none",
      notice:
        compareTimestamps(cachedEnvelope.metadata.lastLocalMutationAt, remoteSnapshot.updatedAtClient) < 0
          ? "Newer changes from another device were loaded."
          : null,
      errorMessage: null,
      persistenceAvailable: cacheAvailable,
    };
  }

  private async trySaveRemote(
    userId: string,
    state: AppState,
    metadata: PersistenceMetadata,
  ): Promise<PersistenceSaveResult> {
    try {
      const savedSnapshot = await this.remoteStore.saveSnapshot({
        userId,
        state,
        updatedAtClient: metadata.lastLocalMutationAt ?? new Date().toISOString(),
        knownRemoteUpdatedAt: metadata.lastRemoteUpdatedAt,
      });

      const resolvedMetadata = toRemoteMetadata(savedSnapshot, metadata);
      const remoteChangedSinceLastSync =
        Boolean(metadata.lastRemoteUpdatedAt) &&
        Boolean(savedSnapshot.updatedAt) &&
        savedSnapshot.updatedAt !== metadata.lastRemoteUpdatedAt;
      const remoteWon =
        remoteChangedSinceLastSync &&
        compareTimestamps(metadata.lastLocalMutationAt, savedSnapshot.updatedAtClient) <= 0;

      if (remoteWon) {
        const remoteState = normalizeAppState(savedSnapshot.state, new Date());
        this.localCache.saveCached({
          userId,
          envelope: {
            state: remoteState,
            metadata: resolvedMetadata,
          },
        });

        return {
          status: "synced",
          metadata: resolvedMetadata,
          conflictResolution: "remote-overwrote-local",
          notice: "Newer changes from another device were loaded.",
          errorMessage: null,
        };
      }

      this.localCache.saveCached({
        userId,
        envelope: {
          state,
          metadata: resolvedMetadata,
        },
      });

      return {
        status: "synced",
        metadata: resolvedMetadata,
        conflictResolution: remoteChangedSinceLastSync ? "local-overwrote-remote" : "none",
        notice: null,
        errorMessage: null,
      };
    } catch {
      return {
        status: "offline",
        metadata,
        conflictResolution: "none",
        notice: "PocketBase is unavailable, so your changes are saved on this device.",
        errorMessage: "Sync is offline right now.",
      };
    }
  }
}
