/**
 * Owner / super-admin gate.
 *
 * The super-admin surfaces (currently the developer testing tools in the sidebar
 * profile menu) are shown only to owner accounts. Ownership is an email
 * allowlist so it works in the deployed app for a known set of addresses without
 * a backend role system. The default owner is the project owner; additional
 * addresses can be supplied via NEXT_PUBLIC_SUPER_ADMIN_EMAILS (comma-separated).
 *
 * This is a UI-visibility gate for personal testing tools, not a security
 * boundary — the actions it reveals (e.g. simulating the next day) are local,
 * non-destructive, and already reachable through normal use over time.
 */

const DEFAULT_SUPER_ADMIN_EMAILS = ["alihayder19@gmail.com"];

function getConfiguredSuperAdminEmails(): string[] {
  const configured = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS ?? "";
  const parsed = configured
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const merged = new Set<string>([
    ...DEFAULT_SUPER_ADMIN_EMAILS.map((entry) => entry.toLowerCase()),
    ...parsed,
  ]);

  return Array.from(merged);
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return getConfiguredSuperAdminEmails().includes(email.trim().toLowerCase());
}
