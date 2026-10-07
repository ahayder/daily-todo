import { vi } from "vitest";
import type { AuthRepository, AuthSession, RegisterInput, SignInInput } from "@/lib/auth";
import type { PersistenceRepository } from "@/lib/persistence";
import {
  applySyncOpsToState,
  getSyncRecordValuesFromState,
  type ApplyOpResult,
  type SyncOp,
} from "@/lib/sync-outbox";
import { createInitialState } from "@/lib/store";
import type { AppState } from "@/lib/types";

export function createMockAuthRepository(initialSession: AuthSession | null = null) {
  let session = initialSession;
  const listeners = new Set<(session: AuthSession | null) => void>();

  const notify = () => {
    listeners.forEach((listener) => listener(session));
  };

  const repository: AuthRepository = {
    getSession: vi.fn(async () => session),
    signIn: vi.fn(async (input: SignInInput) => {
      session = {
        userId: "user_1",
        email: input.email,
        isVerified: true,
        accessToken: "token_1",
      };
      notify();
      return session;
    }),
    register: vi.fn(async (input: RegisterInput) => {
      session = {
        userId: "user_1",
        email: input.email,
        isVerified: false,
        accessToken: "token_1",
      };
      notify();
      return session;
    }),
    requestEmailVerification: vi.fn(async () => {}),
    requestPasswordReset: vi.fn(async () => {}),
    confirmPasswordReset: vi.fn(async () => {}),
    signOut: vi.fn(async () => {
      session = null;
      notify();
    }),
    onAuthStateChange: (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };

  return {
    repository,
    setSession(nextSession: AuthSession | null) {
      session = nextSession;
      notify();
    },
  };
}

export function createMockPersistenceRepository(
  initialState: AppState = createInitialState("2026-03-11"),
) {
  let currentState = initialState;
  let outbox: SyncOp[] = [];

  const repository: PersistenceRepository = {
    loadCached: vi.fn(() => null),
    loadServer: vi.fn(async () => ({
      state: currentState,
      serverRecords: Object.fromEntries(
        Object.values(getSyncRecordValuesFromState(currentState)).map((record) => [
          record.key,
          {
            key: record.key,
            kind: record.kind,
            fingerprint: JSON.stringify(record.value),
            lastRemoteUpdatedAt: "2026-03-11T08:00:00.000Z",
            lastRemoteUpdatedAtClient: "2026-03-11T08:00:00.000Z",
          },
        ]),
      ),
    })),
    applyOps: vi.fn(async ({ ops }: { ops: SyncOp[] }): Promise<ApplyOpResult[]> => {
      currentState = applySyncOpsToState(currentState, ops);
      return ops.map((op) => ({
        key: op.key,
        status: "written" as const,
        serverUpdatedAtClient: op.updatedAtClient,
      }));
    }),
    loadOutbox: vi.fn(() => outbox),
    saveOutbox: vi.fn(({ ops }: { ops: SyncOp[] }) => {
      outbox = ops;
    }),
    saveLocalCache: vi.fn(),
    loadNoteBody: vi.fn(async ({ noteId }) => ({
      markdown: currentState.notesDocs[noteId]?.markdown ?? "",
      status: "ready" as const,
      source: "remote" as const,
      updatedAtClient: currentState.notesDocs[noteId]?.updatedAt ?? null,
      notice: null,
      errorMessage: null,
    })),
    saveNoteBody: vi.fn(async ({ noteId, markdown, updatedAtClient }) => {
      if (currentState.notesDocs[noteId]) {
        currentState = {
          ...currentState,
          notesDocs: {
            ...currentState.notesDocs,
            [noteId]: {
              ...currentState.notesDocs[noteId],
              markdown,
              updatedAt: updatedAtClient,
            },
          },
        };
      }

      return {
        markdown,
        updatedAtClient,
        status: "synced" as const,
        notice: null,
        errorMessage: null,
      };
    }),
    primeRecentNoteCache: vi.fn(async () => {}),
    evictExpiredCachedBodies: vi.fn(async () => {}),
    clearUserData: vi.fn(async () => {}),
  };

  return {
    repository,
    getState() {
      return currentState;
    },
    setServerState(state: AppState) {
      currentState = state;
    },
    getOutbox() {
      return outbox;
    },
  };
}
