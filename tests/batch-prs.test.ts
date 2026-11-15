import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

// #254 batch A: bounded batch pull requests, written where each role reads them.
const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

test("AGENTS.md allows one pull request per bounded batch of related issues, with its cap", () => {
  const a = read("AGENTS.md")
  assert.match(a, /\*\*Or per bounded batch\*\*/)
  assert.match(a, /at most 6 files changed besides tests/)
  assert.match(a, /Unrelated issues never share a pull request/)
})

test("the coordinator prompt sends state files along with their batch", () => {
  assert.match(read(".bive/prompts/COORDINATOR.md"), /ride in it rather than in a\s+pull request of their own/)
})

test("COORDINATING describes batch pull requests", () => {
  const c = read("docs/COORDINATING.md")
  assert.match(c, /## Batch pull requests \(issue #254/)
  for (const w of ["`batch/<slug>`", "one `Closes #N` line per issue", "Scope cap", "State files ride along"]) assert.ok(c.includes(w), w)
})

test("COORDINATING keeps the setup and stop defaults in one place (#254 batch A)", () => {
  const c = read("docs/COORDINATING.md")
  assert.match(c, /## Setup and stop defaults \(issue #254/)
  for (const w of ["Continue a\n  delegate only by its own session id", "**on another provider**", "Stop with a hand-over", "Use absolute paths"]) assert.ok(c.includes(w), w)
  assert.match(read(".bive/prompts/COORDINATOR.md"), /fall back to a model on another provider/)
})
