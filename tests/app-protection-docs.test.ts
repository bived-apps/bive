import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

// Issue #239: the owner rollout checklist separates what GitHub's rulesets enforce from what bive-merge-gate
// enforces, and records the denials the owner tested. These tests keep that shape (the section, its four columns,
// the tested rows and the recovery without force).

const ROOT = path.resolve(import.meta.dirname, "..")
const DOC = "docs/REQUIRED-CHECKS.md"
const TITLE = "Owner rollout and denial matrix (issue #239)"
const LINE_BUDGET = 45
const LINE_MAX = 120

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")

const section = (doc: string): string => {
  const start = doc.indexOf(`## ${TITLE}`)
  assert.ok(start >= 0, `the doc has the section "${TITLE}"`)
  const rest = doc.slice(start)
  const next = rest.indexOf("\n## ", 1)
  return next < 0 ? rest : rest.slice(0, next)
}

const cells = (line: string): string[] => line.split("|").map((c) => c.trim()).filter((c) => c !== "")

const rows = (doc: string): string[] => {
  const lines = section(doc).split("\n")
  const header = lines.findIndex((l) => l.startsWith("| Action"))
  assert.notEqual(header, -1, "the denial matrix has a header")
  const found: string[] = []
  for (const line of lines.slice(header + 1)) {
    if (!line.startsWith("|")) break
    if (/^\|[\s|:-]+\|$/.test(line)) continue
    found.push(line)
  }
  return found
}

test("the owner rollout section separates the rulesets from the gate (#239)", () => {
  const s = section(read(DOC))
  assert.ok(s.length > 0)
  for (const re of [
    /One GitHub App for all agents/,
    /no supervisor App/,
    /Integration ruleset/,
    /`bived` and `milestone\/\*`/,
    /deletion refused/,
    /non-fast-forward refused/,
    /merge method `merge` only/,
    /required checks `tests` and `merge-gate`/,
    /`main` ruleset/,
    /Restrict updates with the Repository admin role as the only bypass/,
    /pull requests\s+only/,
    /No bypass for any App/,
    /bive-merge-gate/,
    /Bot or an App is refused/,
  ]) assert.match(s, re)
})

test("the denial matrix has its four columns and a cell in each row (#239)", () => {
  const doc = read(DOC)
  const lines = section(doc).split("\n")
  const header = lines.findIndex((l) => l.startsWith("| Action"))
  assert.notEqual(header, -1, "the denial matrix has a header")
  assert.deepEqual(cells(lines[header]), ["Action", "Actor", "Expected", "Verified"])
  const all = rows(doc)
  assert.ok(all.length >= 6, `the matrix has ${all.length} rows`)
  for (const row of all) assert.equal(cells(row).length, 4, row)
})

test("the matrix records the App-applied label and Restrict updates on main (#239)", () => {
  const all = rows(read(DOC))
  const label = all.find((r) => /dated label/i.test(r))
  assert.ok(label, "a row covers the dated label")
  assert.match(label, /refused by the gate/)
  assert.match(label, /verified 2026-11-14/)
  assert.match(label, /#300/)
  const main = all.find((r) => /Restrict updates/.test(r))
  assert.ok(main, "a row covers Restrict updates on main")
  assert.match(main, /verified 2026-11-15/)
  assert.doesNotMatch(main, /not yet tested/)
})

test("the matrix records the agent comment, the agent merge and the owner's merge (#239)", () => {
  const all = rows(read(DOC))
  const comment = all.find((r) => /comment/i.test(r))
  assert.ok(comment, "a row covers an agent comment")
  assert.match(comment, /bive-agents\[bot\]/)
  assert.match(comment, /verified 2026-11-14/)
  const merge = all.find((r) => /merges into `bived`/.test(r))
  assert.ok(merge, "a row covers an agent merge")
  assert.match(merge, /needs the owner's dated label first/)
  const force = all.find((r) => /force push/.test(r))
  assert.ok(force, "a row covers a force push")
  assert.match(force, /refused by the rulesets/)
  const owner = all.find((r) => /owner merges after labelling/.test(r))
  assert.ok(owner, "a row covers the owner's merge")
  assert.match(owner, /passes/)
})

test("a wrong merge is reverted by a pull request, never by force push (#239)", () => {
  const s = section(read(DOC))
  assert.match(s, /git revert -m 1 <merge>/)
  assert.match(s, /never by force push/)
  assert.match(s, /uninstall the App \(`docs\/GITHUB-APP\.md`\)/)
})

test("stopping the agents needs both the App and the sessions on the owner's own account (#239)", () => {
  const s = section(read(DOC))
  assert.match(s, /sessions that hold an App token/)
  assert.match(s, /opencode service stop/)
  assert.match(s, /the owner's own account/)
  assert.doesNotMatch(s, /stop every agent at once/)
})

test("the section stays within its line budget and no line is over 120 characters (#239)", () => {
  const lines = section(read(DOC)).split("\n")
  assert.ok(lines.length <= LINE_BUDGET, `the section has ${lines.length} lines`)
  lines.forEach((l, i) => assert.ok(l.length <= LINE_MAX, `line ${i + 1} is ${l.length} characters: ${l}`))
})
