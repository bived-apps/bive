import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

test("every label the flow reads is documented, and the code reads exactly those", () => {
  const doc = read("docs/REQUIRED-CHECKS.md")
  const lib = read(".github/scripts/merge-gate-lib.mjs")
  const prefixes = [...lib.matchAll(/LABEL_PREFIX = "([^"]+)"/g)].map((m) => m[1])
  assert.equal(prefixes.length, 2)
  for (const p of prefixes) assert.ok(doc.includes(`${p}YYYY-MM-DD`), `undocumented gate label ${p}`)
  assert.match(read(".github/workflows/bive-inviolable.yml"), /'coordinator'/)
  assert.match(doc, /`coordinator`/)
  assert.match(read(".github/workflows/bive-base-red.yml"), /--label "bug"/)
  assert.match(doc, /`bug`/)
})

test("no status-style label (started, done, blocked, callback) is used by any workflow or documented as required", () => {
  const doc = read("docs/REQUIRED-CHECKS.md")
  assert.match(doc, /no started, in-progress, done, blocked or callback label/)
  for (const f of fs.readdirSync(new URL("../.github/workflows/", import.meta.url))) {
    assert.doesNotMatch(read(`.github/workflows/${f}`), /--add-label|addLabels|--label "(?:started|done|blocked|wip|in progress)"/i, f)
  }
})

test("session start creates the coordinator label next to the dated one", () => {
  assert.match(read("docs/COORDINATING.md"), /gh label create coordinator/)
})
