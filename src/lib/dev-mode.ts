import type { AuthSession } from "@/lib/auth";

export const DEV_WORKSPACE_QUERY_KEY = "devWorkspace";
export const DEV_WORKSPACE_ENABLED_KEY = "dailytodo.dev-workspace.enabled";
export const DEV_WORKSPACE_STATE_KEY = "dailytodo.dev-workspace.state";
export const DEV_WORKSPACE_USER_ID = "dev-browser-workspace";

export function canUseDevelopmentWorkspace() {
  return process.env.NODE_ENV !== "production" && typeof window !== "undefined";
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
