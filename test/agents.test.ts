import test from "node:test"
import assert from "node:assert/strict"

import { registerAgents, type AgentEditorLike, type AgentLike } from "../src/agents.ts"
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
        const a: AgentLike = agents.get(id) ?? { id, permissions: [{ action: "*", resource: "*", effect: "allow" }] as PermissionRule[] }
        fn(a)
        agents.set(id, a)
      },
    } as AgentEditorLike,
  }
}
test("lead registered, defaulted, and locked down without wiping user rules", () => {
  const { editor, agents, defaults } = fakeEditor(["build", "plan"])
  registerAgents(editor, "fusion", [{ name: "writer", id: "fusion-writer", model: "anthropic/claude-sonnet-5-5#high", description: "d", prompt: "p", permissions: [] }])
  const lead = agents.get("fusion")!
  assert.equal(lead.mode, "primary")
  assert.deepEqual(lead.permissions, [
    { action: "*", resource: "*", effect: "allow" },
    { action: "edit", resource: "*", effect: "deny" },
    { action: "shell", resource: "*", effect: "deny" },
    { action: "subagent", resource: "*", effect: "deny" },
    { action: "subagent", resource: "fusion-*", effect: "allow" },
  ])
  assert.deepEqual(defaults, ["fusion"])
})
test("other agents get appended fusion deny; sidekick shape and recursion guard", () => {
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
  assert.deepEqual(w.permissions, [
    { action: "edit", resource: "*", effect: "allow" },
    { action: "subagent", resource: "fusion-*", effect: "deny" },
  ])
})
test("existing agent with a fusion id is rejected instead of overwritten", () => {
  const { editor, defaults } = fakeEditor(["build", "plan", "fusion"])
  assert.throws(
    () => registerAgents(editor, "fusion", [{ name: "writer", id: "fusion-writer", model: "anthropic/claude-sonnet-5-5", description: "d", prompt: "p", permissions: [] }]),
    /fusion already exists/,
  )
  assert.deepEqual(defaults, [])
})
test("existing sidekick id is rejected instead of overwritten", () => {
  const { editor } = fakeEditor(["build", "fusion-writer"])
  assert.throws(
    () => registerAgents(editor, "fusion", [{ name: "writer", id: "fusion-writer", model: "anthropic/claude-sonnet-5-5", description: "d", prompt: "p", permissions: [] }]),
    /fusion-writer already exists/,
  )
})
test("re-running registration on the same editor does not throw or duplicate rules", () => {
  const { editor, agents } = fakeEditor(["build", "plan"])
  const sidekicks = [{ name: "writer", id: "fusion-writer", model: "anthropic/claude-sonnet-5-5", description: "d", prompt: "p", permissions: [] }]
  registerAgents(editor, "fusion", sidekicks)
  registerAgents(editor, "fusion", sidekicks)
  assert.deepEqual(agents.get("fusion")!.permissions, [
    { action: "*", resource: "*", effect: "allow" },
    { action: "edit", resource: "*", effect: "deny" },
    { action: "shell", resource: "*", effect: "deny" },
    { action: "subagent", resource: "*", effect: "deny" },
    { action: "subagent", resource: "fusion-*", effect: "allow" },
  ])
  assert.equal(agents.get("build")!.permissions!.filter((rule) => rule.effect === "deny").length, 1)
})
