import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  DEV_WORKSPACE_ENABLED_KEY,
  getDevelopmentWorkspaceEnabled,
} from "@/lib/dev-mode";

describe("development workspace mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/todos");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("forces the isolated workspace and URL on localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    window.history.replaceState({}, "", "/todos?devWorkspace=0#today");

    expect(getDevelopmentWorkspaceEnabled()).toBe(true);
    expect(new URL(window.location.href).searchParams.get("devWorkspace")).toBe("1");
    expect(window.location.hash).toBe("#today");
    expect(window.localStorage.getItem(DEV_WORKSPACE_ENABLED_KEY)).toBe("1");
  });
});
