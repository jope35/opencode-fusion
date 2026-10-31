# opencode-fusion plugin implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the npm package `opencode-fusion-agent`: an OpenCode V2 plugin that registers a primary lead agent `fusion` (default agent, no edit/shell, spawns only `fusion-*` sidekicks) plus one subagent per sidekick configured with a model in the plugin options, forces sidekick models through a tool hook, appends fusion rules to the lead's system prompt, and fails loudly at startup (throw; OpenCode's built-in TUI "Plugin failed" toast and `/plugins` details show the error) on an unknown sidekick model.

**Architecture:** One package with a server part only (`src/index.ts`). All behavior lives in pure modules (`src/options.ts`, `src/model.ts`, `src/agents.ts`, `src/hooks.ts`) that take structural types instead of the real plugin context, so every rule is unit-tested with `node --test` against fake editors and fake events. `src/index.ts` only wires those modules to the real `ctx`. There is no `src/tui.ts`: OpenCode's TUI only loads a package's `./tui` part when the server entry is `active`, so a TUI part cannot report a server startup failure (see Global Constraints).

**Tech Stack:** TypeScript with erasable syntax only (Node 22 strips types natively), `@opencode/plugin` pinned to exactly `2.2.4`, `node --test` for tests (no test framework dependency), `tsc --noEmit` for typecheck. API field shapes below were verified against `@opencode/schema` 2.2.4 (the types `@opencode/plugin@2.2.4` re-exports) and the V2 docs at opencode.ai/v2/docs.

**Spec:** `docs/superpowers/specs/2026-10-30-fusion-plugin-design.md`

## Global Constraints

- Package name `opencode-fusion-agent`, loaded through the object form in `plugins` (`{ "package": "opencode-fusion-agent", "options": { ... } }`); options are read from `ctx.options` (typed `Readonly<Record<string, any>>`).
- Server plugin API only: default export `Plugin.define({ id: "opencode-fusion", setup(ctx) })` from `@opencode/plugin`. Dependency `@opencode/plugin` pinned to `2.2.4`; every field used below was checked against that version's types.
- `AgentEditor` (from `ctx.agent.transform`) is `{ list(), get(id), default(id), update(id, fn), remove(id) }`. `list()` returns a **readonly** array. There is no `add`; `update` on an unknown id creates the agent with `Agent.Info.default(id)` (name defaults to the id, mode `primary`, hidden `false`, default permissions), so assigning the exact permission array is safe. Verified against `@opencode/plugin@2.2.4` and the Task 6 smoke test.
- `Agent.Info.model` is an object `{ providerID, id, variant? }`, not a string. The string form `providerID/modelID#variant` exists only in config and in the subagent tool input. `parseModelRef` returns `modelID`, so Task 3 must map it to the `id` field.
- Permission rule shape is `{ action: string, resource: string, effect: "allow" | "ask" | "deny" }`; the last matching rule wins, so allow-exceptions must come after broad denies, and the deny appended to other agents must be appended after their existing rules.
- Sidekick ids are `fusion-<name>`, mode `subagent`, never `hidden`. Lead id defaults to `fusion` (option `lead`), mode `primary`, set as default with `editor.default(leadId)`. The lead model comes only from the top-level config; the plugin never sets or locks the session model.
- A sidekick is registered only when the merged options give it a `model`. A missing model skips the sidekick silently. An unknown model throws at startup with an error message naming the sidekick and the model. Validation checks membership of `providerID/modelID` in **`(await ctx.model.list()).data`** — `ctx.model.list()` returns `{ location, data }`, not a bare array. The `#variant` suffix passes through unvalidated.
- If the model catalog is empty at setup (providers still loading), fail with a distinct "model catalog is empty" error instead of calling every configured model unknown; the user can restart once providers load. Do not silently skip validation.
- Only the `execute.before` tool hook may modify tool input. The hook event is `{ tool: string, sessionID, agent, messageID, id, input: unknown }` with mutable `input`. The subagent tool input carries `agent`, `description`, `prompt`, optional `model` (string), optional `sessionID`, optional `background`. The hook does not re-validate availability; the subagent tool's own `resolveModel` does and returns a ToolFailure at dispatch.
- Session hook `ctx.session.hook("context", ...)` receives `{ sessionID, agent, model, system: SystemPart[], messages, tools, options }`; append rules with `event.system.push({ type: "text", text })` only when `event.agent === leadId`.
- Subagent nesting depth stays at the default 1. The plugin does not touch the built-in `build` or `plan` agents beyond the appended `subagent fusion-*` deny.
- Startup failure surfacing is the **built-in TUI behavior**, not a custom TUI part. A server `setup` throw marks the plugin `state.status === "failed"` in `client.plugin.list`; the TUI already shows a "Plugin failed: <name>" toast and `/plugins` shows the error. OpenCode's TUI filters server plugins to `state.status === "active"` before loading their `./tui` part (`packages/tui/src/plugin/context.tsx`), so a TUI part cannot load when its server part failed. Ship no `./tui` export and no `src/tui.ts`/`src/failure.ts`. `Plugin.Info.state` is `{ status: "active" } | { status: "failed", error: string, ref?: string }`.
- Tests: `node --test test/*.test.ts` (Node 22.23 strips types by default; use `import type` for type-only imports and `.ts` extensions on relative imports). Typecheck: `npx tsc --noEmit`. Commit after every task with a conventional commit message.

