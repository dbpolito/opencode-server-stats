import {
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { usePlugin, type MountedSession } from "@opencode/plugin/gui";
import { Stats, type Sample } from "./rpc";
import { projects } from "./projects";

export function bytes(value: number) {
  return value >= 1024 ** 3
    ? `${(value / 1024 ** 3).toFixed(2)} GB`
    : `${(value / 1024 ** 2).toFixed(0)} MB`;
}
const number = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const money = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function Dashboard(props: {
  ctx: ReturnType<typeof usePlugin>;
  session: MountedSession;
}) {
  const [selected, setSelected] = createSignal<string>();
  const [window, setWindow] = createSignal(5);
  const [tick, setTick] = createSignal(0);
  const server = () => selected() ?? props.session.server.id;
  const timer = setInterval(() => {
    if (
      !snapshot.loading &&
      !document.hidden &&
      props.ctx.layout.state(`${props.ctx.id}:dashboard`, props.session) ===
        "visible"
    )
      setTick((n) => n + 1);
  }, 2000);
  onCleanup(() => clearInterval(timer));
  const [snapshot] = createResource(
    () => ({ server: server(), tick: tick() }),
    async (source) => {
      const connection = props.ctx.servers.get(source.server);
      if (!connection) throw new Error("Server is unavailable");
      const [snapshot, active] = await Promise.all([
        connection.client.rpc(Stats).snapshot({}),
        connection.client.session.active(),
      ]);
      const states = new Map(
        await Promise.all(
          Object.keys(active).map(async (id) => {
            const [permissions, forms] = await Promise.all([
              connection.client.permission.list({ sessionID: id }),
              connection.client.session.form.list({ sessionID: id }),
            ]);
            return [
              id,
              permissions.length || forms.length ? "waiting" : "running",
            ] as const;
          }),
        ),
      );
      return {
        server: source.server,
        data: {
          ...snapshot,
          sessions: snapshot.sessions.map((session) => ({
            ...session,
            status: states.get(session.id) ?? ("idle" as const),
          })),
        },
      };
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
  const latest = () => data()?.samples.at(-1);
  const grouped = createMemo(() => projects(data()?.sessions ?? []));
  const stale = () => !!latest() && Date.now() - latest()!.time > 10_000;

  return (
    <main class="oc-stats">
      <header>
        <div>
          <span class="eyebrow">OPENCODE / OBSERVABILITY</span>
          <h1>Server stats</h1>
          <p>Live resources. Project activity. One place.</p>
        </div>
        <span class="live" classList={{ offline: !!snapshot.error || stale() }}>
          {snapshot.error || stale()
            ? "Disconnected"
            : snapshot.loading && !data()
              ? "Connecting"
              : "Live · 2s"}
        </span>
      </header>
      <div class="toolbar">
        <label>
          Server{" "}
          <select
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
        </label>
        <div class="ranges" aria-label="Graph time range">
          <For each={[5, 15, 60]}>
            {(minutes) => (
              <button
                aria-pressed={window() === minutes}
                onClick={() => setWindow(minutes)}
              >
                {minutes === 60 ? "1h" : `${minutes}m`}
              </button>
            )}
          </For>
        </div>
      </div>
      <Show when={snapshot.error}>
        <div role="alert" class="notice">
          Unable to load stats. Install opencode-stats on the selected server.{" "}
          {String(snapshot.error?.message ?? snapshot.error)}
          <button onClick={() => setTick((n) => n + 1)}>Retry</button>
        </div>
      </Show>
      <Show
        when={data()}
        fallback={<p class="empty">Waiting for the server’s first snapshot…</p>}
      >
        {(info) => (
          <>
            <div class="server-meta">
              {info().host} · {info().platform} · OpenCode {info().version} ·
              PID {info().pid} · {info().cores} cores · uptime{" "}
              {Math.floor(info().uptime / 3600)}h{" "}
              {Math.floor((info().uptime % 3600) / 60)}m
            </div>
            <section class="cards">
              <Metric
                title="Server CPU"
                value={`${(latest()?.cpu ?? 0).toFixed(1)}%`}
                detail="100% = one CPU core"
                samples={samples()}
                field="cpu"
              />
              <Metric
                title="Server memory"
                value={bytes(latest()?.rss ?? 0)}
                detail={`Resident memory · JS heap ${bytes(latest()?.heap ?? 0)} / ${bytes(latest()?.heapTotal ?? 0)}`}
                samples={samples()}
                field="rss"
              />
              <Metric
                title="Machine CPU"
                value={`${(latest()?.machineCpu ?? 0).toFixed(1)}%`}
                detail="All processes · all cores"
                samples={samples()}
                field="machineCpu"
                max={100}
              />
              <Metric
                title="Machine memory"
                value={bytes(latest()?.machineUsed ?? 0)}
                detail={`of ${bytes(latest()?.machineTotal ?? 0)} · includes OS caches`}
                samples={samples()}
                field="machineUsed"
              />
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
              <span>{info().sessions.length} unarchived sessions</span>
            </div>
            <p class="hint">
              Usage is cumulative for listed sessions, not the graph range.
              Running excludes sessions waiting for permissions or answers.
            </p>
            <Show
              when={grouped().length}
              fallback={
                <p class="empty">No unarchived sessions on this server.</p>
              }
            >
              <For each={grouped()}>
                {(project) => (
                  <details class="project" open={project.running > 0}>
                    <summary>
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
                        <span>{project.sessions.length} sessions</span>
                        <span>{number.format(project.tokens)} tokens</span>
                        <span>{money.format(project.cost)}</span>
                      </div>
                    </summary>
                    <For each={project.sessions}>
                      {(session) => (
                        <button
                          class="session"
                          onClick={() =>
                            props.ctx.tabs.open(
                              { server: server(), id: session.id },
                              { focus: true },
                            )
                          }
                        >
                          <span class="state" data-state={session.status}>
                            {session.status}
                          </span>
                          <span class="session-name">
                            {session.parentID ? "↳ " : ""}
                            {session.title}
                            <small>
                              {session.model ?? "No model selected"}
                            </small>
                          </span>
                          <span>{money.format(session.cost)}</span>
                        </button>
                      )}
                    </For>
                  </details>
                )}
              </For>
            </Show>
            <footer>
              Server and machine measurements only—not Desktop or per-project
              CPU. History is held in memory for up to one hour. Session
              inventory refreshes every 10 seconds.
            </footer>
          </>
        )}
      </Show>
    </main>
  );
}

function Metric(props: {
  title: string;
  value: string;
  detail: string;
  samples: Sample[];
  field: keyof Sample;
  max?: number;
}) {
  return (
    <article class="metric">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
      <small>{props.detail}</small>
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
