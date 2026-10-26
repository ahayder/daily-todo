import type { LifeArea, Project } from "@/lib/types";
import { cleanTags, newRecordBase, patchRecord } from "./records";

export type ProjectInput = {
  name: string;
  area?: LifeArea | null;
  state?: string;
  nextStep?: string;
  tags?: string[];
};

/** A new active project, or null when the name is blank. */
export function createProject(input: ProjectInput, now = new Date()): Project | null {
  const name = input.name.trim();
  if (!name) return null;
  return {
    ...newRecordBase("project", input.tags, now),
    name,
    area: input.area ?? null,
    state: input.state?.trim() ?? "",
    nextStep: input.nextStep?.trim() ?? "",
    status: "active",
  };
}

export function updateProject(
  projects: Record<string, Project>,
  projectId: string,
  updates: Partial<Pick<Project, "name" | "area" | "state" | "nextStep" | "status" | "tags">>,
  now = new Date(),
): Record<string, Project> {
  return patchRecord(
    projects,
    projectId,
    { ...updates, name: updates.name?.trim() || undefined, tags: updates.tags ? cleanTags(updates.tags) : undefined },
    now,
  );
}
