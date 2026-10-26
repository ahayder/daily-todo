import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/types";
import { emptyMemoryData } from "./data";
import { createDecision } from "./decisions";
import { createFollowUp } from "./follow-ups";
import { createProject } from "./projects";
import { buildStandupAgenda, previousWorkday } from "./standup";
import { createTask } from "./tasks";

const NOW = new Date("2026-10-27T05:00:00.000Z");
const map = <T extends { id: string }>(...items: T[]) => Object.fromEntries(items.map((item) => [item.id, item]));

describe("buildStandupAgenda", () => {
  it("defaults to the previous workday", () => {
    expect(previousWorkday("2026-10-26")).toBe("2026-10-23"); // Monday → Friday
    expect(previousWorkday("2026-10-27")).toBe("2026-10-26");
  });

  it("builds every section for the job area", () => {
    const velox = createProject({ name: "Velox", area: "job", nextStep: "Fix the importer" }, NOW)!;
    const youtube = createProject({ name: "YouTube", area: "content", nextStep: "Shoot" }, NOW)!;
    const done: Task = {
      ...createTask({ title: "Shipped export", projectId: velox.id }, NOW)!,
      status: "done",
      doneAt: "2026-10-26T12:00:00.000Z",
    };
    const oldDone: Task = { ...done, id: "old", title: "Ancient", doneAt: "2026-10-01T12:00:00.000Z" };
    const today = createTask({ title: "Review PR", day: "2026-10-27", area: "job" }, NOW)!;
    const contentTask = createTask({ title: "Edit video", day: "2026-10-27", area: "content" }, NOW)!;
    const proposal = createDecision({ title: "Move standup", projectId: velox.id }, NOW)!;
    const agreed = createDecision({ title: "Use queues", status: "agreed", decidedOn: "2026-10-26" }, NOW)!;
    const waitBrian = createFollowUp({ what: "API keys", who: "Brian", since: "2026-10-25" }, NOW)!;
    const waitBrian2 = createFollowUp({ what: "Review", who: "Brian", since: "2026-10-26" }, NOW)!;

    const data = emptyMemoryData();
    data.project = map(velox, youtube);
    data.task = map(done, oldDone, today, contentTask);
    data.decision = map(proposal, agreed);
    data.follow_up = map(waitBrian, waitBrian2);

    const agenda = buildStandupAgenda("2026-10-27", data, { timeZone: "Asia/Dhaka" });
    expect(agenda.since).toBe("2026-10-26");
    expect(agenda.whatIDid.tasks.map((t) => t.title)).toEqual(["Shipped export"]);
    expect(agenda.whatIDid.decisions.map((d) => d.title)).toEqual(["Use queues"]);
    expect(agenda.today.map((t) => t.title)).toEqual(["Review PR"]);
    expect(agenda.waitingOnOthers).toEqual([{ who: "Brian", items: [waitBrian, waitBrian2] }]);
    expect(agenda.openProposals.map((d) => d.title)).toEqual(["Move standup"]);
    expect(agenda.next).toEqual([{ project: "Velox", nextStep: "Fix the importer" }]);

    const all = buildStandupAgenda("2026-10-27", data, { timeZone: "Asia/Dhaka", area: "all" });
    expect(all.today).toHaveLength(2);
  });
});
