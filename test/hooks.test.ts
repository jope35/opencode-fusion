import test from "node:test"
import assert from "node:assert/strict"

import { FUSION_RULES, applyContextHook, applySubagentModelHook } from "../src/hooks.ts"

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
