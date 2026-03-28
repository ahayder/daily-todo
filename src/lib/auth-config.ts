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
