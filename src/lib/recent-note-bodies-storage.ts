import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CachedNoteBody } from "@/lib/types";
import type { RecentNoteBodiesStorage } from "@/lib/persistence";

const DB_NAME = "dailytodo-recent-note-bodies";
const DB_VERSION = 1;
const STORE_NAME = "recent-note-bodies";
const USER_INDEX = "by-user";
const EXPIRES_INDEX = "by-expires-at";
const NOTE_BODY_TTL_MS = 72 * 60 * 60 * 1000;

type StoredCachedNoteBody = CachedNoteBody & {
  key: string;
  userId: string;
};

type RecentNoteBodyDb = DBSchema & {
  [STORE_NAME]: {
    key: string;
    value: StoredCachedNoteBody;
    indexes: {
      [USER_INDEX]: string;
      [EXPIRES_INDEX]: string;
    };
  };
};

function getCacheKey(userId: string, noteId: string) {
  return `${userId}:${noteId}`;
}

async function getDb(): Promise<IDBPDatabase<RecentNoteBodyDb>> {
  return openDB<RecentNoteBodyDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
      store.createIndex(USER_INDEX, "userId");
      store.createIndex(EXPIRES_INDEX, "expiresAt");
    },
  });
}

function toStoredBody(input: {
  userId: string;
  noteId: string;
  markdown: string;
  updatedAtClient: string | null;
  now: Date;
}): StoredCachedNoteBody {
  return {
    key: getCacheKey(input.userId, input.noteId),
    userId: input.userId,
    noteId: input.noteId,
    markdown: input.markdown,
    updatedAtClient: input.updatedAtClient,
    lastAccessedAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + NOTE_BODY_TTL_MS).toISOString(),
  };
}

async function deleteByUser(db: IDBPDatabase<RecentNoteBodyDb>, userId: string) {
  const tx = db.transaction(STORE_NAME, "readwrite");
  const index = tx.store.index(USER_INDEX);
  let cursor = await index.openCursor(IDBKeyRange.only(userId));

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

export function createRecentNoteBodiesStorage(): RecentNoteBodiesStorage {
  return {
    async loadNoteBody({ userId, noteId, now = new Date() }) {
      if (typeof indexedDB === "undefined") {
        return null;
      }

      const db = await getDb();
      const key = getCacheKey(userId, noteId);
      const entry = await db.get(STORE_NAME, key);

      if (!entry) {
        return null;
      }

      if (Date.parse(entry.expiresAt) <= now.getTime()) {
        await db.delete(STORE_NAME, key);
        return null;
      }

      const refreshed = toStoredBody({
        userId,
        noteId,
        markdown: entry.markdown,
        updatedAtClient: entry.updatedAtClient,
        now,
      });
      await db.put(STORE_NAME, refreshed);

      return refreshed;
    },
    async saveNoteBody({ userId, noteId, markdown, updatedAtClient, now = new Date() }) {
      if (typeof indexedDB === "undefined") {
        return {
          noteId,
          markdown,
          updatedAtClient,
          lastAccessedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + NOTE_BODY_TTL_MS).toISOString(),
        };
      }

      const db = await getDb();
      const entry = toStoredBody({
        userId,
        noteId,
        markdown,
        updatedAtClient,
        now,
      });
      await db.put(STORE_NAME, entry);
      return entry;
    },
    async deleteNoteBody({ userId, noteId }) {
      if (typeof indexedDB === "undefined") {
        return;
      }

      const db = await getDb();
      await db.delete(STORE_NAME, getCacheKey(userId, noteId));
    },
    async clearUserData({ userId }) {
      if (typeof indexedDB === "undefined") {
        return;
      }

      const db = await getDb();
      await deleteByUser(db, userId);
    },
    async evictExpired({ userId, now = new Date() }) {
      if (typeof indexedDB === "undefined") {
        return;
      }

      const db = await getDb();
      if (userId) {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const index = tx.store.index(USER_INDEX);
        let cursor = await index.openCursor(IDBKeyRange.only(userId));

        while (cursor) {
          if (Date.parse(cursor.value.expiresAt) <= now.getTime()) {
            await cursor.delete();
          }
          cursor = await cursor.continue();
        }

        await tx.done;
        return;
      }

      const tx = db.transaction(STORE_NAME, "readwrite");
      const index = tx.store.index(EXPIRES_INDEX);
      let cursor = await index.openCursor();

      while (cursor) {
        if (Date.parse(cursor.value.expiresAt) <= now.getTime()) {
          await cursor.delete();
        }
        cursor = await cursor.continue();
      }

      await tx.done;
    },
    async countUserBodies({ userId }) {
      if (typeof indexedDB === "undefined") {
        return 0;
      }

      const db = await getDb();
      return db.transaction(STORE_NAME).store.index(USER_INDEX).count(userId);
    },
  };
}
