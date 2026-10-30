export interface ParsedModelRef {
  providerID: string
  modelID: string
  variant?: string
}

const MALFORMED = "model ref must be providerID/modelID or providerID/modelID#variant"

export function parseModelRef(ref: string): ParsedModelRef {
  const hash = ref.indexOf("#")
  const base = hash === -1 ? ref : ref.slice(0, hash)
  const variant = hash === -1 ? undefined : ref.slice(hash + 1)
  const slash = base.indexOf("/")
  if (slash === -1) throw new Error(`invalid model ref "${ref}": ${MALFORMED}`)
  const providerID = base.slice(0, slash)
  const modelID = base.slice(slash + 1)
  if (providerID === "" || modelID === "") {
    throw new Error(`invalid model ref "${ref}": ${MALFORMED}`)
  }
  return { providerID, modelID, variant }
}

export function assertModelsKnown(
  sidekicks: ReadonlyArray<{ name: string; model: string }>,
  known: ReadonlyArray<{ providerID: string; id: string }>,
): void {
  const available = new Set(known.map((model) => `${model.providerID}/${model.id}`))
  for (const sidekick of sidekicks) {
    let parsed: ParsedModelRef
    try {
      parsed = parseModelRef(sidekick.model)
    } catch {
      throw new Error(`unknown model "${sidekick.model}" for sidekick ${sidekick.name}`)
    }
    if (!available.has(`${parsed.providerID}/${parsed.modelID}`)) {
      throw new Error(`unknown model "${sidekick.model}" for sidekick ${sidekick.name}`)
    }
  }
}
