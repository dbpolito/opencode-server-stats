import { cpus, hostname } from "node:os";
import { Plugin } from "@opencode/plugin";
import { createSampler } from "./metrics";
import { Stats, type Session } from "./rpc";

// Plugin instances are location-scoped, but process measurements must not be.
let sampler = createSampler();
let owners = 0;
let timer: ReturnType<typeof setInterval> | undefined;

export default Plugin.define({
  id: "opencode-stats",
  async setup(ctx) {
    if (owners++ === 0) {
      sampler = createSampler();
      timer = setInterval(() => sampler.sample(), 2000);
      timer.unref();
    }

    let cache: { updated: number; sessions: Session[] } | undefined;
    let loading: Promise<Session[]> | undefined;
    const sessions = async () => {
      if (cache && Date.now() - cache.updated < 10_000) return cache.sessions;
      if (loading) return loading;
      loading = (async () => {
        const result: Session[] = [];
        let page = await ctx.session.list({ limit: 100, archived: false });
        while (true) {
          result.push(
            ...page.data.map((session): Session => ({
              id: session.id,
              projectID: session.projectID,
              directory: session.location.directory,
              title: session.title ?? "Untitled session",
              parentID: session.parentID,
              status: "unknown",
              cost: session.cost,
              tokens:
                session.tokens.input +
                session.tokens.output +
                session.tokens.reasoning +
                session.tokens.cache.read +
                session.tokens.cache.write,
              model: session.model
                ? `${session.model.providerID}/${session.model.id}`
                : undefined,
            })),
          );
          if (!page.cursor.next) break;
          page = await ctx.session.list({
            cursor: page.cursor.next,
            limit: 100,
          });
        }
        cache = { updated: Date.now(), sessions: result };
        return result;
      })().finally(() => {
        loading = undefined;
      });
      return loading;
    };

    await ctx.rpc.register(Stats, {
      snapshot: async () => ({
        host: hostname(),
        platform: process.platform,
        version: ctx.app.version,
        pid: process.pid,
        cores: cpus().length,
        uptime: process.uptime(),
        started: Date.now() - process.uptime() * 1000,
        sessions: await sessions(),
        sessionsUpdated: cache!.updated,
        samples: [...sampler.samples],
      }),
    });
    return () => {
      if (--owners !== 0) return;
      clearInterval(timer);
      sampler.samples.length = 0;
    };
  },
});
