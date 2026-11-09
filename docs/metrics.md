# Measurements and history

## CPU

OpenCode CPU measures the server process hosting the plugin. One fully occupied logical core is `1.00 cores`. It excludes subprocesses and Desktop.

Server CPU measures the whole host, normalized across all logical cores from 0 to 100%. The dashboard also shows used/total cores.

## Memory

OpenCode Memory is resident process memory (RSS). The sampler also collects JavaScript heap usage and heap capacity.

Server Memory shows used/total RAM, cached memory and swap used/total. The OS counters differ:

- macOS used RAM is anonymous pages minus purgeable pages, plus wired and compressed physical pages. Cached memory is file-backed plus purgeable pages.
- Linux used RAM is total minus available. Cached memory includes reclaimable slab.
- Windows used RAM is total minus available. Cached memory comes from the system cache counter.

These values are not memory pressure. If native counters fail, RAM falls back to total minus free, which includes caches. Cache and swap are then marked unavailable.

Linux reads `/proc/meminfo`. macOS runs the read-only `vm_stat` and `sysctl` commands. Windows uses PowerShell CIM. Linux and Windows collectors still need live testing.

## Disk

Disk space describes the filesystem containing the server plugin's location. It refreshes with each dashboard snapshot.

Used space is total minus free; available space excludes reserved blocks. Used plus available can therefore be less than total. This is not project size, disk I/O or a sum of all drives. A failed disk measurement does not block the other metrics.

## Sessions and projects

The dashboard fetches active execution IDs, then checks their metadata and pending permissions/forms. A session waiting for permission or an answer counts as waiting rather than running. Counts include subagents; idle projects are omitted.

Projects are grouped by project ID so worktrees stay together. The shortest observed workspace directory supplies the label, which may differ from the canonical project root.

There is no full session inventory fetch, process list, model list, token report or cost report.

## History

The server samples resources every two seconds. Location instances in the same process share a sampler, with up to 1,800 raw samples (about one hour) in RAM.

Each completed minute is saved as an average and peak in an hourly JSON chunk through OpenCode's plugin storage API. This usually means one write per minute. A clean unload also saves the partial minute; a crash can lose that minute.

Saved CPU and process/host RAM history survives plugin reloads and server restarts. It accumulates only while the plugin is loaded, so downtime leaves gaps. Cache, swap, disk and session activity are not saved as history.

Graphs combine saved minute averages with recent raw samples, capped at 1,800 chart points. Peaks are saved but are not drawn separately. Current card values always use the latest raw sample.

## Retention

Retention defaults to 7 days. In **Settings > Server Stats**, select a server and choose 1, 7, 14 or 30 days. This preference is saved on that server.

Expired hourly chunks are removed at startup, hourly during collection and when retention changes. Physical deletion can lag the cutoff by one chunk plus the cleanup interval; reads exclude expired samples immediately. Shortening retention permanently removes older chunks.

Storage failures show a warning while live metrics continue to work. The plugin writes only its own settings and resource history through supported APIs; it does not access OpenCode's database directly.

## Refresh behavior

Live updates and the refresh interval are saved Desktop preferences shared by the dashboard and header. Available intervals are 2, 5, 10, 30 and 60 seconds. Automatic refreshes run while the view is visible and avoid overlapping requests.

Show header stats is on by default. Turning it off hides the top-right CPU/memory readings and stops their refresh requests. The dashboard remains available through `/server-stats` and the side panel's **+** menu.

Turning live updates off pauses the display. The dashboard then offers manual Refresh. Server sampling and history recording continue every two seconds while the plugin is loaded.

## Limits

There are no per-project CPU estimates, alerts, disk I/O measurements, process-tree metrics or TUI view yet. No data is sent to an external telemetry service.
