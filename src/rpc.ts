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
  status: z.enum(["running", "waiting"]),
});
export const Snapshot = z.object({
  host: z.string(),
  platform: z.string(),
  version: z.string(),
  pid: z.number(),
  cores: z.number(),
  uptime: z.number(),
  started: z.number(),
  retentionDays: z.number(),
  historyError: z.string().nullable(),
  latest: Sample.nullable(),
  samples: z.array(Sample),
  disk: z.object({
    path: z.string(),
    total: z.number(),
    used: z.number(),
    available: z.number(),
  }).nullable(),
  memory: z.object({
    total: z.number(),
    used: z.number(),
    cached: z.number(),
    swapUsed: z.number(),
    swapTotal: z.number(),
  }).nullable(),
});
export type Sample = z.infer<typeof Sample>;
export type Session = z.infer<typeof Session>;
export type Snapshot = z.infer<typeof Snapshot>;

export const Stats = Rpc.define({
  id: "opencode-server-stats",
  methods: {
    snapshot: { input: z.object({ minutes: z.number().int().min(1).max(43200).optional() }), output: Snapshot },
    resources: { input: z.object({}), output: Sample.nullable() },
    historySettings: { input: z.object({}), output: z.object({ retentionDays: z.number() }) },
    configureHistory: { input: z.object({ retentionDays: z.number().int().min(1).max(30) }), output: z.object({ retentionDays: z.number() }) },
  },
  events: {},
});