## Review Focus

1. The lead tries to edit a file or run shell directly. Expected: denied by permissions, with `subagent fusion-*` allowed after the broad denies. Pinned by the exact permission-array assertion in Task 3.
2. A non-fusion agent (for example `build`) tries to spawn `fusion-writer`. Expected: denied because a `subagent fusion-*` deny is appended after every other agent's rules. Pinned in Task 3.
3. The lead passes an explicit `model` in a subagent call. Expected: the plugin config wins and overwrites it. Pinned in Task 4.
4. A configured sidekick model is unknown at startup. Expected: setup throws naming sidekick and model; `plugin.list` state is `failed`, and the built-in TUI "Plugin failed" toast plus `/plugins` details show it. Pinned in Tasks 2 and 5; verified end to end in the Task 6 smoke test.
5. A sidekick entry has no model, or a model carries a `#variant`. Expected: the model-less sidekick is skipped without error; the variant passes through unvalidated. Pinned in Tasks 1 and 2.

Note: "`editor.update` creates an unknown agent" is only verifiable against real OpenCode, so the Task 6 smoke test pins it end to end.

## Verification and validation

- Success criteria: `npm test` and `npx tsc --noEmit` pass; the lead registers as default with the exact deny/allow permission array; every configured sidekick registers with its parsed model, prompt, permissions, `mode: "subagent"`, and `hidden: false`; a sidekick without a model is absent; a bogus model rejects before any agent is registered; the subagent hook overwrites an explicit model; the lead context gains `FUSION_RULES` and other agents do not.
- Automated tests: `node --test test/*.test.ts` covers options merging/validation, model parsing and membership, the exact lead and sidekick shapes, the other-agent deny, the tool hook, the context hook, and setup order. The `Plugin.Context` assignment in `src/index.ts` is the compile-time contract check.
- Security checks: assert the lead's exact permission array and the appended `subagent fusion-*` deny on other agents; assert custom sidekicks without permissions get the deny-edit/deny-shell defaults; note that `execute` (Code Mode) cannot bypass these because nested built-in tools enforce the agent's permissions (docs: Tools > Execute).
- Manual smoke: Task 6 checklist against `opencode v2.2.4`, including the built-in TUI failure toast/`/plugins` details; record pass/fail in `docs/smoke-test.md`.
- Gates and ownership: the implementer runs the automated suite after every task and the smoke test before publishing. A failing test, typecheck, or smoke checkbox blocks the next task or the publish. No rollout flag is needed; the plugin is opt-in through `plugins`.

### Assumptions and evidence gaps

- `ctx.model.list()` is complete during `setup`. Verified against the V2 plugin docs ("registry reads reflect every registration so far") but not against a cold provider cache; the distinct empty-catalog error and README restart note are the fallback.
- `editor.update` on an unknown id creates an agent with `Agent.Info.default(id)`. Verified in `packages/core/src/agent.ts` (the editor uses `Info.default(id)`); the smoke test still pins it against the installed runtime.
- The subagent tool honors a mutated `event.input.model` from `execute.before`. Verified in the tool schema/source; the smoke test pins the child-session model.
- The built-in TUI failure toast/`/plugins` details are the only visible surfacing. Verified in `packages/tui/src/plugin/context.tsx`; the TUI part cannot load on a failed server entry.
- `execute` (Code Mode) does not bypass the lead's edit/shell deny; the docs state nested tools enforce their own permissions. No runtime test; the smoke test's lead-edit case is the check.
- `@opencode/plugin@2.2.4` matches the installed `opencode` runtime. If the smoke test runs `opencode v2.2.4`, the field shapes should match; any mismatch is an evidence gap to resolve before publishing.

---

