import { normalizeAppState } from "@/lib/persistence";
import type { AppState } from "@/lib/types";

export const WORKSPACE_EXPORT_VERSION = 1;

export type WorkspaceExportPayload = {
  formatVersion: number;
  exportedAt: string;
  state: AppState;
  metadata?: Record<string, unknown>;
};

export function createWorkspaceExport(
  state: AppState,
  input: { now?: Date; metadata?: Record<string, unknown> } = {},
): WorkspaceExportPayload {
  const now = input.now ?? new Date();

  return {
    formatVersion: WORKSPACE_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    state,
    metadata: input.metadata,
  };
}

export function parseWorkspaceImport(input: unknown, now = new Date()): AppState | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as {
    formatVersion?: unknown;
    state?: unknown;
  };

  if (candidate.formatVersion !== WORKSPACE_EXPORT_VERSION) {
    return null;
  }

  return normalizeAppState(candidate.state, now);
}
