// Delegate session start requests: pure builders for the HTTP requests a coordinator sends to an
// OpenCode server to start a delegate as a session. No network, no process, no file reads here.
// Contract: issue #189 (ROADMAP 0.2 part 3).

export type ModelRef = { providerID: string; id: string }
export type ResolvedModel = { canonical: string; resolved: string; ref: ModelRef }
export type HttpRequest = { method: "POST"; path: string; body: Record<string, unknown> }

export function parseModel(ref: string): ModelRef {
  // Split at the first "/" only: model ids may themselves contain "/".
  const i = ref.indexOf("/")
  if (i < 0) throw new Error(`model "${ref}" must look like "provider/model" (no "/" found)`)
  const providerID = ref.slice(0, i)
  const id = ref.slice(i + 1)
  if (!providerID) throw new Error(`model "${ref}" has an empty provider before the first "/"`)
  if (!id) throw new Error(`model "${ref}" has an empty model id after the first "/"`)
  return { providerID, id }
}

export function loadAliases(text: string | undefined): { aliases: Record<string, string>; warning?: string } {
  // Fail-safe: the file may be missing or corrupt; never throw, say why so the caller can tell the owner.
  if (text === undefined) return { aliases: {} }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { aliases: {}, warning: `models.local.json is not valid JSON: ${(e as Error).message}` }
  }
  const aliases = data !== null && typeof data === "object" ? (data as { aliases?: unknown }).aliases : undefined
  if (aliases === null || typeof aliases !== "object" || Array.isArray(aliases)) {
    return { aliases: {}, warning: 'models.local.json must look like {"aliases": {"<canonical>": "<provider/model>"}}' }
  }
  for (const [k, v] of Object.entries(aliases)) {
    if (typeof v !== "string") {
      return { aliases: {}, warning: `models.local.json alias "${k}" is not a string` }
    }
  }
  return { aliases: aliases as Record<string, string> }
}

export function resolveModel(canonical: string, aliases: Record<string, string>): ResolvedModel {
  // The alias (this machine's route to the model) wins; the canonical name is the fallback.
  const resolved = Object.prototype.hasOwnProperty.call(aliases, canonical) ? aliases[canonical] : canonical
  return { canonical, resolved, ref: parseModel(resolved) }
}

export function buildCreateRequest(opts: {
  worktree: string
  model: ModelRef
  agent?: string
  parentID?: string
  title?: string
}): HttpRequest {
  // The session runs in the delegate's worktree, so its directory must be absolute.
  if (!opts.worktree.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(opts.worktree)) {
    throw new Error(`worktree "${opts.worktree}" must be an absolute path`)
  }
  const body: Record<string, unknown> = {
    agent: opts.agent ?? "delegate",
    model: { providerID: opts.model.providerID, id: opts.model.id },
    location: { directory: opts.worktree },
  }
  if (opts.parentID !== undefined) body.parentID = opts.parentID
  if (opts.title !== undefined) body.title = opts.title
  return { method: "POST", path: "/api/session", body }
}

export function buildPromptRequest(opts: { sessionID: string; brief: string; delivery?: string }): HttpRequest {
  if (!opts.sessionID.startsWith("ses")) throw new Error(`session id "${opts.sessionID}" must start with "ses"`)
  if (opts.brief.trim() === "") throw new Error("the brief is empty")
  return {
    method: "POST",
    path: `/api/session/${opts.sessionID}/prompt`,
    body: { text: opts.brief, delivery: opts.delivery ?? "queue" },
  }
}

export function authHeader(password: string): string {
  // `opencode serve` uses Basic auth with the fixed user "opencode".
  if (password === "") throw new Error("the server password is empty")
  return "Basic " + Buffer.from("opencode:" + password, "utf8").toString("base64")
}

export function gitIdentity(canonical: string): { name: string; email: string } {
  // Commits carry the canonical model name, never the machine's alias (AGENTS.md › Coding rules).
  return { name: "delegate " + canonical, email: "delegate@bive.invalid" }
}
