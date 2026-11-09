import { Rpc } from "@opencode/plugin/rpc";
import { z } from "zod";

export const Sample = z.object({
  time: z.number(),
  cpu: z.number(),
  machineCpu: z.number(),
  rss: z.number(),
  heap: z.number(),
  heapTotal: z.number(),
  machineUsed: z.number(),
  machineTotal: z.number(),
});
export const Session = z.object({
  id: z.string(),
  projectID: z.string(),
  directory: z.string(),
  title: z.string(),
  parentID: z.string().optional(),
  status: z.enum(["running", "waiting", "idle", "unknown"]),
  cost: z.number(),
  tokens: z.number(),
  model: z.string().optional(),
});
export const Snapshot = z.object({
  host: z.string(),
  platform: z.string(),
  version: z.string(),
  pid: z.number(),
  cores: z.number(),
  uptime: z.number(),
  started: z.number(),
  sessionsUpdated: z.number(),
  samples: z.array(Sample),
  sessions: z.array(Session),
});
export type Sample = z.infer<typeof Sample>;
export type Session = z.infer<typeof Session>;
export type Snapshot = z.infer<typeof Snapshot>;

export const Stats = Rpc.define({
  id: "opencode-stats",
  methods: { snapshot: { input: z.object({}), output: Snapshot } },
  events: {},
});
