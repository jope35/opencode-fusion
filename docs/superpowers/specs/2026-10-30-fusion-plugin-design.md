# Design: opencode-fusion plugin (2026-10-30)

Linear WHE-29 follow-up. This document is the design for rebuilding the Devin "fusion" pattern as an OpenCode plugin. A reviewer reads this before implementation. Nothing is built until the human partner approves this document.

## Intent and why

WHE-29 researched how Devin Fusion works: it is not a merged model. It is a harness with a frontier lead agent plus a cost-efficient sidekick agent. The lead plans, reviews, and delegates; the sidekick implements and tests. Writes stay single threaded, and the lead always reviews the work. This plugin ports that pattern into OpenCode V2. The lead is a primary agent whose model comes from the top level config. The sidekicks are subagents (child sessions started through the subagent tool) whose models come from the plugin options in opencode.json.

## Goals

1. The plugin registers a lead agent named `fusion` (mode primary) and sets it as the default agent. The lead model is set at the top level of the config (`model`, or `agents.fusion.model`). Manual model switches in the TUI are respected; the plugin does not lock the session model.
2. The plugin registers one subagent per sidekick from the plugin options. Each sidekick has its own model, system prompt, and permissions. Sidekicks use mode subagent, so they can never be selected as the main agent. Do not set `hidden`, because hidden removes an agent from the subagent catalog and the lead must see its sidekicks.
3. Default sidekicks: writer, reviewer, reader, search, summarizer. Sidekick ids are prefixed `fusion-` (for example `fusion-writer`). Users can add more sidekick entries in the plugin options without editing plugin code. The built-in defaults carry description, system prompt, and default permissions, but no model: a sidekick is registered only when the plugin options give it a model. The partner requires explicit models rather than a shipped fallback.
4. The plugin config always wins on sidekick models. A tool execute.before hook sets the model on every subagent call whose agent is a fusion sidekick, overwriting any model the lead passed explicitly.
5. Startup validation: every configured sidekick model must resolve against the model list. If one does not, the plugin throws a clear error at startup instead of falling back silently, and the failure is also surfaced visibly in the TUI (a throw alone only marks the plugin failed in the server log while OpenCode continues), for example through a TUI part that reads the failure state over RPC and shows a dialog. Keep that mechanism minimal.
6. The package is an npm package named `opencode-fusion-agent` (verified free on the npm registry on 2026-10-30; the unscoped names `fusion` and `fusion-agent` are already taken, and npm rejects capital letters in new package names). It is configured through the `plugins` array in opencode.json(c) with the object form that carries `options`.

## Non-goals

- No dynamic mid-session model switching. Devin swaps models at compaction boundaries with lightweight classifiers; this version keeps one lead model per session. Manual switches by the user still work.
- No automatic deletion of child sessions. Sidekick sessions stay visible for audit (what each model did, what it cost).
- No locking of the session model to the configured lead model.
- The plugin does not modify the built-in build or plan agents.

## Anti-goals

- A sidekick must never run as the main agent. Mode subagent enforces this.
- The lead must never edit files or run shell commands directly. Permission deny enforces this; all writes go through the writer sidekick (single threaded writes).
- The plugin must fail loudly at startup on a bad config. Silent fallbacks hide cost and quality surprises.

## Constraints

- OpenCode V2 server plugin API only: `Plugin.define({ id, setup(ctx) })` from `@opencode/plugin`. Pin an OpenCode version and verify every field against that version's config.json schema and plugin types.
- Plugin options arrive as `{ "package": "opencode-fusion", "options": { ... } }` in opencode.json(c) and are read from `ctx.options` in setup.
- Agents are registered at runtime with `ctx.agent.transform`. The editor has no `add`; `update` on an unknown id creates the agent.
- Subagent nesting depth is one, so a sidekick cannot launch another subagent. This matches the lead/sidekick split.
- Only the tool `execute.before` hook can modify tool input. `execute.after` cannot block a call.
- The subagent tool input is `agent`, `description`, `prompt`, optional `model` (`providerID/modelID#variant`), optional `sessionID`, optional `background`.

## Approaches

