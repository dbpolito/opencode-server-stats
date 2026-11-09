import { cpus, hostname } from "node:os";
import { Plugin } from "@opencode/plugin";
import { createSampler } from "./metrics";
import { diskUsage } from "./disk";
import { systemMemory, type Memory } from "./memory";
import { Stats } from "./rpc";
import { History, compact } from "./history";

// Plugin instances are location-scoped, but process measurements must not be.
let sampler = createSampler();
let owners = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let memory: Memory | null = null;
let history: History;
let historyError: string | null = null;

export default Plugin.define({
  id: "opencode-server-stats",
  async setup(ctx) {
    if (owners++ === 0) {
      sampler = createSampler();
      const current = sampler;
      memory = null;
      history = new History(ctx.storage);
      historyError = null;
      try {
        await history.init();
      } catch (error) {
        historyError = String(error);
      }
      let pending = false;
      const collect = async () => {
        if (pending) return;
        pending = true;
        try {
          const measured = await systemMemory();
          if (!owners || sampler !== current) return;
          memory = measured;
          sampler.sample(memory?.used);
          try {
            await history.record(sampler.samples.at(-1)!);
            historyError = null;
          } catch (error) {
            historyError = String(error);
          }
        } finally {
          pending = false;
        }
      };
      timer = setInterval(collect, 2000);
      timer.unref();
    }

    await ctx.rpc.register(Stats, {
      resources: async () => sampler.samples.at(-1) ?? null,
      historySettings: async () => ({ retentionDays: history.retentionDays }),
      configureHistory: async ({ retentionDays }) => history.configure(retentionDays),
      snapshot: async ({ minutes = 60 }) => {
        const now = Date.now();
        const from = now - minutes * 60_000;
        const recent = sampler.samples.filter((point) => point.time >= from);
        let saved: typeof recent = [];
        try {
          saved = await history.read(from, now);
        } catch (error) {
          historyError = String(error);
        }
        return {
          host: hostname(),
          platform: process.platform,
          version: ctx.app.version,
          pid: process.pid,
          cores: cpus().length,
          uptime: process.uptime(),
          started: Date.now() - process.uptime() * 1000,
          retentionDays: history.retentionDays,
          historyError,
          latest: sampler.samples.at(-1) ?? null,
          samples: compact([
            ...saved.filter((point) => point.time + 60_000 <= (recent[0]?.time ?? now)),
            ...recent,
          ]),
          disk: await diskUsage(ctx.location.directory),
          memory,
        };
      },
    });
    return async () => {
      if (--owners !== 0) return;
      clearInterval(timer);
      const closingHistory = history;
      const closingSampler = sampler;
      try {
        await closingHistory.flush();
      } catch (error) {
        console.error("Server Stats: could not save history", error);
      }
      closingSampler.samples.length = 0;
    };
  },
});
