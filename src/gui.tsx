import {
  Command,
  MenuItem,
  Panel,
  Plugin,
  Style,
  type PanelTab,
} from "@opencode/plugin/gui";
import { Dashboard } from "./view";
import css from "./style.css?inline";

export default Plugin.define({
  setup(ctx) {
    const tab: PanelTab = {
      id: "dashboard",
      title: "Server stats",
      closable: "compact",
      fallback: true,
    };
    const open = () => {
      const session = ctx.sessions.current();
      if (session)
        ctx.layout.open(`${ctx.id}:dashboard`, session, { tab: "select" });
    };
    ctx.add(Style, css);
    ctx.add(Command, () => ({
      id: "open",
      title: "Stats: Open server dashboard",
      group: "Stats",
      slash: { name: "stats" },
      enabled: !!ctx.sessions.current(),
      run: open,
    }));
    ctx.add(MenuItem, {
      menu: "session.panel",
      id: "open",
      title: "Server stats",
      run: open,
    });
    ctx.add(Panel, {
      id: "dashboard",
      region: "side",
      wide: true,
      list: (input) => (input.open.includes("dashboard") ? [tab] : []),
      render: (props) => <Dashboard ctx={ctx} session={props.session} />,
    });
  },
});
