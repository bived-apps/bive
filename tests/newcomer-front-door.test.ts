import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

// A project's HANDOFF.md must not become a merge journal: it is state a newcomer needs.
// Bound: 200 lines (issue #131). Bive's own HANDOFF.md is exempt (it is Bive's own state, not a template copy).
test("template HANDOFF.md stays under the size bound", () => {
  const text = read(".bive/templates/HANDOFF.md")
  const lines = text.split(/\r?\n/).length
  assert.ok(lines <= 200, `template HANDOFF.md is ${lines} lines; bound is 200`)
})

// AGENTS.md (the copy a project keeps) must start with what the software is, not with roles.
test("template README.md tells a newcomer what to read to run the software", () => {
  const text = read(".bive/templates/README.md")
  assert.match(text, /To run the software/i, "template README must say what to read to run the software")
  assert.match(text, /To start an agent/i, "template README must say what to read only to start an agent")
})