### Task 1: Package scaffolding and options module

**Files:**
- Create: `package.json`, `tsconfig.json`, `src/options.ts`, `test/options.test.ts`

**Interfaces:**
- Produces:
  - `interface PermissionRule { action: string; resource: string; effect: "allow" | "ask" | "deny" }`
  - `interface SidekickOptions { model?: string; description?: string; prompt?: string; permissions?: PermissionRule[] }`
  - `interface ResolvedSidekick { name: string; id: string; model?: string; description: string; prompt: string; permissions: PermissionRule[] }`
  - `type ConfiguredSidekick = ResolvedSidekick & { model: string }` — the subset that will actually be registered; use it instead of non-null assertions.
  - `type BuiltinSidekick = SidekickOptions & { description: string; prompt: string; permissions: PermissionRule[] }`
  - `BUILTIN_SIDEKICKS: Record<string, BuiltinSidekick>` with keys `writer`, `reviewer`, `reader`, `search`, `summarizer`, each carrying `description`, `prompt`, and default `permissions` but no `model`.
  - `resolveOptions(options: { lead?: string; sidekicks?: Record<string, SidekickOptions> }): { leadId: string; sidekicks: ResolvedSidekick[] }` — `leadId` defaults to `"fusion"`, `id` is `` `fusion-${name}` ``, user entries merge over built-ins by name with the user entry winning on every key it sets. A custom sidekick with no `permissions` gets a copy of the reviewer defaults (deny edit and shell), not an empty array; a custom sidekick with no `description`/`prompt` gets a non-empty name-based fallback. Every resolved sidekick gets its own copy of its permissions array so later agent edits cannot mutate a shared default. Reject sidekick names and `lead` values that do not match `^[a-z0-9][a-z0-9-]*$`, reject a `lead` that equals a **registered** sidekick id (for example `lead: "fusion-writer"` with a `writer` sidekick that has a model), and reject `lead: "build"` or `lead: "plan"` so the plugin never rewrites a built-in agent.
- Pinned default permissions per role: writer `[{edit,*,allow},{shell,*,allow}]`; reviewer `[{edit,*,deny},{shell,*,deny}]`; reader adds `{webfetch,*,deny},{websearch,*,deny}` to reviewer's; search is reviewer's list; summarizer is `[{edit,*,deny},{webfetch,*,deny},{websearch,*,deny},{shell,*,allow}]` (read and execute, no web, no edit).
- Pinned validation errors: `invalid sidekick name: <name>`, `lead id <id> collides with sidekick <id>`, and `lead id <id> is a built-in agent`. The tests match these substrings.
- Use `Object.hasOwn(BUILTIN_SIDEKICKS, name)` (or a null-prototype map) for built-in lookup so names such as `constructor` or `__proto__` cannot pick up `Object.prototype`; reject `constructor`, `prototype`, and `__proto__` explicitly with the same `invalid sidekick name: <name>` message.
- Pinned default prompts (one or two sentences each): writer implements and tests changes; reviewer reports findings in severity order without editing; reader reads and reports without editing or commands; search researches via web tools; summarizer summarizes.

- [ ] **Step 1: Write the failing test** in `test/options.test.ts` (imports `node:test`, `node:assert/strict`, and `../src/options.ts`):

