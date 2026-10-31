# opencode-fusion-agent

A frontier model plans and reviews. Cheaper, faster models do the mechanical work. `opencode-fusion-agent` is an OpenCode V2 server plugin that ports that "fusion" pattern to your own models and provider keys.

You talk to one agent, `fusion`. It never edits files or runs shell commands itself. It breaks the task down, sends focused briefs to sidekick subagents (`fusion-writer`, `fusion-reader`, `fusion-reviewer`, ...), reads their reports, and accepts them, re-dispatches with a tighter brief, or escalates to you. Writes are routed through one writer; reads and research can run in parallel.

- Registers a primary lead agent (`fusion` by default) and makes it the default agent. The lead's model comes from your top-level configuration; the plugin never sets or locks the session model.
- Registers one subagent per sidekick, named `fusion-<name>`, each pinned to the model you configure for it.
- Denies the lead `edit` and `shell`, and lets it spawn only `fusion-*` subagents. Those rules are appended after your own, so unrelated permissions survive while last-match-wins keeps the lockdown.
- Appends a `subagent fusion-*` deny to every other agent, including each sidekick, so only the fusion lead can call the sidekicks and a sidekick cannot call another sidekick or itself.
- Forces every `subagent` call to a fusion sidekick onto that sidekick's configured model, overwriting any model the lead passes.
- Appends fusion rules to the lead's system prompt. The rules name only the sidekicks that are actually registered.
- Appends a standard report envelope to every sidekick prompt: what it did or found, files touched, commands or tests run and their outcome, confidence, and anything it could not verify.
- Validates every configured model at startup and refuses to overwrite an existing agent with the same id.

> **Status:** 0.1.0, pre-release. The server plugin API is pinned to `@opencode/plugin` 2.2.4.

## Quick start

