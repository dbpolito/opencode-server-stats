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

Open a session and run `/server-stats`, click the CPU/memory readings in the header, or select **Server Stats** in the side panel's **+** menu. The command palette also has **Server Stats: Open dashboard**.

## Before sending changes

Run `bun run check`. For platform-specific measurement changes, test on the affected OS when possible and note any platforms you could not test.

The plugin targets OpenCode 2.2.0 or newer. Its Desktop API is experimental, so keep `@opencode/plugin` compatible with the release you test.

## Releasing

The `Publish to npm` workflow publishes the package when a GitHub release is published. It installs locked dependencies, runs `bun run check`, and publishes with npm provenance. Normal releases use the `latest` npm tag; GitHub prereleases use `next`.

One-time setup: in the npm package's settings, add a GitHub Actions trusted publisher with owner `dbpolito`, repository `opencode-server-stats`, and workflow filename `publish.yml`. Leave the environment field blank. No npm token secret is needed.

To release:

1. Update `version` in `package.json` and commit the change.
2. Create and push a matching tag, such as `v0.1.4`.
3. Publish a GitHub release for that tag. Mark preview releases as prereleases.

The workflow rejects tags that do not match the package version (an optional `v` prefix is allowed). Each release must use a new npm version.
