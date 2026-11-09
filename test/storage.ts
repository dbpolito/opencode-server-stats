import type { Schema } from "effect";

export function memoryStorage() {
  const values = new Map<string, Schema.Json>();
  let writes = 0;
  return {
    values,
    get writes() { return writes; },
    async get(key: string) { return structuredClone(values.get(key)); },
    async set(key: string, value: Schema.Json) { writes++; values.set(key, structuredClone(value)); },
    async remove(key: string) { values.delete(key); },
    async scan(input: { prefix: string; after?: string; limit: number }) {
      const keys = [...values.keys()].filter((key) => key.startsWith(input.prefix) && (!input.after || key > input.after)).sort();
      const page = keys.slice(0, input.limit);
      return { entries: page.map((key) => ({ key })), ...(keys.length > page.length ? { next: page.at(-1)! } : {}) };
    },
  };
}
