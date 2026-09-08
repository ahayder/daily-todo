function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;

  return fallback;
}

export function requiresEmailVerification() {
  return parseBooleanEnv(process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION, false);
}

/**
 * Development-only auto-login credentials. When both env vars are set (and we are
 * NOT in a production or test build), the app signs in to a REAL PocketBase account
 * on load so the login screen never blocks local work and sync bugs stay reproducible.
 *
 * These values are baked into the client bundle, so they are for local development
 * only — never set them in a production build. `.env.local` is gitignored.
 */
export function getDevAutoLoginCredentials(): { email: string; password: string } | null {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
    return null;
  }

  const email = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN_EMAIL?.trim();
  const password = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return { email, password };
}
