import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const SECTIONS = ["## Goal", "## Running it", "## Decisions", "## Tasks", "## Watch out", "## Session log"]
// Issue #234: the skeleton and the root handoff both stay within 100 lines; history is linked, not copied.
const SKELETON_BUDGET = 100
const ROOT_CEILING = 100

test("the skeleton handoff stays within its budget and has every section", () => {
  const t = read(".bive/templates/HANDOFF.md")
  assert.ok(t.split("\n").length <= SKELETON_BUDGET)
  for (const s of SECTIONS) assert.ok(t.includes(s), `skeleton lacks ${s}`)
})

test("the root handoff has the same sections, stays within the budget, links its history and references real files", () => {
  const t = read("HANDOFF.md")
  for (const s of SECTIONS) assert.ok(t.includes(s), `root lacks ${s}`)
  assert.ok(t.split("\n").length <= ROOT_CEILING, `HANDOFF.md grew past ${ROOT_CEILING} lines: link history instead`)
  assert.match(t, /blob\/83e3d9f\/HANDOFF\.md/, "the old history must stay reachable through a durable link")
  assert.doesNotMatch(t, /^- \*\*20\d\d-\d\d-\d\d, (?:coordinator|supervisor)[^*]*—/m, "no copied multi-paragraph session history")
  for (const m of t.matchAll(/`((?:docs|tests|\.bive|\.github|\.opencode)\/[\w./-]+\.(?:md|json|ts|yml|mjs))`/g)) {
    assert.ok(fs.existsSync(new URL(`../${m[1]}`, import.meta.url)), `HANDOFF.md references a missing file: ${m[1]}`)
  }
})

test("COORDINATING states the short-handoff rule", () => {
  const d = read("docs/COORDINATING.md")
  assert.match(d, /Short handoffs/)
  assert.match(d, /at most\s+100 lines/)
})