```ts
test("defaults: lead fusion, five sidekicks, no models", () => {
  const r = resolveOptions({})
  assert.equal(r.leadId, "fusion")
  assert.deepEqual(r.sidekicks.map((s) => s.id), ["fusion-writer", "fusion-reviewer", "fusion-reader", "fusion-search", "fusion-summarizer"])
  assert.ok(r.sidekicks.every((s) => s.model === undefined))
})
test("user model and per-key overrides win", () => {
  const r = resolveOptions({ sidekicks: { writer: { model: "anthropic/claude-sonnet-5-5", prompt: "custom" } } })
  const w = r.sidekicks.find((s) => s.id === "fusion-writer")!
  assert.equal(w.model, "anthropic/claude-sonnet-5-5")
  assert.equal(w.prompt, "custom")
  assert.ok(w.description.length > 0) // default kept
})
test("custom sidekick is added", () => {
  const r = resolveOptions({ sidekicks: { docs: { model: "openai/gpt-5", description: "d", prompt: "p", permissions: [] } } })
  assert.ok(r.sidekicks.some((s) => s.id === "fusion-docs" && s.model === "openai/gpt-5"))
})
test("default permissions per role", () => {
  const r = resolveOptions({})
  const by = Object.fromEntries(r.sidekicks.map((s) => [s.name, s.permissions]))
  assert.deepEqual(by.writer, [{ action: "edit", resource: "*", effect: "allow" }, { action: "shell", resource: "*", effect: "allow" }])
  assert.deepEqual(by.reviewer, [{ action: "edit", resource: "*", effect: "deny" }, { action: "shell", resource: "*", effect: "deny" }])
  assert.deepEqual(by.reader, [
    { action: "edit", resource: "*", effect: "deny" },
    { action: "shell", resource: "*", effect: "deny" },
    { action: "webfetch", resource: "*", effect: "deny" },
    { action: "websearch", resource: "*", effect: "deny" },
  ])
  assert.deepEqual(by.search, [{ action: "edit", resource: "*", effect: "deny" }, { action: "shell", resource: "*", effect: "deny" }])
  assert.deepEqual(by.summarizer, [
    { action: "edit", resource: "*", effect: "deny" },
    { action: "webfetch", resource: "*", effect: "deny" },
    { action: "websearch", resource: "*", effect: "deny" },
    { action: "shell", resource: "*", effect: "allow" },
  ])
})
test("custom sidekick without permissions or copy gets safe defaults", () => {
  const r = resolveOptions({ sidekicks: { docs: { model: "openai/gpt-5" } } })
  const d = r.sidekicks.find((s) => s.id === "fusion-docs")!
  assert.deepEqual(d.permissions, [{ action: "edit", resource: "*", effect: "deny" }, { action: "shell", resource: "*", effect: "deny" }])
  assert.ok(d.description.length > 0)
  assert.ok(d.prompt.length > 0)
})
test("lead/sidekick collisions, built-in leads, and bad names are rejected", () => {
  assert.throws(() => resolveOptions({ lead: "fusion-writer", sidekicks: { writer: { model: "openai/gpt-5" } } }), /lead/)
  assert.throws(() => resolveOptions({ lead: "build" }), /built-in/)
  assert.throws(() => resolveOptions({ sidekicks: { "bad name": { model: "openai/gpt-5" } } }), /sidekick name/)
  assert.throws(() => resolveOptions({ sidekicks: { constructor: { model: "openai/gpt-5" } } }), /sidekick name/)
})
```

- [ ] **Step 2: Run to verify failure.** Run: `node --test test/options.test.ts`. Expected: FAIL, `resolveOptions` is not a function.
- [ ] **Step 3: Create `package.json` and `tsconfig.json`, then implement `src/options.ts`.** `package.json`: name `opencode-fusion-agent`, version `0.1.0`, `"type": "module"`, exports `{ ".": "./src/index.ts" }` (no `./tui`), `files: ["src"]`, scripts `{ "test": "node --test test/*.test.ts", "typecheck": "tsc --noEmit" }`, dependencies `{ "@opencode/plugin": "2.2.4" }`, devDependencies `{ "typescript": "^5.9.0", "@types/node": "^22.0.0" }` (versions pinned so `tsc` does not drift). `tsconfig.json`: strict, `target` `ES2022`, `lib: ["ES2022"]`, `module`/`moduleResolution` `NodeNext`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `noEmit`, `skipLibCheck`, `types: ["node"]`, include `src` and `test`. Implement the interfaces exactly as pinned above. Run `npm install` once so `@opencode/plugin` types resolve for the typecheck.
- [ ] **Step 4: Run tests and typecheck.** Run: `node --test test/options.test.ts` (PASS) and `npx tsc --noEmit` (PASS, may need a one-line stub export in `src/index.ts` — create it now, replaced in Task 5).
- [ ] **Step 5: Commit.** `git add package.json tsconfig.json src test && git commit -m "feat: scaffold opencode-fusion-agent package and options module"`

### Task 2: Model ref parsing and startup validation

**Files:**
- Create: `src/model.ts`, `test/model.test.ts`

**Interfaces:**
- Consumes: `ResolvedSidekick` from Task 1 (uses `name` and `model`).
- Produces:
  - `parseModelRef(ref: string): { providerID: string; modelID: string; variant?: string }` — splits on the first `/` and an optional trailing `#variant`; throws on a ref without `/` or with an empty provider/model part.
  - `assertModelsKnown(sidekicks: ReadonlyArray<{ name: string; model: string }>, known: ReadonlyArray<{ providerID: string; id: string }>): void` — for each sidekick, parses `model`, requires `${providerID}/${modelID}` in `known`, otherwise throws `Error` whose message contains the sidekick name and the full model string. A malformed ref is wrapped the same way. The variant is not validated. Callers pass `(await ctx.model.list()).data`; the function itself takes the array.

