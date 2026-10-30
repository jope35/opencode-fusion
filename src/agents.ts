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

export function registerAgents(editor: AgentEditorLike, leadId: string, sidekicks: ConfiguredSidekick[]): void {
  editor.update(leadId, (agent) => {
    agent.mode = "primary"
    agent.description = LEAD_DESCRIPTION
    agent.permissions = [
      { action: "edit", resource: "*", effect: "deny" },
      { action: "shell", resource: "*", effect: "deny" },
      { action: "subagent", resource: "*", effect: "deny" },
      { action: "subagent", resource: "fusion-*", effect: "allow" },
    ]
  })
  editor.default(leadId)

  for (const other of editor.list()) {
    if (other.id === leadId) continue
    editor.update(other.id, (agent) => {
      ;(agent.permissions ??= []).push({ action: "subagent", resource: "fusion-*", effect: "deny" })
    })
  }

  for (const sidekick of sidekicks) {
    const ref = parseModelRef(sidekick.model)
    editor.update(sidekick.id, (agent) => {
      agent.mode = "subagent"
      agent.model = { providerID: ref.providerID, id: ref.modelID, variant: ref.variant }
      agent.system = sidekick.prompt
      agent.description = sidekick.description
      agent.permissions = sidekick.permissions
      agent.hidden = false
    })
  }
}
