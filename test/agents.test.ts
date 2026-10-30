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
