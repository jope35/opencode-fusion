import test from "node:test"
import assert from "node:assert/strict"

import { setup, type FusionContext } from "../src/index.ts"
import type { AgentEditorLike, AgentLike } from "../src/agents.ts"
import type { PermissionRule } from "../src/options.ts"

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

function makeFakeCtx(options: Record<string, any>, known: ReadonlyArray<{ providerID: string; id: string }> = [{ providerID: "anthropic", id: "claude-sonnet-5-5" }]) {
  const { editor, agents, defaults } = fakeEditor(["build", "plan"])
  const hooks = {
    tool: [] as Array<(event: { tool: string; input: unknown }) => void>,
    session: [] as Array<(event: { agent: string; system: { type: "text"; text: string }[] }) => void>,
  }
  const ctx: FusionContext = {
    options,
    model: { list: async () => ({ location: { directory: "/tmp" }, data: known }) },
    agent: {
      transform: async (cb) => {
        cb(editor)
        return {}
      },
    },
    tool: {
      hook: async (_name, cb) => {
        hooks.tool.push(cb)
        return {}
      },
    },
    session: {
      hook: async (_name, cb) => {
        hooks.session.push(cb)
        return {}
      },
    },
  }
  return { ctx, editor: { agents, defaults }, hooks }
}

test("valid options register agents and hooks", async () => {
  const { ctx, editor, hooks } = makeFakeCtx({ sidekicks: { writer: { model: "anthropic/claude-sonnet-5-5" } } })
  await setup(ctx)
  assert.ok(editor.agents.has("fusion"))
  assert.ok(editor.agents.has("fusion-writer"))
  assert.ok(!editor.agents.has("fusion-reader")) // no model, skipped
  assert.equal(hooks.tool.length, 1)
  assert.equal(hooks.session.length, 1)
})
test("context rules name only registered sidekicks", async () => {
  const { ctx, hooks } = makeFakeCtx({ sidekicks: { writer: { model: "anthropic/claude-sonnet-5-5" } } })
  await setup(ctx)
  const event = { agent: "fusion", system: [{ type: "text" as const, text: "base" }] }
  for (const hook of hooks.session) hook(event)
  const rules = event.system.at(-1)!.text
  assert.match(rules, /fusion-writer/)
  assert.doesNotMatch(rules, /fusion-reviewer|fusion-reader|fusion-search|fusion-summarizer/)
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
