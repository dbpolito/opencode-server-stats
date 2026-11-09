# Development

Use Bun to install dependencies and run the checks:

```sh
bun install
bun run check
bun run dev
```

`bun run check` runs TypeScript checking, the tests and the production GUI build. Tests cover OS measurements, formatting, project grouping and history storage, including retention and write failures.

`bun run dev` rebuilds the GUI as you edit. Desktop reloads local GUI builds automatically. These commands do not change your OpenCode configuration.

## Load locally

Build the plugin with `bun run build` (or use the watch command above). Add the checkout directory to `plugins` in your global OpenCode configuration, keeping existing entries:

```jsonc
{
  "plugins": ["/home/dbpolito/Projects/dbpolito/opencode-server-stats"],
}
```

Replace the example path with your checkout's absolute path. Global configuration loads both the server and Desktop parts. Remote servers need their own installation.

Open a session and run `/stats`, click the CPU/memory readings in the header, or select **Server Stats** in the side panel's **+** menu. The command palette also has **Stats: Open server dashboard**.

## Before sending changes

Run `bun run check`. For platform-specific measurement changes, test on the affected OS when possible and note any platforms you could not test.

The plugin targets OpenCode 2.2.0 or newer. Its Desktop API is experimental, so keep `@opencode/plugin` compatible with the release you test.
