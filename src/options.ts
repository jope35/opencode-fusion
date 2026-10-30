export interface PermissionRule {
  action: string
  resource: string
  effect: "allow" | "ask" | "deny"
}

export interface SidekickOptions {
  model?: string
  description?: string
  prompt?: string
  permissions?: PermissionRule[]
}

export interface ResolvedSidekick {
  name: string
  id: string
  model?: string
  description: string
  prompt: string
  permissions: PermissionRule[]
}

export type ConfiguredSidekick = ResolvedSidekick & { model: string }

export type BuiltinSidekick = SidekickOptions & {
  description: string
  prompt: string
  permissions: PermissionRule[]
}

const deny = (action: string): PermissionRule => ({ action, resource: "*", effect: "deny" })
const allow = (action: string): PermissionRule => ({ action, resource: "*", effect: "allow" })

const REVIEWER_PERMISSIONS: PermissionRule[] = [deny("edit"), deny("shell")]

export const BUILTIN_SIDEKICKS: Record<string, BuiltinSidekick> = {
  writer: {
    description: "Implements code changes and writes tests.",
    prompt: "You implement and test code changes. Make the requested edits, run the relevant tests, and report what changed.",
    permissions: [allow("edit"), allow("shell")],
  },
  reviewer: {
    description: "Reviews code and reports findings.",
    prompt: "You review code and report findings in severity order. Do not edit files or run shell commands.",
    permissions: REVIEWER_PERMISSIONS,
  },
  reader: {
    description: "Reads files and reports what they contain.",
    prompt: "You read files and report what they contain. Do not edit files or run commands.",
    permissions: [...REVIEWER_PERMISSIONS, deny("webfetch"), deny("websearch")],
  },
  search: {
    description: "Researches topics with the web tools.",
    prompt: "You research topics using the web tools and report findings with sources.",
    permissions: [...REVIEWER_PERMISSIONS],
  },
  summarizer: {
    description: "Summarizes content concisely.",
    prompt: "You summarize the given content concisely, keeping the facts that matter.",
    permissions: [deny("edit"), deny("webfetch"), deny("websearch"), allow("shell")],
  },
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/
const RESERVED_NAMES = new Set(["constructor", "prototype", "__proto__"])
const BUILTIN_AGENT_IDS = new Set(["build", "plan"])

function validateName(name: string): void {
  if (RESERVED_NAMES.has(name) || !NAME_PATTERN.test(name)) {
    throw new Error(`invalid sidekick name: ${name}`)
  }
}

export function resolveOptions(options: {
  lead?: string
  sidekicks?: Record<string, SidekickOptions>
}): { leadId: string; sidekicks: ResolvedSidekick[] } {
  const leadId = options.lead ?? "fusion"
  if (!NAME_PATTERN.test(leadId)) {
    throw new Error(`invalid lead id: ${leadId}`)
  }

  const user = options.sidekicks ?? {}
  for (const name of Object.keys(user)) validateName(name)

  const names = [...Object.keys(BUILTIN_SIDEKICKS), ...Object.keys(user).filter((name) => !Object.hasOwn(BUILTIN_SIDEKICKS, name))]

  const sidekicks: ResolvedSidekick[] = names.map((name) => {
    const builtin = Object.hasOwn(BUILTIN_SIDEKICKS, name) ? BUILTIN_SIDEKICKS[name] : undefined
    const entry = user[name] ?? {}
    const permissions = entry.permissions ?? builtin?.permissions ?? REVIEWER_PERMISSIONS
    return {
      name,
      id: `fusion-${name}`,
      model: entry.model,
      description: entry.description ?? builtin?.description ?? `${name} sidekick.`,
      prompt: entry.prompt ?? builtin?.prompt ?? `You are the ${name} sidekick. Do the ${name} work you are given and report back.`,
      permissions: permissions.map((rule) => ({ ...rule })),
    }
  })

  if (BUILTIN_AGENT_IDS.has(leadId)) {
    throw new Error(`lead id ${leadId} is a built-in agent`)
  }
  const registered = sidekicks.filter((s) => s.model !== undefined)
  if (registered.some((s) => s.id === leadId)) {
    throw new Error(`lead id ${leadId} collides with sidekick ${leadId}`)
  }

  return { leadId, sidekicks }
}