- [ ] **Step 1: Write the failing test** in `test/model.test.ts`:

```ts
test("parse with and without variant", () => {
  assert.deepEqual(parseModelRef("anthropic/claude-sonnet-5-5#high"), { providerID: "anthropic", modelID: "claude-sonnet-5-5", variant: "high" })
  assert.deepEqual(parseModelRef("openai/gpt-5"), { providerID: "openai", modelID: "gpt-5", variant: undefined })
})
test("parse rejects malformed ref", () => {
  assert.throws(() => parseModelRef("no-slash"), /providerID\/modelID/)
  assert.throws(() => parseModelRef("/model"), /providerID\/modelID/)
  assert.throws(() => parseModelRef("provider/"), /providerID\/modelID/)
})
test("unknown model throws naming sidekick and model", () => {
  assert.throws(
    () => assertModelsKnown([{ name: "writer", model: "acme/nope#fast" }], [{ providerID: "anthropic", id: "claude-sonnet-5-5" }]),
    (e: Error) => e.message.includes("writer") && e.message.includes("acme/nope#fast"),
  )
})
test("malformed model also names the sidekick", () => {
  assert.throws(
    () => assertModelsKnown([{ name: "writer", model: "nope" }], []),
    (e: Error) => e.message.includes("writer") && e.message.includes("nope"),
  )
})
test("known model passes, variant ignored in membership", () => {
  assertModelsKnown([{ name: "writer", model: "anthropic/claude-sonnet-5-5#high" }], [{ providerID: "anthropic", id: "claude-sonnet-5-5" }])
})
```

- [ ] **Step 2:** Run `node --test test/model.test.ts`, expect FAIL.
- [ ] **Step 3:** Implement `src/model.ts` per the signatures above. Keep the `modelID` name here; Task 3 maps it to `Agent.Info.model.id`.
- [ ] **Step 4:** Run `node --test test/model.test.ts` and `npx tsc --noEmit`, expect PASS.
- [ ] **Step 5:** Commit: `git add src/model.ts test/model.test.ts && git commit -m "feat: model ref parsing and startup validation"`

### Task 3: Agent registration (lead, sidekicks, other-agent deny)

**Files:**
- Create: `src/agents.ts`, `test/agents.test.ts`

**Interfaces:**
- Consumes: `ResolvedSidekick`, `ConfiguredSidekick`, `PermissionRule` from Task 1; `parseModelRef` from Task 2.
- Produces structural types (the real `AgentEditor` is compatible):

```ts
interface AgentLike {
  id: string
  mode?: "primary" | "subagent" | "all"
  description?: string
  system?: string
  model?: { providerID: string; id: string; variant?: string }
  hidden?: boolean
  permissions?: PermissionRule[]
  [key: string]: unknown
}
interface AgentEditorLike {
  list(): readonly AgentLike[]
  get(id: string): AgentLike | undefined
  default(id: string | undefined): void
  update(id: string, update: (agent: AgentLike) => void): void
}
function registerAgents(editor: AgentEditorLike, leadId: string, sidekicks: ConfiguredSidekick[]): void
```

- `list()` is readonly to match the real `AgentEditor.list(): readonly Types.DeepMutable<Agent.Info>[]`. With a mutable `AgentLike[]`, the real editor is not assignable and `tsc` fails.
- `ConfiguredSidekick` (not `ResolvedSidekick`) is the parameter type, so a model-less sidekick cannot reach `parseModelRef(sidekick.model)`; no non-null assertion.
- `registerAgents` does, in one call: `editor.update(leadId, ...)` sets `mode: "primary"`, a lead description, and exactly `permissions: [{action:"edit",resource:"*",effect:"deny"},{action:"shell",resource:"*",effect:"deny"},{action:"subagent",resource:"*",effect:"deny"},{action:"subagent",resource:"fusion-*",effect:"allow"}]`; then `editor.default(leadId)`; then for every agent in `editor.list()` whose id is not `leadId`, `editor.update(other.id, ...)` appends `{action:"subagent",resource:"fusion-*",effect:"deny"}` after its existing permissions (`(agent.permissions ??= []).push(...)`); then for each sidekick `editor.update(sidekick.id, ...)` sets `mode: "subagent"`, `model: { providerID: ref.providerID, id: ref.modelID, variant: ref.variant }` where `ref = parseModelRef(sidekick.model)` (the real field is `id`, not `modelID`), `system: sidekick.prompt`, `description: sidekick.description`, `permissions: sidekick.permissions`, and `hidden: false`.

