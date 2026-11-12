import assert from "node:assert/strict"
import test from "node:test"
import { hasInheritedCommits, hasMergeCommits, isCleanBranch } from "../lib/branch-hygiene.ts"

test("a clean branch has no inherited commits and no merge commits", () => {
  const base = new Set(["a", "b", "c"])
  const branch = ["d", "e"]
  assert.equal(hasInheritedCommits(base, branch), false)
  assert.equal(hasMergeCommits([]), false)
  assert.equal(isCleanBranch(base, branch, []), true)
})

test("inherited commits are detected", () => {
  const base = new Set(["a", "b", "c"])
  const branch = ["b", "d"] // "b" is inherited from base
  assert.equal(hasInheritedCommits(base, branch), true)
  assert.equal(isCleanBranch(base, branch, []), false)
})

test("merge commits are detected", () => {
  assert.equal(hasMergeCommits(["merge1"]), true)
  const base = new Set(["a", "b"])
  assert.equal(isCleanBranch(base, ["c"], ["merge1"]), false)
})