"use client";

import { startTransition, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canUseDevelopmentWorkspace } from "@/lib/dev-mode";
import { cn } from "@/lib/utils";

type AuthMode = "sign-in" | "register" | "reset";

export function AuthGate() {
  const {
    enterDevelopmentWorkspace,
    error,
    notice,
    register,
    requestPasswordReset,
    signIn,
    status,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const canOpenDevWorkspace = canUseDevelopmentWorkspace();

  const heading =
    mode === "register"
      ? "Create your synced DailyTodo home"
      : mode === "reset"
        ? "Reset your password"
        : "Sign in to your DailyTodo workspace";

  const description =
    mode === "register"
      ? "Create your personal PocketBase-backed workspace. Your notes still keep a local safety cache, but now they can follow you across devices."
      : mode === "reset"
        ? "Enter your account email and we’ll ask PocketBase to send a password reset email."
        : "Your notes, planner, and todos now sync through your PocketBase account, with a local cache kept for safety when the network is shaky.";

  const footerPrompt = useMemo(() => {
    if (mode === "register") {
      return {
        question: "Already have an account?",
        action: "Sign in",
        nextMode: "sign-in" as const,
      };
    }

    if (mode === "reset") {
      return {
        question: "Remembered your password?",
        action: "Back to sign in",
        nextMode: "sign-in" as const,
      };
    }

    return {
      question: "New here?",
      action: "Create an account",
      nextMode: "register" as const,
    };
  }, [mode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setLocalError(null);

    try {
      if (mode === "register") {
        if (password.length < 8) {
          throw new Error("Use at least 8 characters for your password.");
        }

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match yet.");
        }

        await register({
          email: email.trim(),
          password,
          name: name.trim(),
        });
        return;
      }

      if (mode === "reset") {
        await requestPasswordReset({
          email: email.trim(),
        });
        return;
      }

      await signIn({
        email: email.trim(),
        password,
      });
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message) {
        setLocalError(nextError.message);
      }
    } finally {
      startTransition(() => {
        setIsSubmitting(false);
      });
    }
  };

  const message = localError ?? error;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-[28px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_92%,white)] shadow-[0_24px_80px_rgba(31,36,48,0.12)] md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-[var(--line)] bg-[linear-gradient(155deg,rgba(47,109,98,0.12),rgba(250,248,244,0.95)_42%,rgba(196,164,115,0.18))] p-10 md:flex md:flex-col md:justify-between">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-10 h-52 w-52 rounded-full bg-[rgba(47,109,98,0.16)] blur-3xl" />
            <div className="absolute bottom-6 right-8 h-48 w-48 rounded-full bg-[rgba(196,164,115,0.20)] blur-3xl" />
          </div>
          <div className="relative space-y-5">
            <div className="inline-flex items-center gap-3 rounded-full border border-[rgba(47,109,98,0.16)] bg-white/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--brand)] backdrop-blur">
              <div className="app-logo h-6 w-6 rounded-[9px]" aria-hidden="true" />
              PocketBase Sync
            </div>
            <div className="space-y-4">
              <h1 className="max-w-md text-4xl leading-[1.02] font-semibold tracking-[-0.04em] text-[var(--ink-900)]">
                Daily planning that feels handwritten, but travels with you.
              </h1>
              <p className="max-w-lg text-base leading-7 text-[var(--ink-700)]">
                A calm desk-notebook feel, now backed by your VPS. The local cache keeps your
                work close, and PocketBase keeps it reachable.
              </p>
            </div>
          </div>
          <div className="relative grid gap-3">
            {[
              "Email/password sign-in with persistent sessions",
              "Create an account directly from the app",
              "Reset password flow wired to PocketBase email",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 px-4 py-3 text-sm text-[var(--ink-900)] backdrop-blur"
              >
                <Sparkles className="h-4 w-4 text-[var(--brand)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center bg-[rgba(250,248,244,0.74)] px-4 py-8 sm:px-8 md:px-10">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between md:hidden">
              <div className="inline-flex items-center gap-3 rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand)]">
                <div className="app-logo h-6 w-6 rounded-[9px]" aria-hidden="true" />
                PocketBase Sync
              </div>
            </div>

            <div className="mb-6 rounded-full bg-[color:color-mix(in_srgb,var(--ink-700)_8%,transparent)] p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign-in");
                    setLocalError(null);
                  }}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    mode === "sign-in"
                      ? "bg-[var(--paper-strong)] text-[var(--ink-900)] shadow-[0_10px_25px_rgba(31,36,48,0.09)]"
                      : "text-[var(--ink-700)] hover:text-[var(--ink-900)]",
                  )}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setLocalError(null);
                  }}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    mode === "register"
                      ? "bg-[var(--paper-strong)] text-[var(--ink-900)] shadow-[0_10px_25px_rgba(31,36,48,0.09)]"
                      : "text-[var(--ink-700)] hover:text-[var(--ink-900)]",
                  )}
                >
                  Create account
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--ink-900)]">
                {heading}
              </h2>
              <p className="text-sm leading-6 text-[var(--ink-700)]">{description}</p>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--ink-900)]">Display name</span>
                  <Input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="How should we greet you?"
                    autoComplete="name"
                    className="h-12 rounded-2xl border-[var(--line)] bg-white/70 px-4"
                  />
                </label>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--ink-900)]">Email</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="h-12 rounded-2xl border-[var(--line)] bg-white/70 px-4"
                />
              </label>

              {mode !== "reset" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--ink-900)]">Password</span>
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    required
                    className="h-12 rounded-2xl border-[var(--line)] bg-white/70 px-4"
                  />
                </label>
              ) : null}

              {mode === "register" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--ink-900)]">Confirm password</span>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    required
                    className="h-12 rounded-2xl border-[var(--line)] bg-white/70 px-4"
                  />
                </label>
              ) : null}

              {message ? (
                <p className="rounded-2xl border border-[rgba(184,66,46,0.18)] bg-[rgba(184,66,46,0.08)] px-4 py-3 text-sm text-[var(--warn)]">
                  {message}
                </p>
              ) : null}

              {!message && notice ? (
                <p className="rounded-2xl border border-[rgba(47,109,98,0.16)] bg-[rgba(47,109,98,0.08)] px-4 py-3 text-sm text-[var(--brand)]">
                  {notice}
                </p>
              ) : null}

              <div className="space-y-3 pt-2">
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl bg-[var(--brand)] text-white hover:bg-[color:color-mix(in_srgb,var(--brand)_86%,black)]"
                  disabled={isSubmitting || status === "loading"}
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      {mode === "register"
                        ? "Creating account"
                        : mode === "reset"
                          ? "Sending reset link"
                          : "Signing in"}
                    </>
                  ) : mode === "register" ? (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Create account
                    </>
                  ) : mode === "reset" ? (
                    <>
                      <Mail className="h-4 w-4" />
                      Send reset email
                    </>
                  ) : (
                    <>
                      <LockKeyhole className="h-4 w-4" />
                      Sign in
                    </>
                  )}
                </Button>

                {canOpenDevWorkspace ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalError(null);
                      enterDevelopmentWorkspace();
                    }}
                    className="w-full rounded-2xl border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--paper-strong)_88%,transparent)] px-4 py-3 text-sm font-semibold text-[var(--ink-900)] transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                  >
                    Open local dev workspace
                  </button>
                ) : null}

                {mode === "sign-in" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setLocalError(null);
                    }}
                    className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[color:color-mix(in_srgb,var(--ink-700)_6%,transparent)] hover:text-[var(--ink-900)]"
                  >
                    Forgot password?
                  </button>
                ) : null}

                {mode !== "sign-in" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("sign-in");
                      setLocalError(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl px-1 py-2 text-sm font-semibold text-[var(--ink-700)] transition hover:text-[var(--ink-900)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </button>
                ) : null}
              </div>
            </form>

            <div className="mt-6 text-sm text-[var(--ink-700)]">
              {footerPrompt.question}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(footerPrompt.nextMode);
                  setLocalError(null);
                }}
                className="font-semibold text-[var(--brand)] hover:underline"
              >
                {footerPrompt.action}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
