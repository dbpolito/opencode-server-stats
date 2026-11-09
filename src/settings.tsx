import { Schema } from "effect";
import { usePlugin, type Context } from "@opencode/plugin/gui";
import { createResource, createSignal, For, Show } from "solid-js";
import { Stats } from "./rpc";

export function statsSettings(ctx: Pick<Context, "storage">) {
  return ctx.storage.store("settings-v1", {
    schema: Schema.Struct({ live: Schema.Boolean, interval: Schema.Number, showHeader: Schema.optional(Schema.Boolean) }),
    initial: { live: true, interval: 2, showHeader: true },
    scope: "global",
  });
}
export type StatsSettings = ReturnType<typeof statsSettings>;
export const intervals = [2, 5, 10, 30, 60];
export function refreshInterval(settings: StatsSettings) {
  const value = settings.value?.interval ?? 2;
  return intervals.includes(value) ? value : 2;
}

export function StatsSettingsPage(props: { settings: StatsSettings }) {
  const ui = usePlugin().ui;
  return (
    <div>
      <div class="settings-tab-header">
        <h2 class="settings-tab-title">Server Stats</h2>
        <p>Refresh preferences apply to the dashboard and header. Server history collection continues while paused.</p>
      </div>
      <div class="settings-tab-body settings-tab-body--sectioned">
      <section class="settings-section" aria-label="Updates">
       <div data-component="settings-list">
        <div data-component="settings-row" data-action="header">
          <div data-slot="settings-row-copy">
            <div data-slot="settings-row-title">Show header stats</div>
            <div data-slot="settings-row-description">Show CPU and memory readings in the top-right session header.</div>
          </div>
          <div data-slot="settings-row-control">
            <ui.Switch label="Show header stats" hideLabel checked={props.settings.value?.showHeader ?? true}
              disabled={!props.settings.ready()}
              onChange={(showHeader) => props.settings.update((draft) => { draft.showHeader = showHeader; })} />
          </div>
        </div>
        <div data-component="settings-row" data-action="live">
          <div data-slot="settings-row-copy"><div data-slot="settings-row-title">Live updates</div></div>
          <div data-slot="settings-row-control">
          <ui.Switch label="Live updates" hideLabel checked={props.settings.value?.live ?? true}
            disabled={!props.settings.ready()}
            onChange={(live) => props.settings.update((draft) => { draft.live = live; })} />
          </div>
        </div>
        <div data-component="settings-row" data-action="interval">
          <div data-slot="settings-row-copy"><div data-slot="settings-row-title">Refresh interval</div></div>
          <div data-slot="settings-row-control">
          <select aria-label="Refresh interval" value={refreshInterval(props.settings)} disabled={!props.settings.ready()}
            onChange={(event) => { const interval = Number(event.currentTarget.value); props.settings.update((draft) => { draft.interval = interval; }); }}>
            {intervals.map((seconds) => <option value={seconds}>{seconds} seconds</option>)}
          </select>
          </div>
        </div>
      </div>
      </section>
      <HistorySettings />
      </div>
    </div>
  );
}

function HistorySettings() {
  const ctx = usePlugin();
  const [selected, setSelected] = createSignal<string>();
  const [error, setError] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const server = () => selected() ?? ctx.sessions.current()?.server.id ?? ctx.servers.list()[0];
  const [settings, { refetch }] = createResource(server, async (id) => {
    try {
      const connection = ctx.servers.get(id);
      if (!connection) throw new Error("Server unavailable");
      const result = await connection.client.rpc(Stats).historySettings({});
      setError("");
      return result;
    } catch (cause) {
      setError(String(cause));
      return undefined;
    }
  });
  const save = async (retentionDays: number) => {
    const id = server();
    const connection = id ? ctx.servers.get(id) : undefined;
    if (!connection) return;
    setSaving(true);
    try {
      await connection.client.rpc(Stats).configureHistory({ retentionDays });
      await refetch();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section class="settings-section" aria-label="History">
      <div data-component="settings-list">
        <div data-component="settings-row">
          <div data-slot="settings-row-copy"><div data-slot="settings-row-title">History server</div></div>
          <select aria-label="History server" value={server()} disabled={saving()} onChange={(event) => setSelected(event.currentTarget.value)}>
            <For each={ctx.servers.list()}>{(id) => <option value={id}>{ctx.servers.get(id)?.name ?? id}</option>}</For>
          </select>
        </div>
        <div data-component="settings-row" data-action="retention">
          <div data-slot="settings-row-copy">
            <div data-slot="settings-row-title">History retention</div>
            <div data-slot="settings-row-description">Minute summaries are saved on this server. Shortening retention deletes expired history; live updates do not control recording.</div>
          </div>
          <select aria-label="History retention" value={settings()?.retentionDays ?? 7} disabled={saving() || settings.loading || !settings()}
            onChange={(event) => void save(Number(event.currentTarget.value))}>
            <For each={[1, 7, 14, 30]}>{(days) => <option value={days}>{days} {days === 1 ? "day" : "days"}</option>}</For>
          </select>
        </div>
      </div>
      <Show when={error()}><p role="alert">Unable to configure history: {error()}</p></Show>
    </section>
  );
}
