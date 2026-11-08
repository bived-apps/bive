// The project's token ratio: tokens the humans wrote (in) against tokens the agents produced (out).
// Human = a user message in a root session (a session with no parent); a delegate's prompt is written by its
// coordinator, so it counts on the agent side. Human tokens are estimated (characters / 4); agent tokens are the
// provider's own count (output + reasoning). One line per message is appended to <main checkout>/.bive/state/
// tokens.jsonl, shared by every worktree; only numbers are written, never text.
// Live sharing (opt-in): with BIVE_TOKENS_GIST=<gist id> and `gh` signed in, the totals are pushed at most every
// 5 minutes as a shields.io endpoint file, for a README badge (see the README › Token ratio).
import type { Plugin } from "@opencode-ai/plugin"
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { execFile, execFileSync } from "node:child_process"
import os from "node:os"
import path from "node:path"

const SHARE_EVERY_MS = 5 * 60 * 1000
const FIRST_SHARE_MS = 10 * 1000

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
    else agent += r.tokens
  }
  return { human, agent, ratio: human ? Math.round(agent / human) : null }
}

export const TokenRatio: Plugin = async ({ client, directory, worktree }) => {
  const state = path.join(mainCheckout(worktree || directory), ".bive", "state")
  const file = path.join(state, "tokens.jsonl")
  mkdirSync(state, { recursive: true })
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
  const log = (kind: "human" | "agent", tokens: number, session: string, model = "") => {
    if (tokens <= 0) return
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

  return {
    "chat.message": async (input, output) => {
      if (counted.has(output.message.id) || !(await isRoot(input.sessionID))) return
      counted.add(output.message.id)
      const chars = output.parts.reduce((n, p) => n + (p.type === "text" && !p.synthetic ? p.text.length : 0), 0)
      log("human", Math.ceil(chars / 4), input.sessionID)
    },
    event: async ({ event }) => {
      if (event.type === "session.created") parents.set(event.properties.info.id, event.properties.info.parentID ?? null)
      if (event.type !== "message.updated") return
      const m = event.properties.info
      if (m.role !== "assistant" || !m.time.completed || counted.has(m.id)) return
      counted.add(m.id)
      log("agent", m.tokens.output + m.tokens.reasoning, m.sessionID, `${m.providerID}/${m.modelID}`)
    },
  }
}