- [ ] **Step 1: Write the failing test** in `test/agents.test.ts` with a fake editor that records `default()` calls and applies `update` to an in-memory map (pre-seeded with `build` and `plan`):

```ts
function fakeEditor(ids: string[]) {
  const agents = new Map<string, AgentLike>(ids.map((id) => [id, { id, permissions: [{ action: "*", resource: "*", effect: "allow" }] as PermissionRule[] }]))
  const defaults: (string | undefined)[] = []
  return {
    defaults,
    agents,
    editor: {
      list: () => [...agents.values()],
      get: (id: string) => agents.get(id),
      default: (id: string | undefined) => void defaults.push(id),
      update: (id: string, fn: (a: AgentLike) => void) => {
        const a: AgentLike = agents.get(id) ?? { id }
        fn(a)
        agents.set(id, a)
      },
    } as AgentEditorLike,
  }
}
test("lead registered, defaulted, and locked down", () => {
  const { editor, agents, defaults } = fakeEditor(["build", "plan"])
  registerAgents(editor, "fusion", [{ name: "writer", id: "fusion-writer", model: "anthropic/claude-sonnet-5-5#high", description: "d", prompt: "p", permissions: [] }])
  const lead = agents.get("fusion")!
  assert.equal(lead.mode, "primary")
  assert.deepEqual(lead.permissions, [
    { action: "edit", resource: "*", effect: "deny" },
    { action: "shell", resource: "*", effect: "deny" },
    { action: "subagent", resource: "*", effect: "deny" },
    { action: "subagent", resource: "fusion-*", effect: "allow" },
  ])
  assert.deepEqual(defaults, ["fusion"])
})
test("other agents get appended fusion deny; sidekick shape", () => {
  const { editor, agents } = fakeEditor(["build", "plan"])
  registerAgents(editor, "fusion", [{ name: "writer", id: "fusion-writer", model: "anthropic/claude-sonnet-5-5#high", description: "writes", prompt: "do it", permissions: [{ action: "edit", resource: "*", effect: "allow" }] }])
  for (const id of ["build", "plan"]) {
    const last = agents.get(id)!.permissions!.at(-1)!
    assert.deepEqual(last, { action: "subagent", resource: "fusion-*", effect: "deny" })
  }
  const w = agents.get("fusion-writer")!
  assert.equal(w.mode, "subagent")
  assert.deepEqual(w.model, { providerID: "anthropic", id: "claude-sonnet-5-5", variant: "high" })
  assert.equal(w.system, "do it")
  assert.equal(w.hidden, false)
})
```

- [ ] **Step 2:** Run `node --test test/agents.test.ts`, expect FAIL.
- [ ] **Step 3:** Implement `src/agents.ts` per the signatures above.
- [ ] **Step 4:** Run `node --test test/agents.test.ts` and `npx tsc --noEmit`, expect PASS.
- [ ] **Step 5:** Commit: `git add src/agents.ts test/agents.test.ts && git commit -m "feat: register fusion lead and sidekicks, deny fusion sidekicks for other agents"`

### Task 4: Tool hook and session context hook

**Files:**
- Create: `src/hooks.ts`, `test/hooks.test.ts`

**Interfaces:**
- Consumes: sidekick ids and model strings from Tasks 1–2.
- Produces:
  - `FUSION_RULES: string` — pinned text: the lead plans and reviews; never edits files or runs shell directly; delegates mechanical work (writing, commands, review, reading, search, summarizing) to the matching `fusion-*` sidekick via the subagent tool; expects results back and accepts, re-dispatches with clearer instructions, or escalates to the user; all writes go through the writer sidekick so writes stay single threaded.
  - `applySubagentModelHook(event: { tool: string; input: unknown }, models: ReadonlyMap<string, string>): void` — when `event.tool === "subagent"`, `event.input` is a non-null object, and `(event.input as { agent?: unknown }).agent` is a key of `models`, set `(event.input as { model?: string }).model` to the configured model string, overwriting any model the lead passed. The hook does not re-check availability; the subagent tool's `resolveModel` parses and checks the model/variant, returning a ToolFailure at dispatch if it is still unknown.
  - `applyContextHook(event: { agent: string; system: { type: "text"; text: string }[] }, leadId: string): void` — when `event.agent === leadId`, push `{ type: "text", text: FUSION_RULES }` onto `event.system`.

- [ ] **Step 1: Write the failing test** in `test/hooks.test.ts`:

