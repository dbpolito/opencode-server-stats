import {
  Command,
  MenuItem,
  Panel,
  Plugin,
  Slot,
  SettingsPage,
  Style,
  type PanelTab,
} from "@opencode/plugin/gui";
import { Dashboard } from "./view";
import { StatsShortcut } from "./shortcut";
import css from "./style.css?inline";
import { statsSettings, StatsSettingsPage } from "./settings";
import { Show } from "solid-js";

export default Plugin.define({
  setup(ctx) {
    const settings = statsSettings(ctx);
    ctx.add(SettingsPage, {
      id: "stats",
      title: "Server Stats",
      icon: "window-analytics",
      entries: [{ id: "header", title: "Show header stats" }, { id: "live", title: "Live updates" }, { id: "interval", title: "Refresh interval" }, { id: "retention", title: "History retention" }],
      render: () => <StatsSettingsPage settings={settings} />,
    });
    const tab: PanelTab = {
      id: "dashboard",
      title: "Server Stats",
      closable: "compact",
      fallback: true,
    };
    const open = () => {
      const session = ctx.sessions.current();
      if (session)
        ctx.layout.open(`${ctx.id}:dashboard`, session, { tab: "select" });
    };
    ctx.add(Style, css);
    ctx.add(Slot, {
      at: "session.header",
      render: (props) => (
        <Show when={settings.value?.showHeader ?? true}>
          <StatsShortcut session={props.session} active={props.active} settings={settings} />
        </Show>
      ),
    });
    ctx.add(Command, () => ({
      id: "open",
      title: "Stats: Open server dashboard",
      group: "Stats",
      slash: { name: "stats" },
      enabled: !!ctx.sessions.current(),
      run: open,
    }));
    ctx.add(MenuItem, (): MenuItem => {
      const session = ctx.sessions.current();
      return {
        menu: "session.panel",
        id: "open",
        title: "Server Stats",
        icon: "window-analytics",
        opened: !!session && ctx.layout.state(`${ctx.id}:dashboard`, session) !== "closed",
        run: open,
      };
    });
    ctx.add(Panel, {
      id: "dashboard",
      region: "side",
      wide: true,
      list: (input) => (input.open.includes("dashboard") ? [tab] : []),
      render: (props) => <Dashboard ctx={ctx} session={props.session} settings={settings} />,
    });
  },
});
