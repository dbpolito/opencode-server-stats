import { expect, test } from "bun:test";
import { linuxMemory, macMemory, systemMemory } from "../src/memory";

test("Linux uses available RAM and reports cache and swap", () => {
  expect(linuxMemory(`MemTotal: 1000 kB
MemAvailable: 400 kB
Cached: 200 kB
SReclaimable: 50 kB
SwapTotal: 500 kB
SwapFree: 300 kB`)).toEqual({
    total: 1000 * 1024,
    used: 600 * 1024,
    cached: 250 * 1024,
    swapUsed: 200 * 1024,
    swapTotal: 500 * 1024,
  });
});

test("macOS separates cache from anonymous, wired and compressed memory", () => {
  expect(macMemory(`Mach Virtual Memory Statistics: (page size of 16384 bytes)
Anonymous pages: 100.
Pages purgeable: 10.
Pages wired down: 20.
Pages occupied by compressor: 30.
File-backed pages: 40.`, "total = 1024.00M used = 45.12M free = 978.88M", 1000 * 16384)).toEqual({
    total: 1000 * 16384,
    used: 140 * 16384,
    cached: 50 * 16384,
    swapUsed: 45.12 * 1024 ** 2,
    swapTotal: 1024 ** 3,
  });
});

test("native memory collection returns valid values or unavailable", async () => {
  const memory = await systemMemory();
  if (!memory) return;
  expect(memory.total).toBeGreaterThan(0);
  expect(memory.used).toBeLessThanOrEqual(memory.total);
  expect(Object.values(memory).every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
});
