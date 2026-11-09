import {
  createMemo,
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { usePlugin, type MountedSession } from "@opencode/plugin/gui";
import { Stats, type Sample, type Session } from "./rpc";
import { projects } from "./projects";
import { bytes, cores } from "./format";
import { refreshInterval, type StatsSettings } from "./settings";
import { version } from "../package.json";


export function Dashboard(props: {
  ctx: ReturnType<typeof usePlugin>;
  session: MountedSession;
  settings: StatsSettings;
}) {
  const ui = props.ctx.ui;
  const [selected, setSelected] = createSignal<string>();
  const [window, setWindow] = createSignal(5);
  const [tick, setTick] = createSignal(0);
  const [error, setError] = createSignal<Error>();
  const server = () => selected() ?? props.session.server.id;
  const live = () => props.settings.value?.live ?? true;
  const interval = () => refreshInterval(props.settings);
  createEffect(() => {
    if (!live()) return;
    const timer = setInterval(() => {
    if (
      !snapshot.loading &&
      !document.hidden &&
      props.ctx.layout.state(`${props.ctx.id}:dashboard`, props.session) ===
        "visible"
    )
      setTick((n) => n + 1);
    }, interval() * 1000);
    onCleanup(() => clearInterval(timer));
  });
  const [snapshot] = createResource(
    () => ({ server: server(), tick: tick(), minutes: window() }),
    async (source) => {
      try {
        const connection = props.ctx.servers.get(source.server);
        if (!connection) throw new Error("Server is unavailable");
        const [snapshot, active] = await Promise.all([
          connection.client.rpc(Stats).snapshot({ minutes: source.minutes }),
          connection.client.session.active(),
        ]);
        const sessions = (
          await Promise.all(
            Object.keys(active).map(async (id) => {
              try {
                const [session, permissions, forms] = await Promise.all([
                  connection.client.session.get({ sessionID: id }),
                  connection.client.permission.list({ sessionID: id }),
                  connection.client.session.form.list({ sessionID: id }),
                ]);
                return {
                  id,
                  projectID: session.projectID,
                  directory: session.location.directory,
                  status: permissions.length || forms.length ? "waiting" : "running",
                } satisfies Session;
              } catch {
                // Sessions can finish or be removed while refreshing.
                return undefined;
              }
            }),
          )
        ).filter((session): session is Session => session !== undefined);
        setError(undefined);
        return {
          server: source.server,
          data: {
            ...snapshot,
            sessions,
          },
        };
      } catch (cause) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        // Keep errors out of Solid's resource error boundary so the panel can
        // display the failure and retry rather than disappearing entirely.
        return undefined;
      }
    },
  );
  const data = () =>
    snapshot.latest?.server === server() ? snapshot.latest.data : undefined;
  const samples = createMemo(
    () =>
      data()?.samples.filter(
        (sample) => sample.time >= Date.now() - window() * 60_000,
      ) ?? [],
  );
  const latest = () => data()?.latest;
  const grouped = createMemo(() => projects(data()?.sessions ?? []));
  const stale = () => live() && !!latest() && Date.now() - latest()!.time > Math.max(10_000, interval() * 2000);

  return (
    <main class="oc-stats">
      <header class="dashboard-header">
          <div class="title-row">
            <h1>Server Stats</h1>
            <ui.Tooltip value="Server Stats settings">
              <ui.IconButton icon="settings-gear" label="Server Stats settings" variant="ghost"
                onClick={() => props.ctx.layout.settings("stats")} />
            </ui.Tooltip>
          </div>
          <select
            aria-label="Server"
            value={server()}
            onChange={(event) => setSelected(event.currentTarget.value)}
          >
            <For each={props.ctx.servers.list()}>
              {(id) => (
                <option value={id}>
                  {props.ctx.servers.get(id)?.name ?? id}
                </option>
              )}
            </For>
          </select>
        <Show when={data()}>
          {(info) => (
            <div class="server-meta">
              {info().platform} · v{info().version} · {info().cores} cores · uptime{" "}
              {Math.floor(info().uptime / 3600)}h {Math.floor((info().uptime % 3600) / 60)}m
            </div>
          )}
        </Show>
        <div class="ranges" aria-label="Graph time range">
          <For each={[5, 15, 60, 1440, 10080, 20160, 43200].filter((minutes) => minutes <= (data()?.retentionDays ?? 7) * 1440)}>
            {(minutes) => (
              <button
                aria-pressed={window() === minutes}
                onClick={() => setWindow(minutes)}
              >
                {minutes >= 1440 ? `${minutes / 1440}d` : minutes === 60 ? "1h" : `${minutes}m`}
              </button>
            )}
          </For>
        </div>
        <Show when={live()} fallback={
          <button class="live" disabled={snapshot.loading} onClick={() => setTick((n) => n + 1)}>
            {snapshot.loading ? "Refreshing…" : "Refresh"}
          </button>
        }>
          <span class="live" classList={{ offline: !!error() || stale() }}>
            {error() || stale() ? "Disconnected" : snapshot.loading && !data() ? "Connecting" : `Live · ${interval()}s`}
          </span>
        </Show>
      </header>
      <Show when={error()}>
        <div role="alert" class="notice">
          Unable to load stats. Install opencode-server-stats on the selected server.{" "}
          {error()?.message}
          <button onClick={() => setTick((n) => n + 1)}>Retry</button>
        </div>
      </Show>
      <Show when={data()?.historyError}>
        <div role="alert" class="notice">Saved history is unavailable. Live metrics still work. {data()?.historyError}</div>
      </Show>
      <Show
        when={data()}
        fallback={<p class="empty">Waiting for the server’s first snapshot…</p>}
      >
        {(info) => (
          <>
            <section class="cards">
              <Metric
                title="OpenCode CPU"
                value={cores(latest()?.cpu ?? 0)}
                samples={samples()}
                field="cpu"
              />
              <Metric
                title="OpenCode Memory"
                value={bytes(latest()?.rss ?? 0)}
                samples={samples()}
                field="rss"
              />
              <Metric
                title="Server CPU"
                value={`${(latest()?.machineCpu ?? 0).toFixed(1)}%`}
                detail={`${(((latest()?.machineCpu ?? 0) / 100) * info().cores).toFixed(2)} / ${info().cores} cores`}
                samples={samples()}
                field="machineCpu"
                max={100}
              />
              <Metric
                title="Server Memory"
                value={`${latest()?.machineTotal ? (((latest()?.machineUsed ?? 0) / latest()!.machineTotal) * 100).toFixed(1) : "0.0"}%`}
                samples={samples()}
                field="machineUsed"
                detail={`${bytes(latest()?.machineUsed ?? 0)} / ${bytes(latest()?.machineTotal ?? 0)}`}
              />
            </section>
            <Show when={info().memory} fallback={<p class="hint">Cache and swap measurements unavailable.</p>}>
              {(memory) => (
                <div class="memory-breakdown">
                  <span>Memory <b>{bytes(memory().used)} / {bytes(memory().total)}</b></span>
                  <span>Cached <b>{bytes(memory().cached)}</b></span>
                  <span>Swap <b>{bytes(memory().swapUsed)} / {bytes(memory().swapTotal)}</b></span>
                </div>
              )}
            </Show>
            <section class="metric disk">
              <span>Disk space · filesystem containing the server location</span>
              <Show when={info().disk} fallback={<p>Disk measurement unavailable.</p>}>
                {(disk) => (
                  <>
                    <strong>{bytes(disk().available)} available</strong>
                    <small>
                      {bytes(disk().used)} used of {bytes(disk().total)} total
                      {" · "}{disk().path}
                    </small>
                    <meter
                      aria-label="Filesystem space used"
                      min={0}
                      max={disk().total || 1}
                      value={disk().used}
                    />
                  </>
                )}
              </Show>
            </section>
            <section class="activity">
              <div>
                <span class="eyebrow">EXECUTING NOW</span>
                <strong>
                  {
                    info().sessions.filter(
                      (session) => session.status === "running",
                    ).length
                  }
                </strong>
                <span>sessions, including subagents</span>
              </div>
              <div>
                <span class="eyebrow">WAITING FOR INPUT</span>
                <strong>
                  {
                    info().sessions.filter(
                      (session) => session.status === "waiting",
                    ).length
                  }
                </strong>
                <span>permissions and questions</span>
              </div>
            </section>
            <div class="section-title">
              <h2>Projects</h2>
              <span>{grouped().length} active projects</span>
            </div>
            <Show
              when={grouped().length}
              fallback={
                <p class="empty">No active sessions on this server.</p>
              }
            >
              <For each={grouped()}>
                {(project) => (
                  <div class="project active-project">
                      <div class="project-name">
                        <strong>
                          {project.directory
                            .split(/[\\/]/)
                            .filter(Boolean)
                            .at(-1) ?? project.directory}
                        </strong>
                        <span title={project.directory}>
                          {project.directory}
                        </span>
                      </div>
                      <div class="project-numbers">
                        <b>{project.running} running</b>
                        <span>{project.waiting} waiting</span>
                      </div>
                  </div>
                )}
              </For>
            </Show>
          </>
        )}
      </Show>
      <footer>
        <span>
          Server and machine measurements only, excluding Desktop and per-project CPU.
          Recent history uses 2-second samples; older history uses saved minute averages.
        </span>
        <span class="plugin-version" title="opencode-server-stats version">v{version}</span>
      </footer>
    </main>
  );
}

