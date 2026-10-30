import { Plugin } from "@opencode/plugin"

import { registerAgents, type AgentEditorLike } from "./agents.ts"
import { applyContextHook, applySubagentModelHook } from "./hooks.ts"
import { assertModelsKnown } from "./model.ts"
import { resolveOptions, type ConfiguredSidekick } from "./options.ts"

export interface FusionContext {
  options: Readonly<Record<string, any>>
  model: { list(): Promise<{ data: ReadonlyArray<{ providerID: string; id: string }> }> }
  agent: { transform(cb: (editor: AgentEditorLike) => void): Promise<unknown> }
  tool: { hook(name: "execute.before", cb: (event: { tool: string; input: unknown }) => void): Promise<unknown> }
  session: { hook(name: "context", cb: (event: { agent: string; system: { type: "text"; text: string }[] }) => void): Promise<unknown> }
}

export async function setup(ctx: FusionContext): Promise<void> {
  const { leadId, sidekicks } = resolveOptions(ctx.options)
  const withModel = sidekicks.filter((s): s is ConfiguredSidekick => s.model !== undefined)

  const known = (await ctx.model.list()).data
  if (withModel.length > 0 && known.length === 0) {
    throw new Error("model catalog is empty; providers may still be loading")
  }
  assertModelsKnown(withModel, known)

  await ctx.agent.transform((editor) => registerAgents(editor, leadId, withModel))

  const models = new Map(withModel.map((s) => [s.id, s.model]))
  await ctx.tool.hook("execute.before", (event) => applySubagentModelHook(event, models))
  await ctx.session.hook("context", (event) => applyContextHook(event, leadId))
}

const _context: (ctx: Plugin.Context) => Promise<void> = setup
void _context

export default Plugin.define({ id: "opencode-fusion", setup })
