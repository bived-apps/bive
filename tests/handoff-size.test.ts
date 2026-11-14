import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const SECTIONS = ["## Goal", "## Running it", "## Decisions", "## Tasks", "## Watch out", "## Session log"]
// Issue #234: the skeleton budget is 100 lines. The root handoff is a RATCHET: it may shrink but not grow past this
// ceiling until the owner approves moving its history to durable links (issue/commit URLs), then lower it to 100.
const SKELETON_BUDGET = 100
const ROOT_CEILING = 430

test("the skeleton handoff stays within its budget and has every section", () => {
  const t = read(".bive/templates/HANDOFF.md")
  assert.ok(t.split("\n").length <= SKELETON_BUDGET)
  for (const s of SECTIONS) assert.ok(t.includes(s), `skeleton lacks ${s}`)
})

test("the root handoff has the same sections and does not grow past the ratchet", () => {
  const t = read("HANDOFF.md")
  for (const s of SECTIONS) assert.ok(t.includes(s), `root lacks ${s}`)
  assert.ok(t.split("\n").length <= ROOT_CEILING, `HANDOFF.md grew past ${ROOT_CEILING} lines: link history instead`)
})

test("COORDINATING states the short-handoff rule", () => {
  const d = read("docs/COORDINATING.md")
  assert.match(d, /Short handoffs/)
  assert.match(d, /at most\s+100 lines/)
})
