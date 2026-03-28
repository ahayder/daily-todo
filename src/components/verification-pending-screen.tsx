"use client";

import { LoaderCircle, LogOut, MailCheck } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";

export function VerificationPendingScreen() {
  const { error, notice, pendingVerificationEmail, requestEmailVerification, signOut } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-card__brand">
          <div className="app-logo auth-card__logo" aria-hidden="true" />
          <div>
            <p className="auth-card__eyebrow">Verify Email</p>
            <h1 className="auth-card__title">Open your inbox before opening your workspace</h1>
          </div>
        </div>

        <p className="auth-card__copy">
          {pendingVerificationEmail
            ? `We’re waiting for ${pendingVerificationEmail} to be verified. Once that’s done, sign back in and your synced notebook will be ready.`
            : "We’re waiting for your email to be verified. Once that’s done, sign back in and your synced notebook will be ready."}
        </p>

        {error ? <p className="auth-form__error">{error}</p> : null}
        {!error && notice ? <p className="auth-form__notice">{notice}</p> : null}

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            className="auth-form__submit"
            disabled={isResending}
            onClick={async () => {
              try {
                setIsResending(true);
                await requestEmailVerification();
              } finally {
                setIsResending(false);
              }
            }}
          >
            {isResending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Sending verification email
              </>
            ) : (
              <>
                <MailCheck className="h-4 w-4" />
                Resend verification email
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="rounded-2xl border-[var(--line)] bg-transparent text-[var(--ink-900)] hover:bg-[color:color-mix(in_srgb,var(--ink-700)_6%,transparent)]"
            disabled={isSigningOut}
            onClick={async () => {
              try {
                setIsSigningOut(true);
                await signOut();
              } finally {
                setIsSigningOut(false);
              }
            }}
          >
            {isSigningOut ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Signing out
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Sign out
              </>
            )}
          </Button>
        </div>
      </section>
    </main>
  );
}
