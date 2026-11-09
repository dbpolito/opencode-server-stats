import { expect, test } from "bun:test";
import plugin from "../src/index";
import { Snapshot } from "../src/rpc";
import { memoryStorage } from "./storage";

test("resource snapshot contains only JSON values and never lists sessions", async () => {
  let snapshot: ((input: {}) => Promise<unknown>) | undefined;
  const ctx = {
    storage: memoryStorage(),
    location: { directory: process.cwd() },
    app: { version: "2.2.0" },
    session: {
      list: async () => { throw new Error("Must not list session inventory"); },
    },
    rpc: {
      register: async (_contract: unknown, methods: { snapshot: (input: {}) => Promise<unknown> }) => {
        snapshot = methods.snapshot;
      },
    },
  } as unknown as Parameters<typeof plugin.setup>[0];
  const cleanup = await plugin.setup(ctx);
  try {
    const result = await snapshot!({});
    expect(Snapshot.safeParse(result).success).toBe(true);
    // JSON.stringify silently drops undefined; the RPC transport rejects it.
    expect(result).toStrictEqual(JSON.parse(JSON.stringify(result)));
  } finally {
    if (typeof cleanup === "function") await cleanup();
  }
});
