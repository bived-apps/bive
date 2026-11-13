// Delegate worktree setup order: pure checks that make the start dependency-safe
// (create -> checkWorktree -> role and identity -> checkReady -> launch) and the recovery fail closed.
// No process, no file reads: the coordinator runs the commands and passes their output here. Issue #246.

import { gitIdentity } from "./delegate-session.ts"

export type WorktreeEntry = { path: string; branch?: string }
export type Check = { ok: true } | { ok: false; reason: string }
export type WorktreeCheck = { ok: true; path: string } | { ok: false; reason: string }
export type ReadyCheck = Check

export function parseWorktreeList(porcelain: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = []
  for (const block of porcelain.split(/\r?\n\r?\n/)) {
    let entry: WorktreeEntry | undefined
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("worktree ")) entry = { path: line.slice("worktree ".length) }
      else if (entry && line.startsWith("branch ")) {
        const ref = line.slice("branch ".length)
        entry.branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref
      }
    }
    if (entry) entries.push(entry)
  }
  return entries
}

export function checkWorktree(opts: { list: string; checkout: string; issue: number; branch: string }): WorktreeCheck {
  const checkout = opts.checkout.replace(/\/+$/, "")
  const expected = `${checkout}/.worktrees/issue-${opts.issue}`
  const entries = parseWorktreeList(opts.list)
  const entry = entries.find((e) => e.path === expected)
  if (!entry) {
    const near = entries.find((e) => e.branch === opts.branch)
    if (near) {
      const where = near.path === checkout ? "the checkout itself" : `"${near.path}"`
      return { ok: false, reason: `wrong place: branch ${opts.branch} is checked out in ${where}, expected "${expected}"` }
    }
    return { ok: false, reason: `missing: no worktree at "${expected}"` }
  }
  if (entry.branch !== opts.branch) {
    return { ok: false, reason: `wrong branch: "${expected}" is on ${entry.branch ?? "no branch"}, expected ${opts.branch}` }
  }
  return { ok: true, path: expected }
}

export function checkReady(opts: { role: string | undefined; userName: string | undefined; canonical: string }): ReadyCheck {
  if (opts.role === undefined) return { ok: false, reason: "role file missing" }
  if (opts.role.trim() !== "delegate") return { ok: false, reason: `role file says "${opts.role.trim()}", expected "delegate"` }
  const want = gitIdentity(opts.canonical).name
  if (opts.userName === undefined || opts.userName === "") return { ok: false, reason: `worktree user.name is not set, expected "${want}"` }
  if (opts.userName !== want) return { ok: false, reason: `worktree user.name is "${opts.userName}", expected "${want}"` }
  return { ok: true }
}

export function planSetup(state: {
  worktree: WorktreeCheck | null
  ready: ReadyCheck | null
}): { next: "create-worktree" | "write-role-and-identity" | "launch" } | { stop: string } {
  if (state.worktree === null) return { next: "create-worktree" }
  if (!state.worktree.ok) return { stop: state.worktree.reason }
  if (state.ready === null) return { next: "write-role-and-identity" }
  if (!state.ready.ok) return { stop: state.ready.reason }
  return { next: "launch" }
}

export function planRecovery(opts: {
  markerCreatedByThisAttempt: boolean
  sessionActive: boolean | undefined
  dirty: string[]
}): { action: "clear-marker" } | { action: "stop-and-report"; reasons: string[] } {
  const reasons: string[] = []
  if (!opts.markerCreatedByThisAttempt) reasons.push("the marker existed before this attempt: it is not ours to clear")
  if (opts.sessionActive === true) reasons.push("a session is active")
  if (opts.sessionActive === undefined) reasons.push("session state unknown: one missing PID is not proof it is inactive")
  if (opts.dirty.length > 0) reasons.push(`uncommitted work: ${opts.dirty.join(", ")}`)
  return reasons.length === 0 ? { action: "clear-marker" } : { action: "stop-and-report", reasons }
}
