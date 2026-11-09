import { describe, expect, test } from "bun:test";
import { cpuPercent, createSampler, machineTimes } from "../src/metrics";
import { projects } from "../src/projects";
import { Sample, Snapshot, type Session } from "../src/rpc";

describe("CPU accounting", () => {
  test("uses deltas across all cores", () => {
    expect(
      cpuPercent({ busy: 100, total: 200 }, { busy: 150, total: 400 }),
    ).toBe(25);
    expect(
      cpuPercent({ busy: 100, total: 200 }, { busy: 100, total: 200 }),
    ).toBe(0);
    expect(
      cpuPercent({ busy: 100, total: 200 }, { busy: 50, total: 300 }),
    ).toBe(0);
  });
  test("reads real machine counters", () => {
    const times = machineTimes();
    expect(times.total).toBeGreaterThanOrEqual(times.busy);
    expect(times.busy).toBeGreaterThanOrEqual(0);
  });
});

test("samples real process measurements and bounds history", () => {
  const sampler = createSampler(3);
  Array.from({ length: 5 }, () => sampler.sample());
  expect(sampler.samples).toHaveLength(3);
  sampler.samples.forEach((sample) => {
    expect(Sample.safeParse(sample).success).toBe(true);
    expect(sample.rss).toBeGreaterThan(0);
    expect(sample.cpu).toBeGreaterThanOrEqual(0);
    expect(sample.machineCpu).toBeLessThanOrEqual(100);
    expect(sample.machineTotal).toBeGreaterThan(0);
  });
});

function session(input: Partial<Session>): Session {
  return {
    id: "a",
    projectID: "project",
    directory: "/repo",
    title: "Test",
    status: "idle",
    cost: 0.25,
    tokens: 100,
    ...input,
  };
}

test("groups worktrees by project without duplicating session cost", () => {
  const result = projects([
    session({}),
    session({
      id: "b",
      directory: "/repo-worktree",
      status: "running",
      parentID: "a",
    }),
    session({
      id: "c",
      projectID: "other",
      directory: "/another",
      status: "waiting",
    }),
  ]);
  expect(result).toHaveLength(2);
  expect(result[0].directory).toBe("/repo");
  expect(result[0].running).toBe(1);
  expect(result[0].cost).toBe(0.5);
  expect(result[0].tokens).toBe(200);
  expect(result[1].waiting).toBe(1);
  expect(projects([])).toEqual([]);
});

test("RPC rejects malformed snapshots", () => {
  expect(Snapshot.safeParse({ host: "localhost", samples: [] }).success).toBe(
    false,
  );
});
