import { expect, test } from "bun:test";
import { diskUsage } from "../src/disk";

test("reads real filesystem capacity", async () => {
  const disk = await diskUsage(process.cwd());
  expect(disk).not.toBeNull();
  expect(disk!.path).toBe(process.cwd());
  expect(disk!.total).toBeGreaterThan(0);
  expect(disk!.used).toBeGreaterThanOrEqual(0);
  expect(disk!.available).toBeGreaterThanOrEqual(0);
  expect(disk!.used).toBeLessThanOrEqual(disk!.total);
  expect(disk!.available).toBeLessThanOrEqual(disk!.total);
});

test("unavailable filesystem returns null", async () => {
  expect(await diskUsage("\0")).toBeNull();
});
