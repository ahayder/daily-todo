import type { AuthSession } from "@/lib/auth";

export const DEV_WORKSPACE_QUERY_KEY = "devWorkspace";
export const DEV_WORKSPACE_ENABLED_KEY = "dailytodo.dev-workspace.enabled";
export const DEV_WORKSPACE_STATE_KEY = "dailytodo.dev-workspace.state";
export const DEV_WORKSPACE_USER_ID = "dev-browser-workspace";

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isLocalDevelopmentWorkspaceForced() {
  return (
    typeof window !== "undefined" &&
    process.env.NODE_ENV !== "test" &&
    isLoopbackHostname(window.location.hostname)
  );
}

export function canUseDevelopmentWorkspace() {
  return (
    typeof window !== "undefined" &&
    (process.env.NODE_ENV !== "production" || isLocalDevelopmentWorkspaceForced())
  );
}

export function setDevelopmentWorkspaceEnabled(enabled: boolean) {
  if (!canUseDevelopmentWorkspace()) {
    return;
  }

  if (enabled) {
    window.localStorage.setItem(DEV_WORKSPACE_ENABLED_KEY, "1");
  } else {
    window.localStorage.removeItem(DEV_WORKSPACE_ENABLED_KEY);
  }
}

export function getDevelopmentWorkspaceEnabled() {
  if (!canUseDevelopmentWorkspace()) {
    return false;
  }

  const url = new URL(window.location.href);
  if (isLocalDevelopmentWorkspaceForced()) {
    url.searchParams.set(DEV_WORKSPACE_QUERY_KEY, "1");
    window.history.replaceState(window.history.state, "", url);
    setDevelopmentWorkspaceEnabled(true);
    return true;
  }

  const requested = url.searchParams.get(DEV_WORKSPACE_QUERY_KEY);

  if (requested === "1") {
    setDevelopmentWorkspaceEnabled(true);
    return true;
  }

  if (requested === "0") {
    setDevelopmentWorkspaceEnabled(false);
    return false;
  }

  return window.localStorage.getItem(DEV_WORKSPACE_ENABLED_KEY) === "1";
}

export function createDevelopmentWorkspaceSession(): AuthSession {
  return {
    userId: DEV_WORKSPACE_USER_ID,
    email: "dev@local.workspace",
    isVerified: true,
  };
}

export function isDevelopmentWorkspaceSession(session: AuthSession | null) {
  return session?.userId === DEV_WORKSPACE_USER_ID;
}
