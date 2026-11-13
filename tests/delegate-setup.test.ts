import { test } from "node:test"
import assert from "node:assert/strict"
import { parseWorktreeList, checkWorktree, checkReady, planSetup, planRecovery } from "../lib/delegate-setup.ts"

const C = "/home/o/proj"
const B = "issue/246-setup-order"
const list = (...e: string[]) => e.join("\n\n") + "\n"
const main = `worktree ${C}\nHEAD abc\nbranch refs/heads/bived`
const wt = (p: string, b = B) => `worktree ${p}\nHEAD def\nbranch refs/heads/${b}`
const chk = (l: string) => checkWorktree({ list: l, checkout: C, issue: 246, branch: B })

test("parseWorktreeList reads paths, branches, detached and bare", () => {
  const out = parseWorktreeList(list(main, `worktree /x\nHEAD 1\ndetached`, `worktree /y\nbare`, wt("/z")))
  assert.deepEqual(out, [
    { path: C, branch: "bived" },
    { path: "/x" },
    { path: "/y" },
    { path: "/z", branch: B },
  ])
})

test("a good worktree passes", () => {
  assert.deepEqual(chk(list(main, wt(`${C}/.worktrees/issue-246`))), { ok: true, path: `${C}/.worktrees/issue-246` })
})

test("checkout with a trailing slash still passes", () => {
  const r = checkWorktree({ list: list(main, wt(`${C}/.worktrees/issue-246`)), checkout: C + "/", issue: 246, branch: B })
  assert.equal(r.ok, true)
})

test("missing worktree fails", () => {
  const r = chk(list(main))
  assert.equal(r.ok, false)
  assert.match((r as { reason: string }).reason, /missing/)
})

test("wrong branch fails", () => {
  const r = chk(list(main, wt(`${C}/.worktrees/issue-246`, "other")))
  assert.equal(r.ok, false)
  assert.match((r as { reason: string }).reason, /wrong branch/)
})

test("path equal to the checkout fails", () => {
  const r = chk(list(wt(C)))
  assert.equal(r.ok, false)
  assert.match((r as { reason: string }).reason, /wrong place/)
})

test("path outside .worktrees fails", () => {
  const r = chk(list(main, wt("/elsewhere/issue-246")))
  assert.equal(r.ok, false)
  assert.match((r as { reason: string }).reason, /wrong place/)
})

test("prefix trick issue-2460 fails", () => {
  const r = chk(list(main, wt(`${C}/.worktrees/issue-2460`)))
  assert.equal(r.ok, false)
})

test("checkReady: ok only with role delegate and the canonical identity", () => {
  assert.deepEqual(checkReady({ role: "delegate\n", userName: "delegate a/b", canonical: "a/b" }), { ok: true })
  assert.equal(checkReady({ role: undefined, userName: "delegate a/b", canonical: "a/b" }).ok, false)
  assert.equal(checkReady({ role: "coordinator", userName: "delegate a/b", canonical: "a/b" }).ok, false)
  assert.equal(checkReady({ role: "delegate", userName: undefined, canonical: "a/b" }).ok, false)
  assert.equal(checkReady({ role: "delegate", userName: "delegate a/c", canonical: "a/b" }).ok, false)
})

test("planSetup follows the order and never launches early", () => {
  const good = { ok: true, path: "/p" } as const
  const bad = { ok: false, reason: "wrong place" } as const
  const ready = { ok: true } as const
  assert.deepEqual(planSetup({ worktree: null, ready: null }), { next: "create-worktree" })
  assert.deepEqual(planSetup({ worktree: bad, ready: null }), { stop: "wrong place" })
  assert.deepEqual(planSetup({ worktree: bad, ready }), { stop: "wrong place" })
  assert.deepEqual(planSetup({ worktree: good, ready: null }), { next: "write-role-and-identity" })
  assert.deepEqual(planSetup({ worktree: good, ready: { ok: false, reason: "no role" } }), { stop: "no role" })
  assert.deepEqual(planSetup({ worktree: good, ready }), { next: "launch" })
  assert.deepEqual(planSetup({ worktree: null, ready }), { next: "create-worktree" })
})

test("planRecovery clears only in the one safe case", () => {
  assert.deepEqual(planRecovery({ markerCreatedByThisAttempt: true, sessionActive: false, dirty: [] }), { action: "clear-marker" })
  const stops = [
    { markerCreatedByThisAttempt: false, sessionActive: false, dirty: [] },
    { markerCreatedByThisAttempt: true, sessionActive: true, dirty: [] },
    { markerCreatedByThisAttempt: true, sessionActive: undefined, dirty: [] },
    { markerCreatedByThisAttempt: true, sessionActive: false, dirty: ["a.ts"] },
  ]
  for (const s of stops) {
    const r = planRecovery(s)
    assert.equal(r.action, "stop-and-report")
    assert.equal((r as { reasons: string[] }).reasons.length, 1)
  }
  const all = planRecovery({ markerCreatedByThisAttempt: false, sessionActive: true, dirty: ["a"] })
  assert.equal((all as { reasons: string[] }).reasons.length, 3)
})
