// Delegate run helpers: pure, injectable functions a coordinator uses after starting a delegate session
// (wait, read the pushed branch, fall back to the next model). No network, no process: the world is passed in.
// Contract: issue #190 (ROADMAP 0.2 part 4).

import { buildCreateRequest, gitIdentity, resolveModel } from "./delegate-session.ts"
import type { HttpRequest } from "./delegate-session.ts"
import { classifyModelError } from "./models-check.ts"

export type BranchCommit = { sha: string; author: string; subject: string }
export type BranchState = { pushed: boolean; commits: BranchCommit[]; report: string | undefined }

export function buildWaitRequest(sessionID: string): Omit<HttpRequest, "body"> {
  // The experimental wait endpoint answers 204 when the session finishes.
  if (!sessionID.startsWith("ses")) throw new Error(`session id "${sessionID}" must start with "ses"`)
  return { method: "POST", path: `/api/experimental/session/${sessionID}/wait` }
}

export function isSessionDone(event: unknown, sessionID: string): boolean {
  // The payload shape is undocumented, so read the session id loosely and never throw on odd input.
  if (event === null || typeof event !== "object") return false
  const e = event as Record<string, unknown>
  if (e.type !== "session.execution.succeeded") return false
  const fromKey = (key: string): unknown => {
    const v = e[key]
    return v !== null && typeof v === "object" ? (v as Record<string, unknown>).sessionID : undefined
  }
  const id = e.sessionID ?? fromKey("properties") ?? fromKey("data")
  return typeof id === "string" && id === sessionID
}

export async function readBranch(opts: {
  branch: string
  base: string
  git: (args: string[]) => Promise<string>
}): Promise<BranchState> {
  // Each git failure is reported with its command so the coordinator knows what to retry.
  const run = async (args: string[]): Promise<string> => {
    try {
      return await opts.git(args)
    } catch (e) {
      throw new Error(`git ${args.join(" ")} failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const heads = await run(["ls-remote", "--heads", "origin", opts.branch])
  if (heads.trim() === "") return { pushed: false, commits: [], report: undefined }
  const log = await run(["log", "--format=%H%x1f%an%x1f%s", `origin/${opts.base}..origin/${opts.branch}`])
  const commits: BranchCommit[] = log
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => {
      const [sha = "", author = "", ...rest] = l.split("\x1f")
      return { sha, author, subject: rest.join("\x1f") }
    })
  const body = await run(["log", "-1", "--format=%B", `origin/${opts.branch}`])
  const trimmed = body.trim()
  const report = /^(Closes|Part of) #/.test(trimmed) ? trimmed : undefined
  return { pushed: true, commits, report }
}

export function needsFallback(outcome: { text?: string; status?: number }): boolean {
  // A limit, a credit shortage or an unavailable model means: try the next model.
  if (outcome.status === 402 || outcome.status === 429 || outcome.status === 503) return true
  if (outcome.text === undefined) return false
  return classifyModelError(outcome.text) !== "other"
}

export function nextModel(models: string[], failed: string[]): string | undefined {
  return models.find((m) => !failed.includes(m))
}

export function planFallback(opts: {
  models: string[]
  failed: string[]
  aliases: Record<string, string>
  worktree: string
  issue: number
  committed: string[]
  left: string
}) {
  // Same worktree, next model: the new session starts with a short resume message.
  const next = nextModel(opts.models, opts.failed)
  if (next === undefined) return undefined
  const { canonical, resolved, ref } = resolveModel(next, opts.aliases)
  const done = opts.committed.length > 0 ? opts.committed.map((c) => `Committed: ${c}`) : ["Nothing committed."]
  const resume = [
    `The model changed to ${canonical}; this is issue #${opts.issue}.`,
    ...done,
    `Left: ${opts.left}`,
    "Continue from the worktree as it is.",
  ].join("\n")
  return {
    canonical,
    resolved,
    identity: gitIdentity(canonical),
    create: buildCreateRequest({ worktree: opts.worktree, model: ref }),
    resume,
  }
}
