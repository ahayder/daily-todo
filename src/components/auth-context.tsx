"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AuthRepository,
  AuthSession,
  AuthStatus,
  RegisterInput,
  SignInInput,
} from "@/lib/auth";

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  error: string | null;
  notice: string | null;
  signIn: (input: SignInInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  requestPasswordReset: (input: { email: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Authentication failed. Please try again.";
}

export function AuthProvider({
  children,
  repository,
}: {
  children: ReactNode;
  repository: AuthRepository;
}) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const nextSession = await repository.getSession();
        if (!mounted) {
          return;
        }

        startTransition(() => {
          setSession(nextSession);
          setStatus(nextSession ? "authenticated" : "anonymous");
        });
      } catch (nextError) {
        if (!mounted) {
          return;
        }

        startTransition(() => {
          setSession(null);
          setStatus("anonymous");
          setError(getErrorMessage(nextError));
          setNotice(null);
        });
      }
    };

    void hydrate();

    const unsubscribe = repository.onAuthStateChange?.((nextSession) => {
      if (!mounted) {
        return;
      }

      startTransition(() => {
        setSession(nextSession);
        setStatus(nextSession ? "authenticated" : "anonymous");
        if (!nextSession) {
          setError(null);
          setNotice(null);
        }
      });
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [repository]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      error,
      notice,
      async signIn(input) {
        setError(null);
        setNotice(null);

        try {
          const nextSession = await repository.signIn(input);
          startTransition(() => {
            setSession(nextSession);
            setStatus("authenticated");
            setNotice(null);
          });
        } catch (nextError) {
          const message = getErrorMessage(nextError);
          startTransition(() => {
            setError(message);
            setStatus("anonymous");
          });
          throw nextError;
        }
      },
      async register(input) {
        setError(null);
        setNotice(null);

        try {
          const nextSession = await repository.register(input);
          startTransition(() => {
            setSession(nextSession);
            setStatus("authenticated");
          });
        } catch (nextError) {
          const message = getErrorMessage(nextError);
          startTransition(() => {
            setError(message);
            setStatus("anonymous");
          });
          throw nextError;
        }
      },
      async requestPasswordReset(input) {
        setError(null);
        setNotice(null);

        try {
          await repository.requestPasswordReset(input);
          startTransition(() => {
            setNotice("Password reset instructions have been sent to your email.");
          });
        } catch (nextError) {
          const message = getErrorMessage(nextError);
          startTransition(() => {
            setError(message);
          });
          throw nextError;
        }
      },
      async signOut() {
        await repository.signOut();
        startTransition(() => {
          setSession(null);
          setStatus("anonymous");
          setError(null);
          setNotice(null);
        });
      },
    }),
    [error, notice, repository, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