```ts
test("subagent call to fusion sidekick gets configured model, overwriting lead's", () => {
  const models = new Map([["fusion-writer", "anthropic/claude-sonnet-5-5"]])
  const event = { tool: "subagent", input: { agent: "fusion-writer", model: "openai/gpt-5", prompt: "x" } }
  applySubagentModelHook(event, models)
  assert.equal((event.input as any).model, "anthropic/claude-sonnet-5-5")
})
test("other tools and agents untouched", () => {
  const models = new Map([["fusion-writer", "m"]])
  const a = { tool: "read", input: { agent: "fusion-writer" } }
  const b = { tool: "subagent", input: { agent: "build", model: "openai/gpt-5" } }
  applySubagentModelHook(a, models)
  applySubagentModelHook(b, models)
  assert.equal((a.input as any).model, undefined)
  assert.equal((b.input as any).model, "openai/gpt-5")
})
test("non-object input does not throw", () => {
  applySubagentModelHook({ tool: "subagent", input: null }, new Map())
  applySubagentModelHook({ tool: "subagent", input: "x" }, new Map())
})
test("context hook appends rules only for the lead", () => {
  const lead = { agent: "fusion", system: [{ type: "text" as const, text: "base" }] }
  const other = { agent: "build", system: [{ type: "text" as const, text: "base" }] }
  applyContextHook(lead, "fusion")
  applyContextHook(other, "fusion")
  assert.equal(lead.system.length, 2)
  assert.equal(lead.system[1].text, FUSION_RULES)
  assert.equal(other.system.length, 1)
})
```

- [ ] **Step 2:** Run `node --test test/hooks.test.ts`, expect FAIL.
- [ ] **Step 3:** Implement `src/hooks.ts`.
- [ ] **Step 4:** Run `node --test test/hooks.test.ts` and `npx tsc --noEmit`, expect PASS.
- [ ] **Step 5:** Commit: `git add src/hooks.ts test/hooks.test.ts && git commit -m "feat: force sidekick models in execute.before and append fusion rules to lead context"`

### Task 5: Server entry wiring (`src/index.ts`)

**Files:**
- Modify: `src/index.ts` (replace stub)
- Create: `test/index.test.ts`

**Interfaces:**
- Consumes: `resolveOptions` (Task 1), `assertModelsKnown` (Task 2), `registerAgents`, `ConfiguredSidekick` (Task 3), `applySubagentModelHook`, `applyContextHook` (Task 4).
- Produces: exported `setup(ctx: FusionContext): Promise<void>` and default export `Plugin.define({ id: "opencode-fusion", setup })` from `@opencode/plugin`. Structural context so tests can fake it:

```ts
interface FusionContext {
  options: Readonly<Record<string, any>>
  model: { list(): Promise<{ data: ReadonlyArray<{ providerID: string; id: string }> }> }
  agent: { transform(cb: (editor: AgentEditorLike) => void): Promise<unknown> }
  tool: { hook(name: "execute.before", cb: (event: { tool: string; input: unknown }) => void): Promise<unknown> }
  session: { hook(name: "context", cb: (event: { agent: string; system: { type: "text"; text: string }[] }) => void): Promise<unknown> }
}
```

- `ctx.model.list()` returns `ModelListOutput` (`{ location, data }`), not an array. Use `.data`; a fake that returns a bare array hides a real runtime failure.
- Add a compile-time compatibility check so the structural context cannot drift from the real plugin context: `const _context: (ctx: Plugin.Context) => Promise<void> = setup` (import `type { Plugin }` from `@opencode/plugin`), then `void _context`. This fails `tsc` if `FusionContext` stops matching the real `Context`, including the `.data` shape and the readonly editor list.
- `setup` order: `resolveOptions(ctx.options)`; keep only sidekicks with a model using a type predicate, `const withModel = sidekicks.filter((s): s is ConfiguredSidekick => s.model !== undefined)`; read `const known = (await ctx.model.list()).data` and, only when `withModel.length > 0`, throw `Error("model catalog is empty; providers may still be loading")` if `known.length === 0`; `assertModelsKnown(withModel, known)` (throws before anything is registered); `await ctx.agent.transform((editor) => registerAgents(editor, leadId, withModel))`; build `models = new Map(withModel.map((s) => [s.id, s.model]))`; register the two hooks delegating to Task 4.

- [ ] **Step 1: Write the failing test** in `test/index.test.ts` with a fake `FusionContext` (fake editor as in Task 3, recorded hook callbacks):

