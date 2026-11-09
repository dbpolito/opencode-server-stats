import { z } from "zod";
import type { Schema } from "effect";
import { Sample, type Sample as Point } from "./rpc";

type Storage = {
  get(key: string): Promise<unknown>;
  set(key: string, value: Schema.Json): Promise<void>;
  remove(key: string): Promise<void>;
  scan(input: { prefix: string; after?: string; limit: number }): Promise<{
    entries: readonly { key: string }[];
    next?: string;
  }>;
};
const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
const prefix = "history/v1/hour/";
const Summary = z.object({ average: Sample, peak: Sample, count: z.number().int().positive() });
type Summary = z.infer<typeof Summary>;
const fields = ["cpu", "machineCpu", "rss", "heap", "heapTotal", "machineUsed", "machineTotal"] as const;

function merge(a: Summary, b: Summary): Summary {
  const count = a.count + b.count;
  const average = { ...a.average };
  const peak = { ...a.peak };
  for (const key of fields) {
    average[key] = (a.average[key] * a.count + b.average[key] * b.count) / count;
    peak[key] = Math.max(a.peak[key], b.peak[key]);
  }
  return { average, peak, count };
}

export class History {
  retentionDays = 7;
  private bucket?: Summary;
  private chunks = new Map<string, Summary[]>();
  private lastPrune = 0;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private storage: Storage) {}

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(work);
    this.tail = next.catch(() => {});
    return next;
  }

  init(now = Date.now()) {
    return this.serialize(async () => {
      const settings = await this.storage.get("history/v1/settings");
      const parsed = z.object({ retentionDays: z.number().int().min(1).max(30) }).safeParse(settings);
      this.retentionDays = parsed.success ? parsed.data.retentionDays : 7;
      await this.prune(now);
    });
  }

  private async chunk(key: string) {
    const cached = this.chunks.get(key);
    if (cached) return cached;
    const stored = await this.storage.get(key);
    const parsed = z.array(Summary).safeParse(stored);
    if (stored !== undefined && !parsed.success) throw new Error("Invalid saved history chunk");
    const result = parsed.success ? parsed.data : [];
    this.chunks.set(key, result);
    return result;
  }

  private async save() {
    const bucket = this.bucket;
    if (!bucket) return;
    const key = prefix + Math.floor(bucket.average.time / hour) * hour;
    const chunk = [...await this.chunk(key)];
    const index = chunk.findIndex((item) => item.average.time === bucket.average.time);
    if (index < 0) chunk.push(bucket);
    else chunk[index] = merge(chunk[index], bucket);
    await this.storage.set(key, chunk);
    this.chunks.set(key, chunk);
    this.bucket = undefined;
  }

  record(sample: Point) {
    return this.serialize(async () => {
      const time = Math.floor(sample.time / minute) * minute;
      if (this.bucket && this.bucket.average.time !== time) await this.save();
      const point = { ...sample, time };
      const next = { average: point, peak: point, count: 1 };
      this.bucket = this.bucket ? merge(this.bucket, next) : next;
      if (sample.time - this.lastPrune >= hour) await this.prune(sample.time);
    });
  }

  flush() {
    return this.serialize(() => this.save());
  }

  configure(retentionDays: number, now = Date.now()) {
    return this.serialize(async () => {
      if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 30) throw new Error("Retention must be 1–30 days");
      await this.storage.set("history/v1/settings", { retentionDays });
      this.retentionDays = retentionDays;
      await this.prune(now);
      return { retentionDays };
    });
  }

  private async prune(now: number) {
    const cutoff = now - this.retentionDays * day;
    let after: string | undefined;
    do {
      const page = await this.storage.scan({ prefix, limit: 100, ...(after ? { after } : {}) });
      for (const { key } of page.entries) {
        if (Number(key.slice(prefix.length)) + hour > cutoff) continue;
        await this.storage.remove(key);
        this.chunks.delete(key);
      }
      after = page.next;
    } while (after);
    this.lastPrune = now;
  }

  read(from: number, to = Date.now()) {
    return this.serialize(async () => {
      const start = Math.max(from, to - this.retentionDays * day);
      const result: Point[] = [];
      for (let time = Math.floor(start / hour) * hour; time <= to; time += hour) {
        const chunk = await this.chunk(prefix + time);
        result.push(...chunk.filter((item) => item.average.time >= start && item.average.time <= to).map((item) => item.average));
      }
      return result.sort((a, b) => a.time - b.time);
    });
  }
}

// Bound chart payloads without discarding averages over long ranges.
export function compact(samples: Point[], limit = 1800): Point[] {
  if (samples.length <= limit) return samples;
  const size = Math.ceil(samples.length / limit);
  const result: Point[] = [];
  for (let i = 0; i < samples.length; i += size) {
    const group = samples.slice(i, i + size);
    const average = { ...group[0] };
    for (const key of fields) average[key] = group.reduce((sum, item) => sum + item[key], 0) / group.length;
    result.push(average);
  }
  return result;
}
