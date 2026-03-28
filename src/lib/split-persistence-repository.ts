import {
  createPersistenceMetadata,
  seedAppState,
  type CachedAppStateEnvelope,
  type LocalCacheStorage,
  type NoteBodyLoadResult,
  type NoteBodySaveResult,
  type PersistenceLoadResult,
  type PersistenceMetadata,
  type PersistenceRepository,
  type RecentNoteBodiesStorage,
  type PersistenceSaveResult,
  type PersistenceStatus,
} from "@/lib/persistence";
import type { AppState } from "@/lib/types";

export type SplitRemotePersistenceStore = {
  loadRemoteState(input: {
    userId: string;
    cachedEnvelope: CachedAppStateEnvelope | null;
    cacheAvailable: boolean;
    now?: Date;
  }): Promise<PersistenceLoadResult>;
  saveRemoteState(input: {
    userId: string;
    state: AppState;
    metadata: PersistenceMetadata;
    now?: Date;
  }): Promise<PersistenceSaveResult>;
  loadNoteBody?(input: { userId: string; noteId: string; now?: Date }): Promise<NoteBodyLoadResult>;
  saveNoteBody?(input: {
    userId: string;
    noteId: string;
    markdown: string;
    updatedAtClient: string;
    now?: Date;
  }): Promise<NoteBodySaveResult>;
};

function getCachedLoadStatus(metadata: PersistenceMetadata): PersistenceStatus {
  return metadata.hasMigratedToSplitStore ? "syncing" : "loading";
}

export class SplitPersistenceRepository implements PersistenceRepository {
  constructor(
    private readonly remoteStore: SplitRemotePersistenceStore,
    private readonly localCache: LocalCacheStorage,
    private readonly noteBodiesStorage?: RecentNoteBodiesStorage,
  ) {}

  async load({
    userId,
    now = new Date(),
    onRemoteSync,
  }: {
    userId: string;
    now?: Date;
    onRemoteSync?: (result: PersistenceLoadResult) => void;
  }): Promise<PersistenceLoadResult> {
    const cached = this.localCache.loadCached({ userId, now });

    if (cached.envelope) {
      const envelope = cached.envelope;
      void this.remoteStore
        .loadRemoteState({
          userId,
          cachedEnvelope: envelope,
          cacheAvailable: cached.available,
          now,
        })
        .then((result) => {
          this.localCache.saveCached({
            userId,
            envelope: {
              state: result.state,
              metadata: result.metadata,
            },
          });
          onRemoteSync?.(result);
        })
        .catch(() => {
          onRemoteSync?.({
            state: envelope.state,
            source: "local",
            status: "offline",
            metadata: envelope.metadata,
            conflictResolution: "none",
            notice: "PocketBase is offline, so you’re working from this device for now.",
            errorMessage: "Sync is offline right now.",
            persistenceAvailable: cached.available,
          });
        });

      return {
        state: envelope.state,
        source: "local",
        status: getCachedLoadStatus(envelope.metadata),
        metadata: envelope.metadata,
        conflictResolution: "none",
        notice: null,
        errorMessage: null,
        persistenceAvailable: cached.available,
      };
    }

    try {
      const remote = await this.remoteStore.loadRemoteState({
        userId,
        cachedEnvelope: null,
        cacheAvailable: cached.available,
        now,
      });

      this.localCache.saveCached({
        userId,
        envelope: {
          state: remote.state,
          metadata: remote.metadata,
        },
      });

      return remote;
    } catch {
      const seeded = seedAppState(now);
      const metadata = createPersistenceMetadata();
      this.localCache.saveCached({
        userId,
        envelope: {
          state: seeded,
          metadata,
        },
      });

      return {
        state: seeded,
        source: cached.available ? "seed" : "ephemeral",
        status: cached.available ? "offline" : "error",
        metadata,
        conflictResolution: "none",
        notice: cached.available
          ? "PocketBase is offline, so you’re starting from this device for now."
          : "This session is temporary until local storage or PocketBase becomes available.",
        errorMessage: cached.available
          ? "Sync is offline right now."
          : "Changes may not persist until storage or network access returns.",
        persistenceAvailable: cached.available,
      };
    }
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

    const result = await this.remoteStore.saveRemoteState({
      userId,
      state,
      metadata,
      now,
    });

    this.localCache.saveCached({
      userId,
      envelope: {
        state: result.resolvedState ?? state,
        metadata: result.metadata,
      },
    });

    return result;
  }

