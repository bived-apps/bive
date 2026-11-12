import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")

test("the hand-over is a GitHub comment on the epic, found by its first line (#202)", () => {
  const d = read("docs/COORDINATING.md")
  const s = d.slice(d.indexOf("## Start a coordinator"), d.indexOf("## Start a delegate"))
  assert.ok(s.length > 300, "the section exists before 'Start a delegate'")
  for (const k of ["# Launch #", "OWNER", "COLLABORATOR", "gh api", "newest"]) assert.ok(s.includes(k), k)
  assert.match(read(".bive/templates/launch.md"), /^# Launch #<milestone>/)
  assert.match(read(".bive/templates/launch.md"), /ONE comment on the milestone's epic issue/)
  assert.match(read(".bive/prompts/SUPERVISOR.md"), /one\s+comment on the\s+milestone's epic issue/)
})

test("the jq filter of the doc selects the newest hand-over of a trusted account", () => {
  const d = read("docs/COORDINATING.md")
  assert.match(d, /select\(\.body \| startswith\("# Launch #"\)\)/)
  assert.match(d, /select\(\.author_association \| IN\("OWNER","MEMBER","COLLABORATOR"\)\)/)
  assert.match(d, /\| last \| \.body/)
})
