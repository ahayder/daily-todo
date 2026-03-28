"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound, LoaderCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordResetScreen() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { error, notice, confirmPasswordReset, clearTransientState } = useAuth();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const message = localError ?? error;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearTransientState();
    setLocalError(null);

    if (!token) {
      setLocalError("This reset link is missing its token. Request a new reset email.");
      return;
    }

    if (password.length < 8) {
      setLocalError("Use at least 8 characters for your new password.");
      return;
    }

    if (password !== passwordConfirm) {
      setLocalError("Passwords do not match yet.");
      return;
    }

    try {
      setIsSubmitting(true);
      await confirmPasswordReset({
        token,
        password,
        passwordConfirm,
      });
      setPassword("");
      setPasswordConfirm("");
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message) {
        setLocalError(nextError.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-card__brand">
          <div className="app-logo auth-card__logo" aria-hidden="true" />
          <div>
            <p className="auth-card__eyebrow">Reset Password</p>
            <h1 className="auth-card__title">Choose a new password for DailyTodo</h1>
          </div>
        </div>

        <p className="auth-card__copy">
          Set a new password for your PocketBase account, then head back to sign in.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-form__field">
            <span>New password</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required
              className="h-12 rounded-2xl border-[var(--line)] bg-white/70 px-4"
            />
          </label>

          <label className="auth-form__field">
            <span>Confirm password</span>
            <Input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
              placeholder="Repeat the new password"
              required
              className="h-12 rounded-2xl border-[var(--line)] bg-white/70 px-4"
            />
          </label>

          {message ? <p className="auth-form__error">{message}</p> : null}
          {!message && notice ? <p className="auth-form__notice">{notice}</p> : null}

          <Button type="submit" className="auth-form__submit h-12 rounded-2xl" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Resetting password
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                Save new password
              </>
            )}
          </Button>
        </form>

        <Link
          href="/daily"
          onClick={clearTransientState}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ink-700)] transition hover:text-[var(--ink-900)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
