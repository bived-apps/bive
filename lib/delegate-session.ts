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

function assertAbsolute(path: string): void {
  if (typeof path !== "string" || (!path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(path))) {
    throw new Error(`worktree "${path}" must be an absolute path`)
  }
}

export function buildMoveRequest(opts: { sessionID: string; worktree: string }): HttpRequest {
  if (typeof opts.sessionID !== "string" || !opts.sessionID.startsWith("ses")) {
    throw new Error(`session id "${opts.sessionID}" must start with "ses"`)
  }
  assertAbsolute(opts.worktree)
  return { method: "POST", path: `/api/session/${opts.sessionID}/move`, body: { directory: opts.worktree } }
}

export function isInWorktree(session: unknown, worktree: string): boolean {
  // Fail-safe: anything malformed is false; the comparison is exact (no prefix or slash tricks).
  if (session === null || typeof session !== "object") return false
  const s = session as { data?: unknown; location?: unknown }
  // The server answers {data: {...}}; accept the bare session too.
  const inner = s.data !== null && typeof s.data === "object" ? (s.data as { location?: unknown }) : s
  const loc = inner.location
  if (loc === null || typeof loc !== "object") return false
  const dir = (loc as { directory?: unknown }).directory
  return typeof dir === "string" && dir !== "" && dir === worktree
}

export function buildCreateRequest(opts: {
  worktree: string
  model: ModelRef
  agent?: string
  title?: string
  coordinator?: { session: string; issue: number }
  parentID?: string
}): HttpRequest {
  // The session runs in the delegate's worktree, so its directory must be absolute.
  assertAbsolute(opts.worktree)
  const body: Record<string, unknown> = {
    agent: opts.agent ?? "delegate",
    model: { providerID: opts.model.providerID, id: opts.model.id },
  }
  if (opts.parentID !== undefined) {
    // A child session lands in its parent's directory and OpenCode ignores `location` (#256):
    // the caller moves it to the worktree afterwards (buildMoveRequest).
    if (typeof opts.parentID !== "string" || !opts.parentID.startsWith("ses")) {
      throw new Error(`parent session id "${opts.parentID}" must start with "ses"`)
    }
    body.parentID = opts.parentID
  } else {
    body.location = { directory: opts.worktree }
  }
  if (opts.title !== undefined) body.title = opts.title
  if (opts.coordinator !== undefined) {
    const { session, issue } = opts.coordinator
    if (typeof session !== "string" || !session.startsWith("ses")) {
      throw new Error(`coordinator session id "${session}" must start with "ses"`)
    }
    if (!Number.isInteger(issue) || issue <= 0) throw new Error(`coordinator issue "${issue}" must be a positive integer`)
    body.metadata = { bive: { coordinator: session, issue } }
  }
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
