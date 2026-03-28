import { vi } from "vitest";
import type { AuthRepository, AuthSession, RegisterInput, SignInInput } from "@/lib/auth";
import type { PersistenceRepository } from "@/lib/persistence";
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
        accessToken: "token_1",
      };
      notify();
      return session;
    }),
    register: vi.fn(async (input: RegisterInput) => {
      session = {
        userId: "user_1",
        email: input.email,
        accessToken: "token_1",
      };
      notify();
      return session;
    }),
    requestPasswordReset: vi.fn(async () => {}),
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
    load: vi.fn(async () => currentState),
    save: vi.fn(async ({ state }) => {
      currentState = state;
    }),
  };

  return {
    repository,
    getState() {
      return currentState;
    },
  };
}
