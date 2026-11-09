# opencode-stats

Live server resources and project activity in OpenCode Desktop. Requires **OpenCode Desktop 2.2.0+**; the GUI API is experimental.

## Features

- Server CPU, resident memory, JS heap, machine CPU and memory.
- Lightweight SVG graphs with 5-minute, 15-minute and 1-hour windows.
- Server selector, hostname, OS, version, PID, CPU count and uptime.
- Running and waiting-for-input session counts, grouped by project (including worktrees and subagents).
- Expand projects to inspect sessions, models, cumulative tokens and estimated USD cost. Click a session to open it.
- No external telemetry, prompts, message contents, database access or subprocess monitoring.

## Develop and load locally

```sh
bun install
bun run check
bun run dev
```

Add the directory to `plugins` in your global OpenCode configuration, keeping existing entries:

```jsonc
{
  "plugins": ["/home/dbpolito/Projects/dbpolito/opencode-stats"],
}
```

Open a session, then select **Server stats** in the side panel's **+** menu, **Stats: Open server dashboard** in the command palette, or `/stats`. Drag its tab below the conversation for a wider view. GUI rebuilds reload automatically.

The selected server must also load the server part of this plugin. Local Desktop's global configuration loads both parts; remote servers need their own installation. Selecting an unsupported server shows an error with a retry action.

## Measurement semantics

- **Server CPU:** the process hosting the plugin, with one occupied CPU core equal to 100%. May exceed 100% on multicore workloads. Does not include subprocesses or Desktop.
- **Machine CPU:** all processes, normalized across all logical cores.
- **Memory:** RSS and JS heap are process measurements. Machine used memory is total minus free and includes OS caches; it is not memory pressure.
- **Sessions:** unarchived inventory is fetched with cursor pagination, cached for 10 seconds. Live execution status is fetched separately; waiting sessions have pending permission requests or forms. Newly created sessions can take up to 10 seconds to appear. Archived sessions are excluded.
- **Projects:** grouped by project ID, not directory, so worktrees stay together. The shortest observed workspace directory supplies the display label, which may differ from the canonical root.
- **Usage:** cumulative counters of listed sessions, including subagents once each. Not a date-range usage report. Cost is OpenCode's recorded estimate, not a provider invoice. Token totals include input, output, reasoning, cache reads and cache writes as reported by OpenCode.
- **Graphs:** sampled every two seconds, shared across location instances in the server process; at most 1,800 samples. History starts when the plugin loads and resets when the plugin unloads or the server restarts. Session activity history is not yet collected.
- The GUI refreshes every two seconds while visible and avoids overlapping refreshes. Resource collection continues while the server plugin is loaded. Disconnected views retain their last snapshot, marked disconnected.

## Scope

This first version is read-only. No per-project CPU estimates, alerts, persistent history, disk/process-tree metrics, or TUI entry yet. Nothing is installed into your configuration by the development commands.

## Checks

`bun run check` runs TypeScript checking, Bun tests against real OS/process measurements and grouping logic, and the production GUI build.

MIT licensed.
