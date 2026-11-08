// The project's token ratio: tokens the humans wrote (in) against tokens the agents produced (out).
// Human = a user message in a root session (a session with no parent); a delegate's prompt is written by its
// coordinator, so it counts on the agent side. Human tokens are estimated (characters / 4); agent tokens are the
// provider's own count (output + reasoning). One line per message is appended to <main checkout>/.bive/state/
// tokens.jsonl, shared by every worktree; only numbers are written, never text.
// Live sharing (opt-in): with BIVE_TOKENS_GIST=<gist id> and `gh` signed in, the totals are pushed at most every
// 5 minutes as a shields.io endpoint file, for a README badge (see the README › Token ratio).
// Public registry (opt-in; see the README › Registry): on only when BIVE_REGISTRY=on or when the project already
// carries a committed .bive/registry-id (BIVE_REGISTRY=off silences it anyway). When a root session goes idle, the human and agent tokens (agent tokens also per agent name and provider/model: the llm variable) and the guard's refusals (violations) since the last send, and the code size (tracked text lines, rounded to two
// significant figures) are posted with the random id of .bive/registry-id. Nothing else: no name, path or text.
// A delegate process is started with BIVE_ROLE=delegate: its prompt comes from the coordinator, so it counts as agent.
import type { Plugin } from "@opencode-ai/plugin"
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { execFile, execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import os from "node:os"
import path from "node:path"

const SHARE_EVERY_MS = 5 * 60 * 1000
const FIRST_SHARE_MS = 10 * 1000
const REGISTRY_URL = "https://bive-registry.jcherfils.workers.dev/v1/session"   // the owner's Worker (registry/)
const LOC_EVERY_MS = 60 * 60 * 1000

function twoDigits(n: number): number {          // 48213 -> 48000: a size, not a fingerprint
  if (n < 100) return n
  const p = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / p) * p
}

function codeLines(root: string): number {
  let lines = 0
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, maxBuffer: 64 << 20 }).toString().split("\0")
  for (const f of files) {
    if (!f) continue
    try {
      const full = path.join(root, f)
      if (statSync(full).size > 2 << 20) continue
      const text = readFileSync(full, "utf8")
      if (text.includes("\0")) continue          // binary
      lines += text.split("\n").length
    } catch { /* deleted or unreadable: not counted */ }
  }
  return lines
}

function mainCheckout(dir: string): string {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: dir })
    return path.dirname(common.toString().trim())
  } catch {
    return dir
  }
}

function totals(log: string) {     // not exported: OpenCode runs every export as a plugin
  let human = 0, agent = 0
  for (const line of log.split("\n")) {
    if (!line) continue
    let r: { kind?: string, tokens?: number }
    try { r = JSON.parse(line) } catch { continue }
    if (typeof r.tokens !== "number") continue
    if (r.kind === "human") human += r.tokens
    else if (r.kind === "agent") agent += r.tokens
  }
  return { human, agent, ratio: human ? Math.round(agent / human) : null }
}

