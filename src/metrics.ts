import { cpus, freemem, totalmem } from "node:os";
import type { Sample } from "./rpc";

export function cpuPercent(
  previous: { busy: number; total: number },
  current: { busy: number; total: number },
) {
  const elapsed = current.total - previous.total;
  return elapsed > 0
    ? Math.max(
        0,
        Math.min(100, ((current.busy - previous.busy) / elapsed) * 100),
      )
    : 0;
}

export function machineTimes() {
  return cpus().reduce(
    (sum, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      return {
        total: sum.total + total,
        busy: sum.busy + total - cpu.times.idle,
      };
    },
    { total: 0, busy: 0 },
  );
}

export function createSampler(capacity = 1800) {
  const samples: Sample[] = [];
  let previous = {
    time: performance.now(),
    cpu: process.cpuUsage(),
    machine: machineTimes(),
  };
  return {
    samples,
    sample(memoryUsed?: number) {
      const now = {
        time: performance.now(),
        cpu: process.cpuUsage(),
        machine: machineTimes(),
      };
      const memory = process.memoryUsage();
      const elapsed = (now.time - previous.time) * 1000;
      const sample: Sample = {
        time: Date.now(),
        // One fully occupied CPU core is 100%; multi-core process usage can exceed it.
        cpu:
          elapsed > 0
            ? Math.max(
                0,
                ((now.cpu.user +
                  now.cpu.system -
                  previous.cpu.user -
                  previous.cpu.system) /
                  elapsed) *
                  100,
              )
            : 0,
        machineCpu: cpuPercent(previous.machine, now.machine),
        rss: memory.rss,
        heap: memory.heapUsed,
        heapTotal: memory.heapTotal,
        machineUsed: memoryUsed ?? totalmem() - freemem(),
        machineTotal: totalmem(),
      };
      previous = now;
      samples.push(sample);
      if (samples.length > capacity)
        samples.splice(0, samples.length - capacity);
      return sample;
    },
  };
}
