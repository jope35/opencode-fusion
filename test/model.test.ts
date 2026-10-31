import test from "node:test"
import assert from "node:assert/strict"

import { assertModelsKnown, parseModelRef } from "../src/model.ts"

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
