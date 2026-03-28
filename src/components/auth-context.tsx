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
import { requiresEmailVerification } from "@/lib/auth-config";
import {
  createDevelopmentWorkspaceSession,
  getDevelopmentWorkspaceEnabled,
  isDevelopmentWorkspaceSession,
  setDevelopmentWorkspaceEnabled,
} from "@/lib/dev-mode";

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  error: string | null;
  notice: string | null;
  pendingVerificationEmail: string | null;
  signIn: (input: SignInInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  requestEmailVerification: () => Promise<void>;
  requestPasswordReset: (input: { email: string }) => Promise<void>;
  confirmPasswordReset: (input: {
    token: string;
    password: string;
    passwordConfirm: string;
  }) => Promise<void>;
  enterDevelopmentWorkspace: () => void;
  clearTransientState: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Authentication failed. Please try again.";
}

function getStatusForSession(session: AuthSession | null): AuthStatus {
  if (!session) return "anonymous";
  if (!requiresEmailVerification()) return "authenticated";
  return session.isVerified ? "authenticated" : "verification-pending";
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
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      if (getDevelopmentWorkspaceEnabled()) {
        const nextSession = createDevelopmentWorkspaceSession();
        if (!mounted) {
          return;
        }

        startTransition(() => {
          setSession(nextSession);
          setPendingVerificationEmail(null);
          setStatus("authenticated");
          setError(null);
          setNotice("Development workspace is active on this device.");
        });
        return;
      }

      try {
        const nextSession = await repository.getSession();
        if (!mounted) {
          return;
        }

        startTransition(() => {
          setSession(nextSession);
          setPendingVerificationEmail(nextSession?.isVerified ? null : nextSession?.email ?? null);
          setStatus(getStatusForSession(nextSession));
        });
      } catch (nextError) {
        if (!mounted) {
          return;
        }

        startTransition(() => {
          setSession(null);
          setPendingVerificationEmail(null);
          setStatus("anonymous");
          setError(getErrorMessage(nextError));
          setNotice(null);
        });
      }
    };

    void hydrate();

    const unsubscribe = repository.onAuthStateChange?.((nextSession) => {
      if (getDevelopmentWorkspaceEnabled()) {
        return;
      }

      if (!mounted) {
        return;
      }

      startTransition(() => {
        setSession(nextSession);
        setPendingVerificationEmail(nextSession?.isVerified ? null : nextSession?.email ?? null);
        setStatus(getStatusForSession(nextSession));
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
      pendingVerificationEmail,
      async signIn(input) {
        setDevelopmentWorkspaceEnabled(false);
        setError(null);
        setNotice(null);

        try {
          const nextSession = await repository.signIn(input);
          const verificationRequired = requiresEmailVerification();
          startTransition(() => {
            setSession(nextSession);
            setPendingVerificationEmail(
              verificationRequired && !nextSession.isVerified ? nextSession.email : null,
            );
            setStatus(getStatusForSession(nextSession));
            setNotice(
              verificationRequired && !nextSession.isVerified
                ? "Verify your email to open your synced workspace."
                : null,
            );
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
        setDevelopmentWorkspaceEnabled(false);
        setError(null);
        setNotice(null);

        try {
          const nextSession = await repository.register(input);
          if (requiresEmailVerification()) {
            await repository.requestEmailVerification({ email: nextSession.email });
            await repository.signOut();

            startTransition(() => {
              setSession(null);
              setPendingVerificationEmail(nextSession.email);
              setStatus("verification-pending");
              setNotice("Check your email for a verification link before signing in.");
            });
            return;
          }

          startTransition(() => {
            setSession(nextSession);
            setPendingVerificationEmail(null);
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
      async requestEmailVerification() {
        setError(null);

        try {
          await repository.requestEmailVerification({ email: pendingVerificationEmail ?? undefined });
          startTransition(() => {
            setNotice("We sent a fresh verification email.");
          });
        } catch (nextError) {
          const message = getErrorMessage(nextError);
          startTransition(() => {
            setError(message);
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
      async confirmPasswordReset(input) {
        setError(null);
        setNotice(null);

        try {
          await repository.confirmPasswordReset(input);
          startTransition(() => {
            setStatus("anonymous");
            setSession(null);
            setPendingVerificationEmail(null);
            setNotice("Your password has been reset. Sign in with the new password.");
          });
        } catch (nextError) {
          const message = getErrorMessage(nextError);
          startTransition(() => {
            setError(message);
          });
          throw nextError;
        }
      },
      enterDevelopmentWorkspace() {
        const nextSession = createDevelopmentWorkspaceSession();
        setDevelopmentWorkspaceEnabled(true);
        startTransition(() => {
          setSession(nextSession);
          setPendingVerificationEmail(null);
          setStatus("authenticated");
          setError(null);
          setNotice("Development workspace is active on this device.");
        });
      },
      clearTransientState() {
        startTransition(() => {
          setError(null);
          setNotice(null);
        });
      },
      async signOut() {
        if (isDevelopmentWorkspaceSession(session)) {
          setDevelopmentWorkspaceEnabled(false);
        } else {
          await repository.signOut();
        }
        startTransition(() => {
          setSession(null);
          setPendingVerificationEmail(null);
          setStatus("anonymous");
          setError(null);
          setNotice(null);
        });
      },
    }),
    [error, notice, pendingVerificationEmail, repository, session, status],
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
