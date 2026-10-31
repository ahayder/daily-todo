function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;

  return fallback;
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

export function requiresEmailVerification() {
  return parseBooleanEnv(process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION, false);
}

/**
 * Development-only auto-login credentials. When both env vars are set (and we are
 * NOT in a production or test build), the app signs in to a REAL PocketBase account
 * on load so the login screen never blocks local work and sync bugs stay reproducible.
 *
 * These values are baked into the client bundle, so keep them in `.env.development.local`
 * (Next loads it only for `next dev`). A production build refuses to run when they are
 * set (next.config.ts), and `scripts/check-bundle-secrets.mjs` scans the output.
 */
export function getDevAutoLoginCredentials(): { email: string; password: string } | null {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
    return null;
  }
  // Defense in depth: only ever on this machine (localhost, 127.0.0.1, *.localhost).
  if (typeof window !== "undefined" && !isLocalHostname(window.location.hostname)) {
    return null;
  }

  const email = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN_EMAIL?.trim();
  const password = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return { email, password };
}