function Metric(props: {
  title: string;
  value: string;
  detail?: string;
  samples: Sample[];
  field: keyof Sample;
  max?: number;
}) {
  return (
    <article class="metric">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
      <Show when={props.detail}><small>{props.detail}</small></Show>
      <Chart
        samples={props.samples}
        field={props.field}
        label={`${props.title} over time`}
        max={props.max}
      />
    </article>
  );
}

function Chart(props: {
  samples: Sample[];
  field: keyof Sample;
  label: string;
  max?: number;
}) {
  const points = () => {
    const max =
      props.max ??
      Math.max(1, ...props.samples.map((sample) => sample[props.field])) * 1.1;
    const end = props.samples.at(-1)?.time ?? 0;
    const start = props.samples[0]?.time ?? end;
    return props.samples
      .map(
        (sample) =>
          `${8 + ((sample.time - start) / Math.max(1, end - start)) * 384},${72 - Math.min(1, sample[props.field] / max) * 62}`,
      )
      .join(" ");
  };
  return (
    <div>
      <svg
        class="chart"
        viewBox="0 0 400 80"
        preserveAspectRatio="none"
        role="img"
        aria-label={props.label}
      >
        <path class="grid" d="M8 10H392 M8 41H392 M8 72H392" />
        <Show
          when={props.samples.length > 1}
          fallback={
            <text x="200" y="45" text-anchor="middle">
              Collecting samples…
            </text>
          }
        >
          <polygon class="area" points={`8,76 ${points()} 392,76`} />
          <polyline points={points()} />
        </Show>
      </svg>
      <div class="chart-times">
        <span>
          {props.samples[0]
            ? new Date(props.samples[0].time).toLocaleTimeString()
            : "—"}
        </span>
        <span>
          {props.samples.at(-1)
            ? new Date(props.samples.at(-1)!.time).toLocaleTimeString()
            : "—"}
        </span>
      </div>
    </div>
  );
}
