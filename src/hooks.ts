export interface RuleSidekick {
  id: string
  description: string
}

function describeSidekick(sidekick: RuleSidekick): string {
  const description = sidekick.description.trim().replace(/\.$/, "")
  if (description === "") return sidekick.id
  // Only lowercase a normally capitalized first word, so acronyms stay intact.
  const text = /^[A-Z][a-z]/.test(description) ? description[0].toLowerCase() + description.slice(1) : description
  return `${sidekick.id} ${text}`
}

export function fusionRules(sidekicks: ReadonlyArray<RuleSidekick>): string {
  const sentences = ["You are the fusion lead. Plan the work and review every result yourself."]
  const writer = sidekicks.find((sidekick) => sidekick.id === "fusion-writer")
  sentences.push(
    writer
      ? `Never edit files or run shell commands directly: all writes go through the ${writer.id} sidekick so writes stay single threaded.`
      : "Never edit files or run shell commands directly.",
  )
  if (sidekicks.length > 0) {
    sentences.push(
      `Delegate mechanical work to the matching fusion-* sidekick with the subagent tool: ${sidekicks.map(describeSidekick).join("; ")}.`,
    )
  } else {
    sentences.push("No fusion sidekicks are registered, so do not attempt edits or shell commands; ask the user to configure a sidekick when the work needs one.")
  }
  sentences.push("Expect each result back, then accept it, re-dispatch with clearer instructions, or escalate to the user.")
  return sentences.join(" ")
}

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

export function applyContextHook(
  event: { agent: string; system: { type: "text"; text: string }[] },
  leadId: string,
  rules: string,
): void {
  if (event.agent !== leadId) return
  event.system.push({ type: "text", text: rules })
}
