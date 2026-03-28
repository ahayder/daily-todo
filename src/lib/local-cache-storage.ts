import {
  APP_STATE_VERSION,
  LEGACY_LOCAL_STORAGE_KEY,
  createPersistenceMetadata,
  type LocalCacheStorage,
  tryParseAppState,
} from "@/lib/persistence";

const CACHE_KEY_PREFIX = "dailytodo.cache.v2";

type ParsedEnvelope = {
  state?: unknown;
  metadata?: {
    stateVersion?: unknown;
    lastLocalMutationAt?: unknown;
    lastRemoteUpdatedAt?: unknown;
    lastRemoteUpdatedAtClient?: unknown;
  };
};

export function getUserCacheStorageKey(userId: string) {
  return `${CACHE_KEY_PREFIX}.${userId}`;
}

export function createBrowserLocalCacheStorage(): LocalCacheStorage {
  return {
    loadCached({ userId, now = new Date() }) {
      if (typeof window === "undefined") {
        return {
          envelope: null,
          available: false,
        };
      }

      try {
        const scoped = window.localStorage.getItem(getUserCacheStorageKey(userId));
        const raw = scoped ?? window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
        if (!raw) {
          return {
            envelope: null,
            available: true,
          };
        }

        const parsed = JSON.parse(raw) as ParsedEnvelope | unknown;
        const candidateState =
          parsed && typeof parsed === "object" && "state" in parsed
            ? (parsed as ParsedEnvelope).state
            : parsed;
        const state = tryParseAppState(candidateState, now);

        if (!state) {
          return {
            envelope: null,
            available: true,
          };
        }

        const parsedMetadata =
          parsed && typeof parsed === "object" && "metadata" in parsed
            ? (parsed as ParsedEnvelope).metadata
            : undefined;

        return {
          envelope: {
            state,
            metadata: createPersistenceMetadata({
              stateVersion:
                typeof parsedMetadata?.stateVersion === "number"
                  ? parsedMetadata.stateVersion
                  : APP_STATE_VERSION,
              lastLocalMutationAt:
                typeof parsedMetadata?.lastLocalMutationAt === "string"
                  ? parsedMetadata.lastLocalMutationAt
                  : null,
              lastRemoteUpdatedAt:
                typeof parsedMetadata?.lastRemoteUpdatedAt === "string"
                  ? parsedMetadata.lastRemoteUpdatedAt
                  : null,
              lastRemoteUpdatedAtClient:
                typeof parsedMetadata?.lastRemoteUpdatedAtClient === "string"
                  ? parsedMetadata.lastRemoteUpdatedAtClient
                  : null,
            }),
          },
          available: true,
        };
      } catch {
        return {
          envelope: null,
          available: false,
        };
      }
    },
    saveCached({ userId, envelope }) {
      if (typeof window === "undefined") {
        return {
          available: false,
        };
      }

      try {
        window.localStorage.setItem(getUserCacheStorageKey(userId), JSON.stringify(envelope));
        return {
          available: true,
        };
      } catch {
        return {
          available: false,
        };
      }
    },
    clearCached({ userId }) {
      if (typeof window === "undefined") {
        return {
          available: false,
        };
      }

      try {
        window.localStorage.removeItem(getUserCacheStorageKey(userId));
        return {
          available: true,
        };
      } catch {
        return {
          available: false,
        };
      }
    },
  };
}