```ts
test("valid options register agents and hooks", async () => {
  const { ctx, editor, hooks } = makeFakeCtx({ sidekicks: { writer: { model: "anthropic/claude-sonnet-5-5" } } })
  await setup(ctx)
  assert.ok(editor.agents.has("fusion"))
  assert.ok(editor.agents.has("fusion-writer"))
  assert.ok(!editor.agents.has("fusion-reader")) // no model, skipped
  assert.equal(hooks.tool.length, 1)
  assert.equal(hooks.session.length, 1)
})
test("unknown sidekick model rejects and names sidekick and model", async () => {
  const { ctx, editor } = makeFakeCtx({ sidekicks: { writer: { model: "acme/nope" } } })
  await assert.rejects(setup(ctx), (e: Error) => e.message.includes("writer") && e.message.includes("acme/nope"))
  assert.ok(!editor.agents.has("fusion")) // validation runs before registration
})
test("empty model catalog rejects distinctly", async () => {
  const { ctx } = makeFakeCtx({ sidekicks: { writer: { model: "anthropic/claude-sonnet-5-5" } } }, [])
  await assert.rejects(setup(ctx), /catalog is empty/i)
})
```

`makeFakeCtx(options, known = [{ providerID: "anthropic", id: "claude-sonnet-5-5" }])` must implement `model.list` as `async () => ({ location: { directory: "/tmp" }, data: known })`, matching the real `ModelListOutput`. It returns `{ ctx, editor }` where `editor` is the `fakeEditor(...)` result from Task 3; type `ctx` as `FusionContext`, and have `ctx.agent.transform` call `cb(editor.editor)` so the test can assert on `editor.agents`.

- [ ] **Step 2:** Run `node --test test/index.test.ts`, expect FAIL.
- [ ] **Step 3:** Implement `src/index.ts` per the above.
- [ ] **Step 4:** Run `npm test` and `npx tsc --noEmit`, expect PASS.
- [ ] **Step 5:** Commit: `git add src/index.ts test/index.test.ts && git commit -m "feat: wire server plugin setup with startup model validation"`

### Task 6: README, example config, and end-to-end smoke test

**Files:**
- Modify: `README.md`
- Create: `docs/smoke-test.md`

**Interfaces:**
- Consumes: the package loaded by path entry in a scratch project (raw TypeScript exports are supported; no build step).

- [ ] **Step 1: Rewrite `README.md`** with: what the plugin does (lead/sidekick split), install (`npm install opencode-fusion-agent` once published, or path entry `{"package": "./path/to/opencode-fusion-agent", "options": {...}}`), a full `opencode.jsonc` example showing `plugins` object form with `options.lead` and `options.sidekicks` including models, the rule that a sidekick registers only with an explicit model (and that omitting `writer` leaves the lead read-only by design), the safe defaults for custom sidekicks, startup failure behavior (**built-in TUI "Plugin failed" toast; run `/plugins` to see the error text** — there is no custom TUI part), the requirement that the model catalog be ready at startup (if a known-good model is reported unknown right after install, restart once provider catalogs finish loading), and the dev scripts (`npm test`, `npm run typecheck`).
- [ ] **Step 2: Write `docs/smoke-test.md`** with this checklist, run against the locally installed **`opencode v2.2.4`** (match the pinned plugin API; do not use 2.2.3) in a scratch dir (for example `/tmp/opencode-fusion-smoke`) whose `opencode.json` loads the plugin by absolute path with one sidekick model taken from that machine's `opencode models` output:
  - [ ] `editor.update` creates agents: after starting `opencode` in the scratch dir, `opencode api agent.list` (or the TUI agent list) shows `fusion` and `fusion-writer`. The first agent in `agent.list` is the selected default, so assert `fusion` is first.
  - [ ] `fusion` is the default agent for a new session.
  - [ ] `fusion-writer` appears in the subagent catalog (not hidden).
  - [ ] A prompt to the lead that asks it to edit a file is denied (permission deny), and a subagent call to `fusion-writer` runs on the configured model (visible in the child session).
  - [ ] With a bogus sidekick model (`"acme/nope"`), startup marks the plugin failed: `opencode api plugin.list` shows `state.status === "failed"` with the sidekick/model error, the TUI shows the built-in "Plugin failed" toast, and `/plugins` displays the error text.
- [ ] **Step 3: Run the full suite.** Run: `npm test` and `npm run typecheck`. Expected: all PASS.
- [ ] **Step 4: Execute the smoke test** in the scratch dir and record the results (pass/fail per checkbox) in `docs/smoke-test.md`.
- [ ] **Step 5:** Commit: `git add README.md docs/smoke-test.md && git commit -m "docs: README, config example, and smoke test for opencode-fusion-agent"`
