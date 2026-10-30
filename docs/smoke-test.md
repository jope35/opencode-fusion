# Smoke test: opencode-fusion-agent

Run against the locally installed `opencode v2.2.4` (matches the pinned `@opencode/plugin` 2.2.4 API). Do not use 2.2.3.

Scratch dir: `/tmp/opencode-fusion-smoke`. Its `opencode.json` loads the plugin by absolute path with one sidekick model taken from that machine's `opencode models` output.

## Setup

```sh
mkdir -p /tmp/opencode-fusion-smoke
cd /tmp/opencode-fusion-smoke
```

`opencode.json`:

```json
{
  "plugins": [
    {
      "package": "/home/joost/Developer/opencode-fusion",
      "options": {
        "sidekicks": {
          "writer": { "model": "mistral/codestral-latest" }
        }
      }
    }
  ]
}
```

## Checklist

- [x] `editor.update` creates agents: `opencode api agent.list` shows `fusion` and `fusion-writer`. The first agent in `agent.list` is the selected default, so `fusion` is first.
- [x] `fusion` is the default agent for a new session.
- [x] `fusion-writer` appears in the subagent catalog (not hidden).
- [x] A prompt to the lead that asks it to edit a file is denied (permission deny), and a subagent call to `fusion-writer` runs on the configured model (visible in the child session).
- [x] With a bogus sidekick model (`"acme/nope"`), startup marks the plugin failed: `opencode api plugin.list` shows `state.status === "failed"` with the sidekick/model error, the TUI shows the built-in "Plugin failed" toast, and `/plugins` displays the error text.

## Results (2026-10-30)

Environment: `opencode v2.2.4`, Node v22.23.2, lead model `melious/deepseek-v4.1-flash`, writer model `mistral/codestral-latest`.

1. **PASS — agents registered.** `opencode api agent.list` returned `fusion` first (mode `primary`, permissions `edit deny`, `shell deny`, `subagent * deny`, `subagent fusion-* allow`) followed by `fusion-writer` (mode `subagent`, `hidden: false`, model `{ providerID: "mistral", id: "codestral-latest" }`, prompt and description set). Built-in agents `general`, `explore`, `plan`, `compaction`, `title`, `summary` each ended with `{ action: "subagent", resource: "fusion-*", effect: "deny" }`.
2. **PASS — default agent.** `fusion` is the first entry in `agent.list`, which is the selected default.
3. **PASS — subagent catalog.** `fusion-writer` is present with mode `subagent` and `hidden: false`.
4. **PASS — lead cannot edit; sidekick model forced.** `opencode run --agent fusion ... "Use the edit tool ..."` replied `EDIT_DENIED`; the exported session shows no edit tool was available to the lead. A subagent call to `fusion-writer` with an explicit `model: "melious/deepseek-v4.1-flash"` ran in child session `ses_e712cc80cffeLp7LIbazj9zZZG`; the exported child assistant message reports `{"id":"codestral-latest","providerID":"mistral","variant":"default"}`, so the plugin config overrode the lead's explicit model. The child wrote `/tmp/opencode-fusion-smoke/sidekick.txt`.
5. **PASS — startup failure surfaced.** With `writer.model: "acme/nope"`, `opencode api plugin.list` reports `state: { status: "failed", error: "Error: unknown model \"acme/nope\" for sidekick writer ..." }`. The TUI (captured through a PTY) shows the built-in toast `Plugin failed: opencode-fusion › Open plugins` and `Run /plugins to view details.`, plus the status line `1 plugin failed /plugins`. No fusion agents were registered.
6. **PASS — other agents cannot spawn fusion sidekicks.** `opencode run --agent plan ... "Call the subagent tool with agent fusion-writer"` returned `Permission denied: subagent`.

### Notes and caveats

- `opencode api plugin.list` returns an empty list if it is the first request against a fresh server: the location has not booted and activated plugins yet. Make one request that boots the location (for example `opencode api agent.list`) first, or query a long-running server.
- This machine's global `~/.config/opencode/opencode.json` grants the built-in `build` agent `{ "action": "*", "resource": "*", "effect": "allow" }`. That user config is applied after plugin transforms and overrides the appended `subagent fusion-*` deny for `build` only; `plan`, `general`, and `explore` keep the deny as the last rule. Remove that global `agents.build.permissions` entry if `build` must also be blocked from fusion sidekicks.
