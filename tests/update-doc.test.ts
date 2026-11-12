import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")

test("the update procedure never copies the registry id and keeps the project's own files (#199)", () => {
  const u = read("docs/UPDATE.md")
  assert.match(u, /\| `\.bive\/registry-id` \| It is \*\*Bive's\*\* id/)
  for (const keep of ["opencode.jsonc", ".bive/prompts/project/", ".bive/models.json", ".bive/gate.json",
                      "Project rules", "runs-on", ".bive/state/"]) assert.ok(u.includes(keep), keep)
  for (const k of ["## Turn 1: read only", "## Turn 2: one coordinator pull request", "what changed in the **gate**",
                   "what changed in the **guard**", "Bive: <commit sha", "labelled `coordinator`"]) assert.ok(u.includes(k), k)
})

test("the README and the registry page point at it", () => {
  assert.match(read("README.md"), /docs\/UPDATE\.md/)
  assert.match(read("docs/REGISTRY.md"), /docs\/UPDATE\.md[\s\S]*never copied/)
})
