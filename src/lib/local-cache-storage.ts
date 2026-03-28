import {
  LEGACY_LOCAL_STORAGE_KEY,
  type LocalCacheStorage,
  tryParseAppState,
} from "@/lib/persistence";

const CACHE_KEY_PREFIX = "dailytodo.cache.v2";

export function getUserCacheStorageKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}.${userId}`;
}

export function createBrowserLocalCacheStorage(): LocalCacheStorage {
  return {
    loadCached({ userId, now = new Date() }) {
      if (typeof window === "undefined") {
        return null;
      }

      const scoped = window.localStorage.getItem(getUserCacheStorageKey(userId));
      const raw = scoped ?? window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      try {
        return tryParseAppState(JSON.parse(raw), now);
      } catch {
        return null;
      }
    },
    saveCached({ userId, state }) {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(getUserCacheStorageKey(userId), JSON.stringify(state));
    },
    clearCached({ userId }) {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.removeItem(getUserCacheStorageKey(userId));
    },
  };
}