1. Clone this repository and run `npm install` in it.
2. Add the plugin to `opencode.json` with your lead model as the top-level `model` and at least one sidekick model in the plugin options. See [Install](#install) and [Configure](#configure).
3. Run `opencode`; `fusion` is the default agent. Ask for a task and the lead delegates it.

The rest of this README explains the model split, the sidekick catalog, and the guardrails.

## Contents

- [Quick start](#quick-start)
- [Why fusion](#why-fusion)
- [Requirements](#requirements)
- [Install](#install)
- [Configure](#configure)
- [Use it](#use-it)
- [Practical examples](#practical-examples)
- [Built-in sidekicks](#built-in-sidekicks)
- [Choosing models](#choosing-models)
- [Configuration reference](#configuration-reference)
- [Permissions and safety](#permissions-and-safety)
- [Troubleshooting](#troubleshooting)
- [How it works](#how-it-works)
- [Limitations](#limitations)
- [Development](#development)
- [References](#references)
- [License](#license)

## Why fusion

Most coding sessions are a mix of two very different jobs:

- **Judgement work:** understand the request, find the real problem, choose an approach, notice when a patch is wrong. This is where a frontier model earns its price.
- **Mechanical work:** read these twelve files, apply this rename everywhere, run the tests, summarize this log, search the web for this API. This is where the same frontier model mostly burns tokens.

Fusion separates the two. The strongest model you have stays in charge and does the judgement work. Cheaper models get the token-heavy work. The lead reviews everything before it reaches you.

This is not a new model and not a token-level merge. It is an orchestration harness: plan → delegate → review. That is the same mechanism the commercial fusion products use for their lead/sidekick path.

### Lower cost

If a cheap model handles most of the tokens, the bill drops even when the total token count goes up. A simple model, ignoring extra re-reads:

| Share of tokens on the sidekick | Sidekick price vs lead | Cost as % of all-frontier |
| --- | --- | --- |
| 70% | 1/10 | 0.30 + 0.07 = **37%** |
| 80% | 1/10 | 0.20 + 0.08 = **28%** |
| 80% | 1/5 | 0.20 + 0.16 = **36%** |
| 90% | 1/10 | 0.10 + 0.09 = **19%** |

Delegation adds tokens: sidekicks have their own context and may re-read files the lead already saw, and every result is another turn. So treat the table as an upper bound on savings, not a promise. The saving comes from the rate difference, not from doing less work.

For calibration, independent and vendor measurements of the commercial fusion products land in this range:

- Artificial Analysis measured Devin Fusion at roughly equal quality to its frontier model alone at **36% lower cost per task** ($7.90 vs $12.40), with 70% more tokens and about 3× the turns.
- GitHub's Copilot Fusion Max, in a vendor-funded evaluation published by Artificial Analysis, scored 60 vs about 62 for Claude Code with Opus 5.5 Max on the AA Coding Agent Index at **$5.59 vs $11.42 per task (−51%)**.
- Vendor claims go higher (Devin "up to 60%", Copilot "up to 77%"), but those are company-run evals without published raw data.

Those products also include a router that this plugin does not have. The numbers show what the pattern can do; your result depends on your model split and your tasks. Measure a few real sessions before you budget the savings.

### Speed

- Small models usually respond faster per token, so the mechanical loop finishes sooner.
- Independent reads, searches, and summaries can run as parallel subagent calls.
- The lead's context stays small because file dumps and test logs land in sidekick sessions, not in the lead's. Less context means fewer compactions, fewer re-reads, and fewer retries after a context reset.

Speed is not guaranteed. Delegation costs at least one extra round trip per brief, and the measured fusion products use more turns than a single model. On a one-line change, a normal single agent is faster. On multi-file work, the parallel reads and the smaller lead context usually win.

### Comparable quality

- The frontier model is still the one that plans and accepts the work. A weak draft can be rejected, not merged.
- The lead gets a uniform report from every sidekick: files touched, commands and tests run, outcome, confidence, and anything unverified. Review is a checklist instead of a guess.
- The `reviewer` sidekick adds a second pass over the diff. Running it on a different model or vendor catches blind spots the writer shares with the lead.
- The `writer` is expected to run the relevant tests and report the result, so quality is checked by execution as well as by reading.

Quality parity is realistic, not automatic. Benchmarks of fusion products show composite scores near the frontier model while individual components regress by up to about 6 points, and mixing models can hurt on some tasks. Treat the lead's review as the safety net and keep a strong writer for risky changes.

### What you get beyond cost

- **Your models, your keys.** Nothing leaves your provider setup, and there is no separate fusion service or charge.
- **Per-role model choice.** Put a strong coder on `writer`, a cheap long-context model on `reader`, a different vendor's model on `reviewer`.
- **Predictable delegation.** The sidekick model is forced by the plugin, so a lead cannot silently upgrade a cheap sidekick to an expensive model.
- **Guardrails by default.** The lead cannot edit or run shell; sidekicks cannot recurse; other agents cannot call fusion sidekicks; a bad model fails at startup with a visible error.

## Requirements

- OpenCode V2. The plugin is built against `@opencode/plugin` **2.2.4** and is smoke-tested on OpenCode 2.2.4. Newer V2 releases are expected to work; check `/plugins` if a release changes the plugin API.
- At least one provider that offers a strong planning model and one cheaper model for sidekick work.
- The model ids must be visible in `opencode models`. The plugin validates every configured model against the catalog at startup.
- Node.js 22.18+ if you want to run the test suite or typecheck locally.

## Install

The package is not published on npm yet, so install from source. OpenCode loads the plugin's raw TypeScript directly; there is no build step.

```sh
# omit -b feat/fusion-plugin once this PR is merged
git clone -b feat/fusion-plugin https://github.com/jope35/opencode-fusion.git ~/code/opencode-fusion
cd ~/code/opencode-fusion
npm install
```

Then add the plugin to your OpenCode configuration. Use the object form so the plugin receives `options`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-opus-5-5",
  "plugins": [
    {
      "package": "/home/you/code/opencode-fusion",
      "options": {
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

Use an **absolute path** (or a path relative to the config file) in `package`; `~` is not expanded. Replace `/home/you` with your home directory. The configuration can be global (`~/.config/opencode/opencode.json` or `$XDG_CONFIG_HOME/opencode/opencode.json`) or project-local (`opencode.json` or `.opencode/opencode.json`). A project-local entry lets one repository use a different split.

The model ids above are illustrative. Run `opencode models` and use ids that exist in your account.

Once the package is published, the same entry becomes:

```jsonc
{
  "plugins": [
    {
      "package": "opencode-fusion-agent",
      "options": {
        // the same sidekick options as above
      }
    }
  ]
}
```

OpenCode watches configuration and reloads plugins after a save. Use `/reload` to force a reload.

### Verify the install

```sh
opencode models                 # find the provider/model ids you want
opencode api agent.list         # fusion should be first, fusion-writer present
```

In the TUI, `fusion` is the selected default agent and `fusion-writer` appears in the subagent catalog. If the plugin failed to load, OpenCode shows a **"Plugin failed"** toast; run `/plugins` for the error text.

## Configure

A working setup needs a lead model and at least one sidekick model. Set the lead's model with the top-level `model` field; the plugin creates the lead without a model override, so the lead uses the session model. The plugin does not choose or lock it. A fuller configuration adds the remaining built-ins:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-opus-5-5",
  "plugins": [
    {
      "package": "/home/you/code/opencode-fusion",
      "options": {
        "lead": "fusion",
        "sidekicks": {
          "writer": { "model": "anthropic/claude-sonnet-5-5" },
          "reviewer": { "model": "openai/gpt-5" },
          "reader": { "model": "openai/gpt-5-mini" },
          "search": { "model": "openai/gpt-5-mini" },
          "summarizer": { "model": "openai/gpt-5-mini" }
        }
      }
    }
  ]
}
```

Model refs are `providerID/modelID`, with an optional `#variant` suffix for reasoning effort or a provider-specific variant:

```jsonc
"writer": { "model": "anthropic/claude-sonnet-5-5#high" }
```

The variant passes through unvalidated; the provider decides what it means.

A sidekick is registered **only when it has a model**. Anything you omit is skipped silently. The five built-ins ship without models on purpose, so a fresh install registers no sidekicks and leaves the lead read-only until you choose a split.

If you omit `writer` and add no custom sidekick with `edit` or `shell` permission, the lead stays read-only by design: there is no sidekick that can edit files or run commands.

The smallest editing split is a single `writer`:

```jsonc
"sidekicks": {
  "writer": { "model": "anthropic/claude-sonnet-5-5" }
}
```

Add `reader`, `reviewer`, `search`, or `summarizer` as your tasks need them. A `reviewer` is often the best quality-per-dollar addition: it adds a second pass without giving anyone else write access.

## Use it

Select `fusion` (it is the default) and give it a normal request. You do not need to name sidekicks; the lead's system prompt tells it what is registered and when to delegate.

```text
Add rate limiting to the /api/login route. Reuse the Redis client in src/cache.ts,
add tests for the allowed and blocked paths, and update the API docs.
```

A typical run looks like this:

1. The lead reads the request, inspects just enough context, and writes a plan.
2. It sends `fusion-reader` a brief: map the auth route, the Redis client, and the existing test patterns.
3. It sends `fusion-writer` an implementation brief with the files to change and the tests to run.
4. It asks `fusion-reviewer` to review the changed files and report findings by severity.
5. It accepts the work, re-dispatches a specific fix, or tells you what it could not verify.

You see the final answer, not the token-by-token merge. The child sessions are available if you want to audit what a sidekick actually did.

### From the CLI

```sh
opencode run --agent fusion "Explain how config loading works in this repo"
```

The lead is the default, so `opencode run "..."` without `--agent` also uses it in a fresh session, unless you set a different `default_agent`. Passing `--model` sets the lead's model; sidekick models are still forced by the plugin.

You can also run a sidekick directly when you do not want the lead in the loop:

```sh
opencode run --agent fusion-writer "Fix the failing test in test/queue.test.ts and run it"
opencode run --agent fusion-reader "Summarize what src/config.ts exports and where each export is used"
opencode run --agent fusion-reviewer "Review the staged diff for correctness and report findings by severity"
```

A direct run bypasses the lead's review, so use it for small, well-scoped jobs.

### What the lead will and will not do

- It will plan, ask clarifying questions, inspect context, delegate, and review.
- It will not edit files or run shell commands. Those tools are denied; when `writer` is configured, work goes through `fusion-writer`.
- It will not call an agent outside `fusion-*`, and other agents cannot call `fusion-*`.
- It can dispatch parallel reads, searches, and summaries. Writes go through the writer sidekick.

## Practical examples

### 1. Everyday feature work

Lead: frontier model. Writer: a strong mid-tier coder. Reviewer: a strong model, ideally a different vendor. Reader: a cheap long-context model.

```jsonc
{
  "model": "anthropic/claude-opus-5-5",
  "plugins": [
    {
      "package": "/home/you/code/opencode-fusion",
      "options": {
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

Ask for an outcome, not a sequence of steps:

```text
The CSV import drops rows with quoted newlines. Reproduce it with a fixture,
fix the parser, add a regression test, and tell me what else could break.
```

The lead uses `reader` to locate the parser and fixtures, `writer` to reproduce and fix, and `reviewer` to check the diff. You get one answer with the tests and the remaining risks.

### 2. Read-only research and onboarding

Omit `writer` entirely and add no custom edit-capable sidekick. The lead has no way to edit, which is the point.

```jsonc
{
  "model": "anthropic/claude-opus-5-5",
  "plugins": [
    {
      "package": "/home/you/code/opencode-fusion",
      "options": {
        "sidekicks": {
          "reader": { "model": "openai/gpt-5-mini" },
          "search": { "model": "openai/gpt-5-mini" },
          "summarizer": { "model": "openai/gpt-5-mini" }
        }
      }
    }
  ]
}
```

```text
Map the request path from the HTTP router to the database. Cite file and line
numbers, note the middleware order, and list the three places most likely to
break when we add a new endpoint.
```

`reader` walks the code, `search` checks external library behavior when needed, and `summarizer` condenses a long log or doc. Nothing can be modified.

### 3. Review-only mode

Configure `reviewer` and `reader`, leave out `writer`, and add no other edit-capable sidekick. The lead cannot edit, and neither can the reviewer.

```jsonc
{
  "plugins": [
    {
      "package": "/home/you/code/opencode-fusion",
      "options": {
        "sidekicks": {
          "reviewer": { "model": "openai/gpt-5#high" },
          "reader": { "model": "openai/gpt-5-mini" }
        }
      }
    }
  ]
}
```

```text
Review the current branch against main. Report findings by severity with
file:line and a suggested fix. Call out missing tests and any behavior change
that is not covered by the PR description. Do not edit anything.
```

This is a safe default for a second opinion on a branch: the reviewer has no edit or shell tools, and the lead cannot apply a fix behind your back.

### 4. A large mechanical refactor

Put the model that writes the best code on `writer`, and keep the frontier model on the lead and reviewer. The writer does the repetitive edits; the reviewer checks the whole diff.

```jsonc
{
  "model": "anthropic/claude-opus-5-5",
  "plugins": [
    {
      "package": "/home/you/code/opencode-fusion",
      "options": {
        "sidekicks": {
          "reader": { "model": "openai/gpt-5-mini" },
          "writer": { "model": "anthropic/claude-sonnet-5-5#high" },
          "reviewer": { "model": "openai/gpt-5#high" }
        }
      }
    }
  ]
}
```

```text
Rename the `Account` domain object to `Workspace` across the repo. Update
imports, the database mapping, fixtures, and tests. Keep the public API stable.
Run the unit and integration suites, then report every file you touched and any
test you could not run.
```

Ask the lead to inventory first for a wide change:

```text
Before editing, have the reader list every definition and usage of `Account`,
grouped by package, so the writer gets the full scope in one brief.
```

### 5. A custom sidekick

Custom sidekicks use the same options. Add entries to the `sidekicks` object; the fragment below shows the plugin entry's `options`. A custom entry without `permissions` gets the reviewer defaults: `edit` and `shell` denied. Set permissions explicitly when the sidekick needs to write.

```jsonc
{
  "options": {
    "sidekicks": {
      "writer": { "model": "anthropic/claude-sonnet-5-5" },
      "docs": {
        "model": "openai/gpt-5-mini",
        "description": "Writes and updates documentation.",
        "prompt": "You write and update documentation. Match the existing style, keep examples runnable, and do not change code.",
        "permissions": [
          { "action": "edit", "resource": "*", "effect": "allow" },
          { "action": "shell", "resource": "*", "effect": "deny" }
        ]
      },
      "tester": {
        "model": "anthropic/claude-sonnet-5-5",
        "description": "Runs tests and reports failures.",
        "prompt": "You run the project's test commands, diagnose failures, and report the smallest set of changes that would fix them. Do not edit files.",
        "permissions": [
          { "action": "edit", "resource": "*", "effect": "deny" },
          { "action": "shell", "resource": "*", "effect": "allow" }
        ]
      }
    }
  }
}
```

The lead sees `fusion-docs` and `fusion-tester` in its rules and can delegate to them. The `tester` can run commands but cannot edit, so it reports a diagnosis while `writer` applies the fix.

### 6. Cheapest useful setup

If you want the cost floor and mostly ask questions, configure only a reader and summarizer in the plugin options. The lead is read-only and does all the reasoning; the cheap models only fetch and condense.

```jsonc
{
  "options": {
    "sidekicks": {
      "reader": { "model": "openai/gpt-5-mini" },
      "summarizer": { "model": "openai/gpt-5-mini" }
    }
  }
}
```

You lose edits and shell, so this is for onboarding, investigation, and review of material you paste in.

### 7. Different splits per project

Keep the global config generic and use a project entry when a repository needs its own split. A legacy service can use a cheaper writer and no search sidekick; a frontend repo can use a writer with a different vendor's reviewer.

`opencode.json` in the repository:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "openai/gpt-6",
  "plugins": [
    {
      "package": "/home/you/code/opencode-fusion",
      "options": {
        "sidekicks": {
          "writer": { "model": "openai/gpt-6-luna" },
          "reviewer": { "model": "anthropic/claude-opus-5-5#high" },
          "reader": { "model": "openai/gpt-6-luna" }
        }
      }
    }
  ]
}
```

OpenCode applies project configuration after global configuration, but plugin arrays are combined rather than replaced. Keep one entry for this plugin: if you already added it globally, remove that entry before using a project-local entry, or the plugin will load twice.

## Built-in sidekicks

| Sidekick | Id | Tools | Best model tier | Job |
| --- | --- | --- | --- | --- |
| `writer` | `fusion-writer` | `edit` allow, `shell` allow | Strong coding model | Implement changes, write tests, run them |
| `reviewer` | `fusion-reviewer` | `edit` deny, `shell` deny | Strong reasoning model | Review a diff or design, findings by severity |
| `reader` | `fusion-reader` | `edit` deny, `shell` deny, `webfetch` deny, `websearch` deny | Cheap long-context model | Read files and report what they contain |
| `search` | `fusion-search` | `edit` deny, `shell` deny | Cheap model with web tools | Research a topic and cite sources |
| `summarizer` | `fusion-summarizer` | `edit` deny, `shell` deny, `webfetch` deny, `websearch` deny | Cheapest model | Condense logs, docs, and long output |

Every sidekick prompt ends with the report envelope, including custom prompts. That is what makes the lead's review consistent across models.

## Choosing models

| Role | What matters | Typical choice |
| --- | --- | --- |
| Lead | Planning, ambiguity, review judgement | Your strongest reasoning model |
| Writer | Code quality per edit; most sidekick tokens land here | The best coder you can afford; often one tier below the lead |
| Reviewer | Independent judgement, different blind spots | A strong model, ideally from another vendor than the writer |
| Reader | Context window and price | A cheap long-context or mini model |
| Search | Tool use and price | A cheap model with web access |
| Summarizer | Price | The cheapest capable model |

Rules of thumb:

- **Keep the lead strong.** The lead is the quality gate; downgrading it saves little and costs the most.
- **Do not downgrade the writer blindly.** If the writer produces patches the reviewer keeps rejecting, the extra turns erase the savings. Measure.
- **Use a different reviewer.** Same-vendor writer and reviewer often share the same mistakes.
- **Match the sidekick to the task.** A cheap reader on a 200k-token context is a good trade; a cheap model on a subtle concurrency bug is not.
- **Configure only what you use.** Each sidekick adds a prompt, a model, and a chance for the lead to delegate. A configured but unused sidekick costs little, but it adds a line to the lead's rules and another delegation option.

## Configuration reference

```ts
interface PluginOptions {
  lead?: string
  sidekicks?: Record<string, {
    model?: string
    description?: string
    prompt?: string
    permissions?: PermissionRule[]
  }>
}

interface PermissionRule {
  action: string          // "edit", "shell", "subagent", "webfetch", "websearch", ...
  resource: string        // "*" or a pattern
  effect: "allow" | "ask" | "deny"
}
```

| Option | Default | Meaning |
| --- | --- | --- |
| `lead` | `"fusion"` | Id of the primary agent. Must match `^[a-z0-9][a-z0-9-]*$` and must not be a built-in agent id. |
| `sidekicks.<name>.model` | none | `provider/model` or `provider/model#variant`. Without it the sidekick is not registered. |
| `sidekicks.<name>.description` | built-in text, or `"<name> sidekick."` | Shown in the agent catalog and in the lead's rules. |
| `sidekicks.<name>.prompt` | built-in text, or a name-based fallback | Sidekick system prompt. The report envelope is appended. |
| `sidekicks.<name>.permissions` | built-in defaults, else deny `edit` and `shell` | Full permission list for the sidekick. |

Sidekick names must match `^[a-z0-9][a-z0-9-]*$`. The names `constructor`, `prototype`, and `__proto__` are rejected. A sidekick id is `fusion-<name>`.

The lead cannot use a built-in agent id: `build`, `plan`, `general`, `explore`, `compaction`, `title`, or `summary`. A configured lead or sidekick id that already exists in your config fails startup instead of being overwritten. A previous fusion registration is recognised on reload, so reloading does not collide with itself.

## Permissions and safety

The plugin appends its rules after your own, and OpenCode resolves permission lists last-match-wins. That gives you both properties:

- Your unrelated rules on the lead survive.
- The lockdown rules are last, so a broad earlier allow does not unlock `edit`, `shell`, or non-fusion subagents.

What the plugin enforces:

- The lead: `edit` deny, `shell` deny, `subagent *` deny, `subagent fusion-*` allow.
- Every other agent, including each sidekick: `subagent fusion-*` deny appended.
- A sidekick's own `edit`/`shell` permissions come from your options; the plugin does not add an allow.
- Each sidekick's model is forced on every `subagent` call, so a lead cannot pass a different model.

One caveat: configuration you apply after the plugin transform can still override an appended rule. For example, a global `agents.build.permissions` rule with action `*` on resource `*` and effect `allow` is applied later and overrides the `build` agent's `subagent fusion-*` deny. Nothing in the plugin can change OpenCode's merge order. Remove such a wildcard from other agents if they must be blocked.

The plugin cannot stop a sidekick from doing damage its own permissions allow. A `writer` with `shell` allow can run any command your user can, and a custom sidekick with `edit` allow can write anywhere. Treat the options as the security boundary, not the lead's prompt.

## Troubleshooting

**The plugin failed to load.** OpenCode shows the built-in "Plugin failed" toast, naming the plugin `opencode-fusion`. Run `/plugins` for the error text, or check `~/.local/share/opencode/log/opencode.log`. There is no custom TUI error panel: OpenCode only loads a package's `./tui` part when the server part is active, so the plugin reports through the server and the toast.

**`unknown model "x/y" for sidekick writer`.** The model id is not in your catalog. Run `opencode models` and use the exact `providerID/modelID`. A typo, a provider that is not configured, or a model that is not enabled all produce this error.

**`model catalog is empty; providers may still be loading`.** The plugin validated before provider catalogs were ready. Restart OpenCode once and try again. Do not configure a model you cannot see in `opencode models`.

**An agent id already exists.** You already have an agent named `fusion` or `fusion-<name>` for a configured sidekick. Rename the fusion agent with `lead`, or rename the sidekick. The plugin refuses to overwrite your agent.

**The lead cannot edit or run tests.** That is the design. Configure `writer` if the lead needs to change files or run commands. Omitting `writer` is how you get a read-only research agent.

**A configured sidekick never appears.** It has no `model`. A sidekick without a model is skipped silently.

**`Permission denied: subagent` from `plan` or `build`.** Expected. Only the fusion lead can spawn fusion sidekicks. See the wildcard caveat under [Permissions and safety](#permissions-and-safety) if a specific agent should be blocked but is not.

**A sidekick ignored the model the lead passed.** Sidekick models are forced by the plugin. To change one, edit the plugin option, not the prompt.

**The whole thing feels slower.** Delegation adds turns. Try a cheaper/faster writer, drop the `reader` for small tasks, or switch to a normal single agent for one-line changes; the fusion lead cannot edit by itself.

## How it works

At startup, `setup`:

1. Merges options and validates names and ids.
2. Reads the model catalog and rejects unknown sidekick models before registering anything.
3. Transforms the agent registry: creates or updates the lead and each configured sidekick, sets the lead as default, and appends the recursion deny to every other agent.
4. Registers an `execute.before` tool hook that rewrites the `model` field of any `subagent` call whose `agent` is a fusion sidekick.
5. Registers a session `context` hook that appends the fusion rules to the lead's system prompt only.

At runtime, the lead plans, calls the `subagent` tool with a brief, receives the report, and decides whether to accept, re-dispatch, or escalate. Sidekicks run with their own context and permissions; they cannot see the lead's conversation unless it is included in the brief.

There is no build step. The package exports `./src/index.ts` and OpenCode loads the TypeScript.

## Limitations

- **No dynamic routing.** Unlike the commercial fusion products, the plugin does not classify each task and switch models mid-session. The split is static: one model per sidekick, chosen by you.
- **No token-level merge or voting.** Results come back as reports; the lead accepts them or asks for another pass. That is the same combination strategy the commercial lead/sidekick path uses, but it is not an ensemble.
- **Writes are not enforced single-threaded.** The lead is instructed to route writes through `writer`, and the built-in `writer` is the only built-in sidekick that can edit or run shell. The plugin does not serialize subagent calls, so if you add several edit-capable sidekicks the lead could dispatch concurrent writes.
- **Extra tokens and turns.** Sidekick contexts and briefs add overhead. Very small tasks are cheaper and faster without fusion.
- **Quality depends on the writer.** A weak writer can produce drafts the reviewer rejects, and the extra turns can erase the savings.
- **The catalog must be ready at startup.** A provider that loads late causes the empty-catalog error until restart.
- **Config merge order is OpenCode's.** A later wildcard permission can override the appended denies, as described above.
- **Not a benchmark guarantee.** The cost and quality figures quoted here are for other products. Validate on your own tasks.

## Development

```sh
npm test        # node --test test/*.test.ts
npm run typecheck
```

The suite covers option validation, model refs, agent registration, collisions, hooks, and startup behavior. See [`docs/smoke-test.md`](docs/smoke-test.md) for the end-to-end checklist against a real OpenCode server.

The plugin API is pinned to `@opencode/plugin` 2.2.4. To try a change, point `package` at your working copy and use `/reload`.

## References

- Cognition, "Devin Fusion" (2026-06-29): <https://cognition.com/blog/devin-fusion>
- Devin docs, Fusion: <https://docs.devin.ai/desktop/fusion>
- The Batch (DeepLearning.AI), summary of Artificial Analysis's independent Devin Fusion benchmark (2026-09-25): <https://www.deeplearning.ai/the-batch/one-agent-works-another-directs>
- GitHub docs, Copilot Fusion: <https://docs.github.com/en/copilot/concepts/models/copilot-fusion>
- GitHub changelog, Copilot Fusion GA (2026-10-28): <https://github.blog/changelog/2026-10-28-route-and-orchestrate-models-with-github-copilot-fusion/>
- VentureBeat, Copilot Fusion cost/quality measurement (2026-10-28): <https://venturebeat.com/orchestration/github-copilot-fusion-mixes-models-to-achieve-near-opus-5-5-coding-performance-at-half-the-per-task-cost>
- Self-MoA, on when mixing models can lower quality: <https://arxiv.org/abs/2502.00674>

The measurements above are for the referenced products. This plugin implements the lead/sidekick structure, not their routers, so use them as a guide to the pattern's potential and measure your own split.

## License

Apache-2.0. See [LICENSE](LICENSE).
