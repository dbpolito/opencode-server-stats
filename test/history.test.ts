import { expect, test } from "bun:test";
import { History, compact } from "../src/history";
import type { Sample } from "../src/rpc";
import { memoryStorage } from "./storage";

const minute = 60_000;
const hour = 60 * minute;
const now = Math.floor(1_800_000_000_000 / hour) * hour;
function sample(time: number, cpu = 10): Sample {
  return { time, cpu, machineCpu: cpu, rss: 100, heap: 50, heapTotal: 100, machineUsed: 500, machineTotal: 1000 };
}

test("writes minute averages and peaks once per minute in hourly chunks", async () => {
  const storage = memoryStorage();
  const history = new History(storage);
  await history.init(now);
  expect(history.retentionDays).toBe(7);
  await history.record(sample(now, 10));
  await history.record(sample(now + 2000, 30));
  expect(storage.writes).toBe(0);
  await history.record(sample(now + minute, 50));
  expect(storage.writes).toBe(1);
  expect((await history.read(now, now + minute))[0].cpu).toBe(20);
  const chunk = [...storage.values.values()][0] as unknown as { peak: Sample; count: number }[];
  expect(chunk[0].peak.cpu).toBe(30);
  expect(chunk[0].count).toBe(2);
  await history.flush();
  await history.flush();
  expect(storage.writes).toBe(2);
});

test("survives reload and merges partial minutes without duplicates", async () => {
  const storage = memoryStorage();
  const first = new History(storage);
  await first.init(now);
  await first.record(sample(now, 10));
  await first.flush();
  const second = new History(storage);
  await second.init(now);
  await second.record(sample(now + 2000, 30));
  await second.flush();
  expect(await second.read(now, now + minute)).toEqual([sample(now, 20)]);
});

test("retention is persisted, prunes expired hourly chunks, and limits reads", async () => {
  const storage = memoryStorage();
  const history = new History(storage);
  await history.init(now);
  await history.record(sample(now));
  await history.flush();
  await history.record(sample(now + 2 * 24 * hour));
  await history.flush();
  await history.configure(1, now + 2 * 24 * hour);
  const next = new History(storage);
  await next.init(now + 2 * 24 * hour);
  expect(next.retentionDays).toBe(1);
  expect((await next.read(now, now + 2 * 24 * hour)).length).toBe(1);
  expect([...storage.values.keys()].filter((key) => key.startsWith("history/v1/hour/"))).toHaveLength(1);
  await expect(next.configure(0)).rejects.toThrow();
});

test("compacts long chart payloads while retaining averages", () => {
  const input = Array.from({ length: 10080 }, (_, index) => sample(now + index * minute, 20));
  const result = compact(input);
  expect(result.length).toBeLessThanOrEqual(1800);
  expect(result.every((point) => point.cpu === 20)).toBe(true);
});

test("concurrent samples are serialized and failed writes can be retried", async () => {
  const storage = memoryStorage();
  let fail = true;
  const history = new History({
    ...storage,
    async set(key, value) {
      if (fail) throw new Error("Storage unavailable");
      await storage.set(key, value);
    },
  });
  await history.init(now);
  await Promise.all([history.record(sample(now, 10)), history.record(sample(now + 2000, 30))]);
  await expect(history.flush()).rejects.toThrow("Storage unavailable");
  fail = false;
  await history.flush();
  expect((await history.read(now, now + minute))[0].cpu).toBe(20);
});

test("retention cleanup handles paginated storage scans", async () => {
  const storage = memoryStorage();
  for (let index = 0; index < 105; index++) {
    await storage.set(`history/v1/hour/${now + index * hour}`, []);
  }
  const history = new History(storage);
  await history.init(now);
  await history.configure(1, now + 200 * hour);
  expect([...storage.values.keys()].filter((key) => key.startsWith("history/v1/hour/"))).toHaveLength(0);
});
