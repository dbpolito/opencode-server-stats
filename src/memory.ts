import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { totalmem } from "node:os";
import { promisify } from "node:util";

const exec = promisify(execFile);
export type Memory = {
  total: number;
  used: number;
  cached: number;
  swapUsed: number;
  swapTotal: number;
};

export function linuxMemory(text: string): Memory {
  const values = Object.fromEntries(
    [...text.matchAll(/^(\w+):\s+(\d+) kB/gm)].map((match) => [match[1], Number(match[2]) * 1024]),
  );
  return {
    total: values.MemTotal,
    used: values.MemTotal - values.MemAvailable,
    cached: values.Cached + (values.SReclaimable ?? 0),
    swapUsed: values.SwapTotal - values.SwapFree,
    swapTotal: values.SwapTotal,
  };
}

export function macMemory(text: string, swap: string, total: number): Memory {
  const pageSize = Number(text.match(/page size of (\d+) bytes/)?.[1]);
  const pages = (name: string) => {
    const value = text.match(new RegExp(`^${name}:\\s+(\\d+)\\.`, "m"));
    return value ? Number(value[1]) * pageSize : NaN;
  };
  const swapBytes = (name: string) => {
    const match = swap.match(new RegExp(`${name} = ([\\d.]+)([KMG])`));
    return match ? Number(match[1]) * 1024 ** ({ K: 1, M: 2, G: 3 }[match[2]] ?? 0) : NaN;
  };
  return {
    total,
    used: pages("Anonymous pages") - pages("Pages purgeable") + pages("Pages wired down") + pages("Pages occupied by compressor"),
    cached: pages("File-backed pages") + pages("Pages purgeable"),
    swapUsed: swapBytes("used"),
    swapTotal: swapBytes("total"),
  };
}

export async function systemMemory(): Promise<Memory | null> {
  try {
    let result: Memory;
    if (process.platform === "linux") {
      result = linuxMemory(await readFile("/proc/meminfo", "utf8"));
    } else if (process.platform === "darwin") {
      const [vm, swap] = await Promise.all([
        exec("/usr/bin/vm_stat", [], { timeout: 1500 }),
        exec("/usr/sbin/sysctl", ["vm.swapusage"], { timeout: 1500 }),
      ]);
      result = macMemory(vm.stdout, swap.stdout, totalmem());
    } else if (process.platform === "win32") {
      const { stdout } = await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        "$m = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory; $p = Get-CimInstance Win32_PageFileUsage; @{ available = [double]$m.AvailableBytes; cached = [double]$m.CacheBytes; swapUsed = [double](($p | Measure-Object CurrentUsage -Sum).Sum) * 1MB; swapTotal = [double](($p | Measure-Object AllocatedBaseSize -Sum).Sum) * 1MB } | ConvertTo-Json -Compress",
      ], { timeout: 5000 });
      const memory = JSON.parse(stdout);
      result = { total: totalmem(), used: totalmem() - memory.available, cached: memory.cached, swapUsed: memory.swapUsed, swapTotal: memory.swapTotal };
    } else return null;
    return Object.values(result).every((value) => Number.isFinite(value) && value >= 0)
      ? result : null;
  } catch {
    return null;
  }
}
