import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

// Field report #345 (2026-11-15): the rules that stop the slips it recorded stay written where each role reads them.
const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

test("the coordinator checks its model before each commit and never falls back to the owner's login", () => {
  const c = read(".bive/prompts/COORDINATOR.md")
  assert.match(c, /Before each commit and each signed GitHub action, check that the session's\s+model/)
  assert.match(c, /never fall back to\s+the owner's login unless the owner asks/)
})

test("the coordinator never commits in a delegate's worktree, and Ready to merge quotes a run made in that turn", () => {
  const c = read(".bive/prompts/COORDINATOR.md")
  assert.match(c, /never edit or commit in a delegate's worktree yourself/)
  assert.match(c, /the checks you ran in that\s+turn, quoting their summary lines/)
  assert.match(c, /one App for all agents GitHub refuses an approval/)
})

test("the scratch rule is in the delegate prompt and the brief template", () => {
  assert.match(read(".bive/prompts/DELEGATE.md"), /Scratch files go under `\.bive\/state\/` inside it, never\s+`\/tmp`/)
  assert.match(read(".bive/templates/brief.md"), /Scratch files go under `\.bive\/state\/` in your worktree, never `\/tmp`/)
})

test("COORDINATING says where a copy of another repository goes", () => {
  assert.match(read("docs/COORDINATING.md"), /## Reading another repository/)
})

test("the coordinator pull-request slot guards inviolable files, and state files go one at a time (#324)", () => {
  const c = read(".bive/prompts/COORDINATOR.md")
  assert.match(c, /check that no other open `coordinator` pull request\s+touches one/)
  assert.match(c, /keep `HANDOFF\.md`\s+and `ROADMAP\.md` changes to one open pull request at a time/)
})
