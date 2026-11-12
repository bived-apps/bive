import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"
// (no yaml dependency; parsing is manual/regex)

const ROOT = path.resolve(import.meta.dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

test("no workflow on a self-hosted label uses pull_request without a base checkout", () => {
  const wfDir = path.join(ROOT, ".github", "workflows")
  const files = fs.readdirSync(wfDir).filter((f) => f.endsWith(".yml"))
  for (const f of files) {
    const text = read(`.github/workflows/${f}`)
    // If a workflow uses runs-on with a self-hosted label, it must not use pull_request without checkout.
    if (/runs-on:.*self-hosted/i.test(text)) {
      if (/on:\s*\n\s*pull_request:/i.test(text) || /^on:\s*\n\s*pull_request:/m.test(text)) {
        assert.fail(`${f} uses pull_request on a self-hosted runner without a base checkout`)
      }
    }
  }
})

test("the gate does not run on the same runner label as the checks it waits for", () => {
  const gate = read(".github/workflows/bive-merge-gate.yml")
  // The gate must run on ubuntu-latest (hosted), not on a self-hosted label.
  assert.match(gate, /runs-on:\s*ubuntu-latest/, "gate must run on ubuntu-latest")
  assert.doesNotMatch(gate, /runs-on:.*self-hosted/i, "gate must not run on a self-hosted label")
})

test("SELF-HOSTED.md exists and lists the checklist", () => {
  const text = read("docs/SELF-HOSTED.md")
  assert.match(text, /Runner health before a milestone/)
  assert.match(text, /File-level checks/)
})