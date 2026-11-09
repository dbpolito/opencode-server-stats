import { expect, test } from "bun:test";
import { bytes, cores } from "../src/format";

test("formats process CPU as occupied cores", () => {
  expect(cores(0)).toBe("0.00 cores");
  expect(cores(25)).toBe("0.25 cores");
  expect(cores(100)).toBe("1.00 cores");
  expect(cores(250)).toBe("2.50 cores");
});

test("formats resident memory in MB or GB", () => {
  expect(bytes(512 * 1024 ** 2)).toBe("512 MB");
  expect(bytes(1.25 * 1024 ** 3)).toBe("1.25 GB");
});
