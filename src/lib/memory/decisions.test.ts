import { describe, expect, it } from "vitest";
import { currentDecisions, decisionChain, logDecision, updateDecision } from "./decisions";

const NOW = new Date("2026-10-27T05:00:00.000Z");

describe("decisions", () => {
  it("logs a decision as proposed by default", () => {
    const { created } = logDecision({}, { title: "Use Postgres", people: ["Brian", " Brian "] }, NOW);
    expect(created).toMatchObject({ status: "proposed", people: ["Brian"], replacesId: null });
  });

  it("keeps a replace chain: the old one is marked, never deleted", () => {
    const first = logDecision({}, { title: "Ship Friday", status: "agreed" }, NOW);
    const second = logDecision(first.decisions, { title: "Ship Monday", replacesId: first.created!.id }, NOW);
    const old = second.decisions[first.created!.id];
    expect(old.replacedById).toBe(second.created!.id);
    expect(old.deletedAt).toBeNull();
    expect(second.created!.replacesId).toBe(first.created!.id);
    expect(currentDecisions(second.decisions).map((d) => d.title)).toEqual(["Ship Monday"]);
    expect(decisionChain(second.decisions, first.created!.id).map((d) => d.title)).toEqual([
      "Ship Friday",
      "Ship Monday",
    ]);
  });

  it("ignores an unknown replacesId", () => {
    const { created } = logDecision({}, { title: "X", replacesId: "missing" }, NOW);
    expect(created?.replacesId).toBeNull();
  });

  it("changes status", () => {
    const { decisions, created } = logDecision({}, { title: "X" }, NOW);
    const next = updateDecision(decisions, created!.id, { status: "agreed" }, NOW);
    expect(next[created!.id].status).toBe("agreed");
  });
});
