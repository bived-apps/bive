import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")

test(".bive/models.json lists a non-empty, ordered array of provider/model for each role (#203)", () => {
  const cfg = JSON.parse(read(".bive/models.json"))
  for (const role of ["coordinator", "delegate"]) {
    assert.ok(Array.isArray(cfg[role]) && cfg[role].length > 0, `${role} list`)
    for (const m of cfg[role]) assert.match(m, /^[^/\s]+\/\S+$/, `${role}: ${m}`)
    assert.equal(new Set(cfg[role]).size, cfg[role].length, `${role} has no duplicates`)
  }
})

test("the fallback switch, the commit identity and the coordinator minimum are written down (#203)", () => {
  const p = read("docs/PROVIDERS.md")
  for (const k of ["## The list per role", "## Switching mid-work", "opencode run --continue", "config --worktree user.name",
                   "## Minimum for the coordinator", "published pass", "milestone-run", "allow-list"]) assert.ok(p.includes(k), k)
  const c = read(".bive/prompts/COORDINATOR.md")
  assert.match(c, /Switching mid-work/)
  assert.match(c, /Minimum for the\s+coordinator/)
})
