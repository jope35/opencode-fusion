# opencode-fusion-agent

An OpenCode V2 plugin that ports the "fusion" pattern: a frontier lead agent plans and reviews, and cheaper sidekick subagents do the mechanical work.

- Registers a primary lead agent (`fusion` by default) and makes it the default agent. Its model comes from your top-level config; the plugin never sets or locks the session model.
- Registers one subagent per sidekick, named `fusion-<name>`, each on the model you configure in the plugin options.
- Denies the lead `edit` and `shell` directly, and allows it to spawn only `fusion-*` subagents. Every other agent gets a `subagent fusion-*` deny appended, so only the fusion lead can call the sidekicks.
- Forces every subagent call to a fusion sidekick onto that sidekick's configured model, overwriting any model the lead passes.
- Appends the fusion rules to the lead's system prompt: plan, delegate, review, never edit or run shell directly.

Built-in sidekicks: `writer`, `reviewer`, `reader`, `search`, `summarizer`. You can add your own entries.

## Install

Once published:

```sh
npm install opencode-fusion-agent
```

During development, load the package by path (raw TypeScript exports work; there is no build step):

```jsonc
{
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-fusion-agent",
      "options": {
        "lead": "fusion",
        "sidekicks": {
          "writer": { "model": "anthropic/claude-sonnet-5-5" },
          "reviewer": { "model": "openai/gpt-5" },
          "reader": { "model": "openai/gpt-5-mini" }
        }
      }
    }
  ]
}
```

Use the object form in `plugins` so the plugin receives `options`. Sidekick models are `providerID/modelID`, with an optional `#variant` suffix (for example `anthropic/claude-sonnet-5-5#high`). The variant passes through unvalidated.

## Models are required per sidekick

A sidekick is registered only when the options give it a model. A sidekick entry without a model is skipped silently, and a built-in you do not configure never appears.

The five built-ins ship no models on purpose. In particular, if you omit `writer`, the lead stays read-only by design: it has no sidekick that can edit files or run commands.

The plugin validates every configured model against the model catalog at startup. An unknown model fails the plugin with an error that names the sidekick and the model. If the catalog is empty because providers are still loading, the plugin fails with a distinct "model catalog is empty" error: restart OpenCode once provider catalogs finish loading.

## Safe defaults for custom sidekicks

A custom sidekick entry that sets no `permissions` gets the reviewer defaults: `edit` and `shell` are denied. A custom sidekick that sets no `description` or `prompt` gets a non-empty name-based fallback. Set `permissions` explicitly if a custom sidekick needs to write or run commands:

```jsonc
{
  "sidekicks": {
    "docs": {
      "model": "openai/gpt-5",
      "description": "Writes documentation.",
      "prompt": "You write and update documentation.",
      "permissions": [
        { "action": "edit", "resource": "*", "effect": "allow" },
        { "action": "shell", "resource": "*", "effect": "deny" }
      ]
    }
  }
}
```

Permission rules use the last-match-wins order. The lead's permissions are fixed by the plugin; sidekick permissions come from the options.

## Startup failure

A bad config throws during plugin setup. OpenCode marks the plugin failed, and its built-in TUI shows a **"Plugin failed" toast**; run `/plugins` to see the error text. There is no custom TUI part: OpenCode only loads a package's `./tui` part when the server part is active, so a TUI part could not report a server startup failure.

## Development

```sh
npm test        # node --test test/*.test.ts
npm run typecheck
```

The plugin API is pinned to `@opencode/plugin` 2.2.4. See `docs/smoke-test.md` for the end-to-end checklist.