export const TokenRatio: Plugin = async ({ client, directory, worktree }) => {
  const main = mainCheckout(worktree || directory)
  const state = path.join(main, ".bive", "state")
  mkdirSync(state, { recursive: true })
  const delegate = process.env.BIVE_ROLE === "delegate"
  const idFile = path.join(main, ".bive", "registry-id")
  // Opt-in: nothing leaves the machine unless the owner asked (BIVE_REGISTRY=on) or the project already chose it
  // (a committed .bive/registry-id). BIVE_REGISTRY=off wins over both.
  const registryOn = process.env.BIVE_REGISTRY !== "off"
    && (process.env.BIVE_REGISTRY === "on" || existsSync(idFile))
  const registryUrl = process.env.BIVE_REGISTRY_URL || REGISTRY_URL
  const pending = { human: 0, agent: 0, violations: 0 }
  // The llm variable, per "agent|provider/model": output tokens, input tokens (prompt + cache reads) and the summed
  // response time in milliseconds (created -> completed), from which the registry derives its speed metrics.
  type Use = { tokens: number, input: number, ms: number, replies: number }
  let pendingModels: Record<string, Use> = {}
  const addUse = (key: string, u: Use) => {
    const c = (pendingModels[key] ??= { tokens: 0, input: 0, ms: 0, replies: 0 })
    c.tokens += u.tokens; c.input += u.input; c.ms += u.ms; c.replies += u.replies
  }
  const g = globalThis as { __biveViolations?: number }   // counted by worktree-guard.ts
  let violationsSeen = 0
  let loc = { at: 0, value: 0 }
  let project = ""
  let warned = false
  if (registryOn) {
    if (!existsSync(idFile)) {       // only reached with BIVE_REGISTRY=on: the owner asked for it
      writeFileSync(idFile, randomUUID() + "\n")
      console.error("Bive registry: anonymous counts (tokens in, tokens out, violations, code size) go to the public "
        + "registry at the end of each session. Commit .bive/registry-id to keep it on; set BIVE_REGISTRY=off to stop.")
    }
    project = readFileSync(idFile, "utf8").trim()
  }
  const file = path.join(state, "tokens.jsonl")
  const parents = new Map<string, string | null>()   // session id -> parent id (null for a root session)
  const counted = new Set<string>()                  // message ids already logged
  let lastShare = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const isRoot = async (id: string) => {
    if (!parents.has(id)) {
      const s = await client.session.get({ path: { id } }).catch(() => null)
      parents.set(id, s?.data?.parentID ?? null)
    }
    return parents.get(id) === null
  }
  const log = (kind: "human" | "agent", tokens: number, session: string, model = "", agentName = "",
               input = 0, ms = 0) => {
    if (tokens <= 0) return
    pending[kind] += tokens
    const key = `${agentName || "unknown"}|${model}`
    if (kind === "agent" && model) addUse(key, { tokens, input, ms, replies: 1 })
    appendFileSync(file, JSON.stringify({ t: Date.now(), kind, tokens, session, model }) + "\n")
    share()
  }
  const share = () => {                          // at most every 5 minutes, the first 10 s after a change
    if (!process.env.BIVE_TOKENS_GIST || timer) return
    timer = setTimeout(push, Math.max(FIRST_SHARE_MS, lastShare + SHARE_EVERY_MS - Date.now()))
    timer.unref()
  }
  const push = () => {
    timer = null
    lastShare = Date.now()
    const t = totals(readFileSync(file, "utf8"))
    const badge = path.join(os.tmpdir(), `bive-tokens-${process.pid}.json`)
    writeFileSync(badge, JSON.stringify({ schemaVersion: 1, label: "human : agent tokens",
      message: t.ratio === null ? "no human input yet" : `1 : ${t.ratio}`, color: "blue" }))
    execFile("gh", ["gist", "edit", process.env.BIVE_TOKENS_GIST!, "-f", "bive-tokens.json", badge], (err) => {
      if (err) console.error(`token-ratio: gist update failed: ${err.message}`)
    })
  }

  const report = async () => {
    const v = (g.__biveViolations ?? 0) - violationsSeen
    if (v > 0) {
      violationsSeen += v
      pending.violations += v
      appendFileSync(file, JSON.stringify({ t: Date.now(), kind: "violation", count: v }) + "\n")
    }
    if (!registryOn || !project || (!pending.human && !pending.agent && !pending.violations)) return
    if (Date.now() - loc.at > LOC_EVERY_MS) {
      try { loc = { at: Date.now(), value: twoDigits(codeLines(main)) } } catch { loc.at = Date.now() }
    }
    const body = { v: 1, project, human: pending.human, agent: pending.agent, violations: pending.violations,
                   llm: Object.entries(pendingModels).map(([k, u]) => {
                     const [agent, model] = k.split("|"); return { agent, model, ...u } }),
                   loc: loc.value }
    pending.human = pending.agent = pending.violations = 0
    pendingModels = {}
    try {
      const r = await fetch(registryUrl, { method: "POST", headers: { "content-type": "application/json" },
                                           body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    } catch (err) {
      pending.human += body.human; pending.agent += body.agent   // kept for the next session end
      pending.violations += body.violations
      for (const { agent, model, ...u } of body.llm) addUse(`${agent}|${model}`, u)
      if (!warned) console.error(`Bive registry: not sent (${(err as Error).message}); retried at each session end.`)
      warned = true
    }
  }

  return {
    "chat.message": async (input, output) => {
      if (delegate || counted.has(output.message.id) || !(await isRoot(input.sessionID))) return
      counted.add(output.message.id)
      const chars = output.parts.reduce((n, p) => n + (p.type === "text" && !p.synthetic ? p.text.length : 0), 0)
      log("human", Math.ceil(chars / 4), input.sessionID)
    },
    event: async ({ event }) => {
      if (event.type === "session.created") parents.set(event.properties.info.id, event.properties.info.parentID ?? null)
      if (event.type === "session.idle" && (await isRoot(event.properties.sessionID))) await report()
      if (event.type !== "message.updated") return
      const m = event.properties.info
      if (m.role !== "assistant" || !m.time.completed || counted.has(m.id)) return
      counted.add(m.id)
      log("agent", m.tokens.output + m.tokens.reasoning, m.sessionID, `${m.providerID}/${m.modelID}`, m.mode,
          m.tokens.input + m.tokens.cache.read, Math.max(0, m.time.completed - m.time.created))
    },
  }
}
