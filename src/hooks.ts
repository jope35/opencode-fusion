export const FUSION_RULES =
  "You are the fusion lead. Plan the work and review every result yourself. " +
  "Never edit files or run shell commands directly: all writes go through the fusion-writer sidekick so writes stay single threaded. " +
  "Delegate mechanical work to the matching fusion-* sidekick with the subagent tool: writing and commands to fusion-writer, review to fusion-reviewer, reading to fusion-reader, web research to fusion-search, summarizing to fusion-summarizer. " +
  "Expect each result back, then accept it, re-dispatch with clearer instructions, or escalate to the user."

export function applySubagentModelHook(event: { tool: string; input: unknown }, models: ReadonlyMap<string, string>): void {
  if (event.tool !== "subagent") return
  const input = event.input
  if (input === null || typeof input !== "object") return
  const agent = (input as { agent?: unknown }).agent
  if (typeof agent !== "string") return
  const model = models.get(agent)
  if (model === undefined) return
  ;(input as { model?: string }).model = model
}

export function applyContextHook(event: { agent: string; system: { type: "text"; text: string }[] }, leadId: string): void {
  if (event.agent !== leadId) return
  event.system.push({ type: "text", text: FUSION_RULES })
}