  async clearUserData({ userId }: { userId: string }): Promise<void> {
    this.localCache.clearCached({ userId });
    await this.noteBodiesStorage?.clearUserData({ userId });
  }

  async loadNoteBody({
    userId,
    noteId,
    now = new Date(),
  }: {
    userId: string;
    noteId: string;
    now?: Date;
  }): Promise<NoteBodyLoadResult> {
    await this.noteBodiesStorage?.evictExpired({ userId, now });

    const cached = await this.noteBodiesStorage?.loadNoteBody({ userId, noteId, now });
    if (cached) {
      return {
        markdown: cached.markdown,
        status: "ready",
        source: "local",
        updatedAtClient: cached.updatedAtClient,
        notice: null,
        errorMessage: null,
      };
    }

    if (!this.remoteStore.loadNoteBody) {
      return {
        markdown: null,
        status: "error",
        source: "none",
        updatedAtClient: null,
        notice: null,
        errorMessage: "Note bodies are unavailable.",
      };
    }

    const remote = await this.remoteStore.loadNoteBody({ userId, noteId, now });
    if (remote.markdown !== null && remote.status === "ready") {
      await this.noteBodiesStorage?.saveNoteBody({
        userId,
        noteId,
        markdown: remote.markdown,
        updatedAtClient: remote.updatedAtClient,
        now,
      });
    }
    return remote;
  }

  async saveNoteBody({
    userId,
    noteId,
    markdown,
    updatedAtClient,
    now = new Date(),
  }: {
    userId: string;
    noteId: string;
    markdown: string;
    updatedAtClient: string;
    now?: Date;
  }): Promise<NoteBodySaveResult> {
    await this.noteBodiesStorage?.evictExpired({ userId, now });
    await this.noteBodiesStorage?.saveNoteBody({
      userId,
      noteId,
      markdown,
      updatedAtClient,
      now,
    });

    if (!this.remoteStore.saveNoteBody) {
      return {
        markdown,
        updatedAtClient,
        status: "offline",
        notice: "PocketBase is unavailable, so your changes are saved on this device.",
        errorMessage: "Sync is offline right now.",
      };
    }

    const remote = await this.remoteStore.saveNoteBody({
      userId,
      noteId,
      markdown,
      updatedAtClient,
      now,
    });

    await this.noteBodiesStorage?.saveNoteBody({
      userId,
      noteId,
      markdown: remote.markdown,
      updatedAtClient: remote.updatedAtClient,
      now,
    });

    return remote;
  }

  async primeRecentNoteCache({
    userId,
    noteBodies,
    now = new Date(),
  }: {
    userId: string;
    noteBodies: Array<{ noteId: string; markdown: string; updatedAtClient: string | null }>;
    now?: Date;
  }): Promise<void> {
    await Promise.all(
      noteBodies.map((note) =>
        this.noteBodiesStorage?.saveNoteBody({
          userId,
          noteId: note.noteId,
          markdown: note.markdown,
          updatedAtClient: note.updatedAtClient,
          now,
        }),
      ),
    );
    const count = await this.noteBodiesStorage?.countUserBodies?.({ userId });
    if (typeof count === "number") {
      console.debug("[persistence] indexeddb recent note bodies", count);
    }
  }

  async evictExpiredCachedBodies({
    userId,
    now = new Date(),
  }: {
    userId?: string;
    now?: Date;
  }): Promise<void> {
    await this.noteBodiesStorage?.evictExpired({ userId, now });
  }
}
