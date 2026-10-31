import test from "node:test"
import assert from "node:assert/strict"

import { fusionRules, applyContextHook, applySubagentModelHook } from "../src/hooks.ts"

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
  const rules = fusionRules([])
  const lead = { agent: "fusion", system: [{ type: "text" as const, text: "base" }] }
  const other = { agent: "build", system: [{ type: "text" as const, text: "base" }] }
  applyContextHook(lead, "fusion", rules)
  applyContextHook(other, "fusion", rules)
  assert.equal(lead.system.length, 2)
  assert.equal(lead.system[1].text, rules)
  assert.equal(other.system.length, 1)
})
test("rules name only the configured sidekicks", () => {
  const rules = fusionRules([
    { id: "fusion-writer", description: "Implements code changes and writes tests." },
    { id: "fusion-docs", description: "Writes documentation" },
  ])
  assert.match(rules, /fusion-writer implements code changes and writes tests/)
  assert.match(rules, /fusion-docs writes documentation/)
  assert.match(rules, /all writes go through the fusion-writer sidekick/)
  assert.doesNotMatch(rules, /fusion-reviewer|fusion-reader|fusion-search|fusion-summarizer/)
})
test("rules do not claim a writer when it is not configured", () => {
  const rules = fusionRules([{ id: "fusion-reviewer", description: "Reviews code and reports findings." }])
  assert.doesNotMatch(rules, /all writes go through/)
  assert.match(rules, /Never edit files or run shell commands directly\./)
  assert.match(rules, /fusion-reviewer reviews code and reports findings/)
})
test("rules without sidekicks do not point at missing agents", () => {
  const rules = fusionRules([])
  assert.doesNotMatch(rules, /fusion-writer|Delegate mechanical work/)
  assert.match(rules, /No fusion sidekicks are registered/)
})
