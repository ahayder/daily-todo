import type {
  CachedAppStateEnvelope,
  LocalCacheStorage,
  NoteBodyLoadResult,
  NoteBodySaveResult,
  PersistenceMetadata,
  PersistenceRepository,
  RecentNoteBodiesStorage,
  ServerLoadResult,
} from "@/lib/persistence";
import type { ApplyOpResult, OutboxStorage, SyncOp } from "@/lib/sync-outbox";
import type { AppState } from "@/lib/types";

export type SplitRemotePersistenceStore = {
  /** A pure read of the server. Must never write. */
  loadServerState(input: { userId: string; now?: Date }): Promise<ServerLoadResult>;
  applyOps(input: { userId: string; ops: SyncOp[] }): Promise<ApplyOpResult[]>;
  loadNoteBody?(input: { userId: string; noteId: string; now?: Date }): Promise<NoteBodyLoadResult>;
  saveNoteBody?(input: {
    userId: string;
    noteId: string;
    markdown: string;
    updatedAtClient: string;
    now?: Date;
  }): Promise<NoteBodySaveResult>;
};

/**
 * Server-first repository: the device cache is only for instant (read-only)
 * startup, the outbox holds this device's unsent edits, and the server is
 * read and written one record at a time.
 */
export class SplitPersistenceRepository implements PersistenceRepository {
  constructor(
    private readonly remoteStore: SplitRemotePersistenceStore,
    private readonly localCache: LocalCacheStorage,
    private readonly outboxStorage: OutboxStorage,
    private readonly noteBodiesStorage?: RecentNoteBodiesStorage,
  ) {}

  loadCached({ userId, now = new Date() }: { userId: string; now?: Date }): CachedAppStateEnvelope | null {
    return this.localCache.loadCached({ userId, now }).envelope;
  }

  loadServer({ userId, now = new Date() }: { userId: string; now?: Date }): Promise<ServerLoadResult> {
    return this.remoteStore.loadServerState({ userId, now });
  }

  applyOps({ userId, ops }: { userId: string; ops: SyncOp[] }): Promise<ApplyOpResult[]> {
    return this.remoteStore.applyOps({ userId, ops });
  }

  loadOutbox({ userId }: { userId: string }): SyncOp[] {
    return this.outboxStorage.load({ userId });
  }

  saveOutbox({ userId, ops }: { userId: string; ops: SyncOp[] }): void {
    this.outboxStorage.save({ userId, ops });
  }

  saveLocalCache({
    userId,
    state,
    metadata,
  }: {
    userId: string;
    state: AppState;
    metadata: PersistenceMetadata;
  }): void {
    this.localCache.saveCached({ userId, envelope: { state, metadata } });
  }

  async clearUserData({ userId }: { userId: string }): Promise<void> {
    this.localCache.clearCached({ userId });
    this.outboxStorage.clear({ userId });
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
