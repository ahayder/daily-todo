import { vi } from "vitest";
import type { AuthRepository, AuthSession, RegisterInput, SignInInput } from "@/lib/auth";
import {
  createPersistenceMetadata,
  type PersistenceRepository,
} from "@/lib/persistence";
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

  const repository: PersistenceRepository = {
    load: vi.fn(async () => ({
      state: currentState,
      source: "remote" as const,
      status: "synced" as const,
      metadata: createPersistenceMetadata({
        lastRemoteUpdatedAt: "2026-03-11T08:00:00.000Z",
        lastRemoteUpdatedAtClient: "2026-03-11T08:00:00.000Z",
      }),
      conflictResolution: "none" as const,
      notice: null,
      errorMessage: null,
      persistenceAvailable: true,
    })),
    save: vi.fn(async ({ state }) => {
      currentState = state;
      return {
        status: "synced" as const,
        metadata: createPersistenceMetadata({
          lastLocalMutationAt: "2026-03-11T08:10:00.000Z",
          lastRemoteUpdatedAt: "2026-03-11T08:10:01.000Z",
          lastRemoteUpdatedAtClient: "2026-03-11T08:10:00.000Z",
        }),
        conflictResolution: "none" as const,
        notice: null,
        errorMessage: null,
      };
    }),
    clearUserData: vi.fn(async () => {}),
  };

  return {
    repository,
    getState() {
      return currentState;
    },
  };
}
