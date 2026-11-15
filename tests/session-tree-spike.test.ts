import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")
const SECTIONS = ["## Goal", "## Setup", "## Steps", "## Pass/fail", "## Cleanup", "## Decision after the spike"]

test("the session tree spike doc has its six sections within budget (#243)", () => {
  const d = read("docs/SESSION-TREE-SPIKE.md")
  const lines = d.split("\n")
  if (lines[lines.length - 1] === "") lines.pop()
  assert.ok(lines.length <= 60, `the doc has ${lines.length} lines, at most 60`)
  for (const l of lines) assert.ok(l.length <= 120, `line too long: ${l}`)
  for (const h of SECTIONS) assert.ok(lines.some((l) => l.trim() === h), `missing section ${h}`)
})

test("the spike's questions (a) to (d) each have a pass/fail line", () => {
  const d = read("docs/SESSION-TREE-SPIKE.md")
  for (const q of ["(a)", "(b)", "(c)", "(d)"]) {
    assert.ok(d.split("\n").some((l) => l.includes(q) && l.includes("pass/fail")), `no pass/fail line for ${q}`)
  }
})

test("the cleanup says exact ids and never a pattern, and the restart needs the owner's yes", () => {
  const d = read("docs/SESSION-TREE-SPIKE.md")
  assert.ok(d.includes("exact ids"), "the cleanup must say exact ids")
  assert.ok(d.includes("never by pattern"), "the cleanup must say never by pattern")
  assert.ok(d.includes("owner's explicit yes"), "a restart needs the owner's explicit yes")
})

test("the doc says the coordinator runs the spike, not a delegate", () => {
  const d = read("docs/SESSION-TREE-SPIKE.md")
  assert.ok(d.includes("the coordinator runs it"), "the doc must say the coordinator runs it")
})
