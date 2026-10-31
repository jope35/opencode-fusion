import { parseModelRef } from "./model.ts"
import type { ConfiguredSidekick, PermissionRule } from "./options.ts"

export interface AgentLike {
  id: string
  mode?: "primary" | "subagent" | "all"
  description?: string
  system?: string
  model?: { providerID: string; id: string; variant?: string }
  hidden?: boolean
  permissions?: PermissionRule[]
  [key: string]: unknown
}

export interface AgentEditorLike {
  list(): readonly AgentLike[]
  get(id: string): AgentLike | undefined
  default(id: string | undefined): void
  update(id: string, update: (agent: AgentLike) => void): void
}

const LEAD_DESCRIPTION = "Plans and reviews; delegates edits and commands to fusion sidekicks."

// Appended after the user's own rules, so last-match-wins keeps the lead locked down
// without discarding unrelated user permissions.
const LEAD_PERMISSIONS: PermissionRule[] = [
  { action: "edit", resource: "*", effect: "deny" },
  { action: "shell", resource: "*", effect: "deny" },
  { action: "subagent", resource: "*", effect: "deny" },
  { action: "subagent", resource: "fusion-*", effect: "allow" },
]

const SIDEKICK_DENY: PermissionRule = { action: "subagent", resource: "fusion-*", effect: "deny" }

function sameRule(a: PermissionRule, b: PermissionRule): boolean {
  return a.action === b.action && a.resource === b.resource && a.effect === b.effect
}

function hasTrailing(rules: readonly PermissionRule[], expected: readonly PermissionRule[]): boolean {
  if (rules.length < expected.length) return false
  const start = rules.length - expected.length
  return expected.every((rule, index) => sameRule(rules[start + index], rule))
}

function appendRule(rules: PermissionRule[], rule: PermissionRule): void {
  const last = rules.at(-1)
  if (last !== undefined && sameRule(last, rule)) return
  rules.push({ ...rule })
}

// An agent already carrying one of our rules is a previous registration (plugin reload),
// not a user agent we would hijack.
function isRegisteredByUs(agent: AgentLike): boolean {
  const last = agent.permissions?.at(-1)
  return last !== undefined && last.action === "subagent" && last.resource === "fusion-*"
}

export function registerAgents(editor: AgentEditorLike, leadId: string, sidekicks: ConfiguredSidekick[]): void {
  const owned = new Set([leadId, ...sidekicks.map((sidekick) => sidekick.id)])
  const collisions = editor
    .list()
    .filter((agent) => owned.has(agent.id) && !isRegisteredByUs(agent))
    .map((agent) => agent.id)
  if (collisions.length > 0) {
    throw new Error(`agent ${collisions.join(", ")} already exists; rename the fusion lead or sidekick to avoid overwriting it`)
  }

  editor.update(leadId, (agent) => {
    agent.mode = "primary"
    agent.description = LEAD_DESCRIPTION
    const rules = agent.permissions ?? []
    if (!hasTrailing(rules, LEAD_PERMISSIONS)) rules.push(...LEAD_PERMISSIONS.map((rule) => ({ ...rule })))
    agent.permissions = rules
  })
  editor.default(leadId)

  for (const other of editor.list()) {
    if (other.id === leadId) continue
    editor.update(other.id, (agent) => {
      appendRule((agent.permissions ??= []), SIDEKICK_DENY)
    })
  }

  for (const sidekick of sidekicks) {
    const ref = parseModelRef(sidekick.model)
    editor.update(sidekick.id, (agent) => {
      agent.mode = "subagent"
      agent.model = { providerID: ref.providerID, id: ref.modelID, variant: ref.variant }
      agent.system = sidekick.prompt
      agent.description = sidekick.description
      agent.permissions = sidekick.permissions.map((rule) => ({ ...rule }))
      appendRule(agent.permissions, SIDEKICK_DENY)
      agent.hidden = false
    })
  }
}
