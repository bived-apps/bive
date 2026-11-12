// Models check: pure helpers telling which models of .bive/models.json are usable on this machine.
// No fs, no process, no network here; the command-line wrapper is lib/models-check-cli.ts. Contract: issue #206.

export type ModelStatus = "found" | "alias" | "missing"
export type ModelCheck = { canonical: string; resolved: string; status: ModelStatus; closest?: string }
export type CheckResult = { roles: Record<string, ModelCheck[]>; ok: boolean }
export type ErrorClass = "limit" | "credit" | "unavailable" | "other"
export type ProbeResult = { model: string; ok: boolean; reason?: string }

export function parseModelList(text: string): string[] {
  const seen = new Set<string>()
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (line !== "" && line.includes("/")) seen.add(line)
  }
  return [...seen]
}

function editDistance(a: string, b: string): number {
  let prev: number[] = []
  for (let j = 0; j <= b.length; j++) prev.push(j)
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost))
    }
    prev = cur
  }
  return prev[b.length]
}

export function closestMatch(name: string, available: string[]): string | undefined {
  const i = name.indexOf("/")
  if (i >= 0) {
    const id = name.slice(i + 1)
    const sameId = available.find((m) => m !== name && m.slice(m.indexOf("/") + 1) === id)
    if (sameId !== undefined) return sameId
  }
  let best: string | undefined
  let bestDist = Infinity
  for (const m of available) {
    const d = editDistance(name, m)
    if (d < bestDist) {
      best = m
      bestDist = d
    }
  }
  return bestDist <= 3 ? best : undefined
}

export function checkModels(
  config: Record<string, string[]>,
  available: string[],
  aliases: Record<string, string>,
): CheckResult {
  const have = new Set(available)
  const roles: Record<string, ModelCheck[]> = {}
  let ok = true
  for (const [role, models] of Object.entries(config)) {
    if (!Array.isArray(models)) continue // the file may be hand-edited
    const checks: ModelCheck[] = []
    for (const canonical of models) {
      const hasAlias = Object.prototype.hasOwnProperty.call(aliases, canonical)
      const resolved = hasAlias ? aliases[canonical] : canonical
      if (hasAlias && have.has(resolved)) checks.push({ canonical, resolved, status: "alias" })
      else if (!hasAlias && have.has(canonical)) checks.push({ canonical, resolved, status: "found" })
      else {
        const check: ModelCheck = { canonical, resolved, status: "missing" }
        const closest = closestMatch(resolved, available)
        if (closest !== undefined) check.closest = closest
        checks.push(check)
      }
    }
    roles[role] = checks
    if (!checks.some((c) => c.status !== "missing")) ok = false
  }
  return { roles, ok }
}

export function classifyModelError(text: string): ErrorClass {
  const t = text.toLowerCase()
  const has = (words: string[]) => words.some((w) => t.includes(w))
  if (has(["usage limit", "rate limit", "429", "quota", "too many requests"])) return "limit"
  if (has(["credit balance", "insufficient", "add usage credits", "billing", "payment required", "402"])) return "credit"
  if (has(["not found", "unreachable", "econnrefused", "timed out", "timeout", "503", "overloaded"])) return "unavailable"
  return "other"
}

export async function probeModels(
  models: string[],
  send: (model: string, prompt: string, timeoutMs: number) => Promise<string>,
  timeoutMs = 60000,
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = []
  for (const model of models) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs)
      })
      const reply = await Promise.race([send(model, "Reply OK", timeoutMs), timeout])
      const cls = classifyModelError(reply)
      results.push(cls === "other" ? { model, ok: true } : { model, ok: false, reason: `${cls}: ${reply.trim().slice(0, 200)}` })
    } catch (e) {
      results.push({ model, ok: false, reason: (e as Error).message })
    } finally {
      clearTimeout(timer)
    }
  }
  return results
}

export function formatReport(result: CheckResult): string {
  const lines: string[] = []
  const bad: string[] = []
  for (const [role, checks] of Object.entries(result.roles)) {
    for (const c of checks) {
      const what =
        c.status === "found"
          ? "found"
          : c.status === "alias"
            ? `alias ${c.resolved}`
            : `MISSING${c.closest !== undefined ? ` (closest ${c.closest})` : ""}`
      lines.push(`${role}: ${c.canonical}: ${what}`)
    }
    if (!checks.some((c) => c.status !== "missing")) bad.push(role)
  }
  lines.push(result.ok ? "ok" : bad.map((r) => `NO USABLE MODEL FOR ${r}`).join("\n"))
  return lines.join("\n")
}
