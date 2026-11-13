import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")

test("the coordinator's own refusals follow the delegate's rule, with one stated exception (#201)", () => {
  const p = read(".bive/prompts/COORDINATOR.md")
  assert.match(p, /\*\*Your own refusals\*\*/)
  assert.match(p, /do not\s+run the same effect another way/)
  assert.match(p, /invalid-structure/)
  assert.match(p, /boundary: stop/)
  const d = read("docs/COORDINATING.md")
  const section = d.slice(d.indexOf("## Your own refusals"), d.indexOf("## After the batch"))
  assert.ok(section.length > 200, "the section exists and sits before 'After the batch'")
  for (const k of ["--body-file", "from the root", "bive-ask-owner", "shape", "where"]) assert.ok(section.includes(k), k)
})
