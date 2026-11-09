import { createEffect, createSignal, onCleanup } from "solid-js";
import { usePlugin, type MountedSession } from "@opencode/plugin/gui";
import { Stats, type Sample } from "./rpc";
import { refreshInterval, type StatsSettings } from "./settings";

export function StatsShortcut(props: { session: MountedSession; active: boolean; settings: StatsSettings }) {
  const ctx = usePlugin();
  const ui = ctx.ui;
  const [sample, setSample] = createSignal<Sample | null>(null);
  const [offline, setOffline] = createSignal(false);

  createEffect(() => {
    props.session.server.id;
    setSample(null);
    setOffline(false);
  });

  createEffect(() => {
    const server = props.session.server.id;
    const active = props.active;
    const live = props.settings.value?.live ?? true;
    const interval = refreshInterval(props.settings);
    if (!active) return;
    let disposed = false;
    let pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const connection = ctx.servers.get(server);
        if (!connection) throw new Error("Server unavailable");
        const latest = await connection.client.rpc(Stats).resources({});
        if (!disposed) {
          setSample(latest);
          setOffline(false);
        }
      } catch {
        if (!disposed) {
          setSample(null);
          setOffline(true);
        }
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = live ? setInterval(refresh, interval * 1000) : undefined;
    onCleanup(() => {
      disposed = true;
      clearInterval(timer);
    });
  });

  const cpu = () => sample() ? `${sample()!.machineCpu.toFixed(0)}%` : "—";
  const memory = () => {
    const latest = sample();
    return latest && latest.machineTotal > 0
      ? `${((latest.machineUsed / latest.machineTotal) * 100).toFixed(0)}%`
      : "—";
  };
  const label = () => offline()
    ? "Server Stats unavailable · Open Server Stats"
    : `Server CPU ${cpu()} · Server Memory ${memory()} · Open Server Stats`;

  return (
    <span class="oc-stats-shortcut">
      <ui.Tooltip value={label()}>
        <ui.Button
          size="small"
          variant="ghost-muted"
          aria-label={label()}
          onClick={() => ctx.layout.open(`${ctx.id}:dashboard`, props.session, { tab: "select" })}
        >
          <span class="oc-stats-shortcut-value">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
              <rect x="4" y="4" width="8" height="8" rx="1.5" />
              <rect x="6" y="6" width="4" height="4" rx=".5" />
              <path d="M6 1v3m4-3v3M6 12v3m4-3v3M1 6h3m-3 4h3m8-4h3m-3 4h3" />
            </svg>
            {cpu()}
          </span>
          <span class="oc-stats-shortcut-divider" aria-hidden="true" />
          <span class="oc-stats-shortcut-value">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
              <rect x="1.5" y="4" width="13" height="7" rx="1" />
              <path d="M4 11v2m3-2v2m3-2v2m3-2v2M4 6v3m4-3v3m4-3v3" />
            </svg>
            {memory()}
          </span>
        </ui.Button>
      </ui.Tooltip>
    </span>
  );
}
