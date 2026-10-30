import test from "node:test"
import assert from "node:assert/strict"

import { resolveOptions } from "../src/options.ts"

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
test("explicit empty permissions gets safe defaults", () => {
  const r = resolveOptions({ sidekicks: { docs: { model: "openai/gpt-5", permissions: [] } } })
  const d = r.sidekicks.find((s) => s.id === "fusion-docs")!
  assert.deepEqual(d.permissions, [{ action: "edit", resource: "*", effect: "deny" }, { action: "shell", resource: "*", effect: "deny" }])
})
test("all built-in agent ids are rejected as lead", () => {
  for (const id of ["build", "plan", "general", "explore", "compaction", "title", "summary"]) {
    assert.throws(() => resolveOptions({ lead: id }), /built-in/)
  }
})
test("lead/sidekick collisions, built-in leads, and bad names are rejected", () => {
  assert.throws(() => resolveOptions({ lead: "fusion-writer", sidekicks: { writer: { model: "openai/gpt-5" } } }), /lead/)
  assert.throws(() => resolveOptions({ lead: "build" }), /built-in/)
  assert.throws(() => resolveOptions({ sidekicks: { "bad name": { model: "openai/gpt-5" } } }), /sidekick name/)
  assert.throws(() => resolveOptions({ sidekicks: { constructor: { model: "openai/gpt-5" } } }), /sidekick name/)
})