Approach A, chosen: the plugin registers the lead and all sidekicks at runtime from its options, injects sidekick models through the tool hook, and appends the fusion rules to the lead through a session context hook. Sidekick models live only in the plugin options. The package ships as an npm package. The human partner picked this approach and the npm packaging.

Approach B, not chosen: ship static agent markdown files under `.opencode/agents/` plus a config snippet, with a thin plugin that only injects models. Rejected because the sidekick models would live in agent files instead of the plugin config, and the partner explicitly wants the sidekick models in the plugin config.

## How it works (decided parts)

1. In `setup(ctx)`, read `ctx.options.lead` (default `fusion`) and `ctx.options.sidekicks` (a map of sidekick name to `{ model, description, prompt, permissions }`). User entries merge over the built-in defaults by name; a user entry wins on every key it sets. A sidekick is registered only when it has a model: a missing model means the sidekick is skipped, not an error, because the partner wants models in the plugin config rather than hard-coded defaults.
2. Validate every sidekick model: parse `providerID/modelID#variant`, then require `providerID/modelID` to be present in `await ctx.model.list()`. The `#variant` is passed through without validation. Provider catalogs can load late, so the tool hook in step 5 re-checks membership at dispatch time and lets the subagent tool's own resolution error surface there. At startup, throw a clear error naming the sidekick and the model if it is unknown.
3. Register agents with `ctx.agent.transform`. For the lead: `editor.update(leadId, ...)` sets mode primary, a description, and permissions: deny `edit *`, deny `shell *`, deny `subagent *`, then allow `subagent fusion-*` (last matching rule wins, so the allows come after the broad deny). The lead keeps read, glob, grep, and webfetch. Call `editor.default(leadId)`. In the same transform, for every other agent in `editor.list()`, append `{ action: "subagent", resource: "fusion-*", effect: "deny" }` to its permissions, so only the fusion lead can spawn fusion sidekicks (rules are last-match-wins, so the appended deny wins).
4. For each sidekick: `editor.update("fusion-" + name, ...)` sets mode subagent, the parsed model, the system prompt, the description (the subagent tool shows descriptions to the lead), and permissions. Default permissions per role, overridable per entry in the options: writer allows edit and shell; reviewer allows read only and denies edit and shell; reader allows read, glob, and grep only; search allows read plus webfetch and websearch; summarizer allows read and execute.
5. Register `ctx.tool.hook("execute.before", ...)`. When `event.tool === "subagent"` and `event.input.agent` is a known fusion sidekick, set `event.input.model` to that sidekick's configured model string. The plugin config wins over an explicit model from the lead.
6. Register `ctx.session.hook("context", ...)`. When `event.agent === leadId`, push the fusion rules onto `event.system`: plan and review, delegate mechanical work to the matching sidekick, never edit or run shell directly, expect sidekick results back and accept, re-dispatch, or escalate. This is additive, so the base prompt stays intact.

## Calls made during the builder check

- Options merge semantics: user `sidekicks` entries merge over the five built-in defaults by name, user entry wins per key.
- A sidekick without a model is not registered (skipped silently); a sidekick with an unknown model is a startup error.
- Model validation checks `providerID/modelID` membership in the model list at setup and again at dispatch; `#variant` passes through.
- Partner answers recorded: no shipped default models (a sidekick registers only with an explicit model in the options); package name `opencode-fusion-agent` (registry-checked 2026-10-30; `fusion` and `fusion-agent` are taken); startup failure is thrown and also surfaced visibly in the TUI; only the fusion lead may call fusion sidekicks (a deny `subagent fusion-*` rule is appended to every other agent).

## What is left to the builder

- Confirm the exact `Agent.Info` field names and the model ref shape (string versus object) for the pinned OpenCode version, using its config.json schema and the plugin type definitions.
- npm packaging details: package.json with `exports` mapping `.` to the server part, `@opencode/plugin` as a dependency, publish flow, and local development through a path entry in `plugins`.
- A smoke test: start OpenCode with the plugin loaded, verify the fusion agent is the default, the sidekicks appear in the subagent catalog, the lead is denied edit and shell, and a sidekick call runs on its configured model.
