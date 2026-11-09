import { statfs } from "node:fs/promises";

// Filesystem capacity, not project size or disk I/O. Unavailable mounts must
// not prevent CPU, memory, and session measurements from being returned.
export async function diskUsage(path: string) {
  try {
    const stats = await statfs(path);
    return {
      path,
      total: stats.blocks * stats.bsize,
      used: (stats.blocks - stats.bfree) * stats.bsize,
      available: stats.bavail * stats.bsize,
    };
  } catch {
    return null;
  }
}
