import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const DOC = read("docs/ACTORS.md")

test("the actors doc has the paragraph, the table, no self-approval and conflicts", () => {
  assert.match(DOC, /bive-agents\[bot\]/)
  assert.match(DOC, /## End to end/)
  assert.match(DOC, /## No self-approval/)
  assert.match(DOC, /## Conflicts with current rules/)
})

test("the actors table has the four columns and covers every step row", () => {
  assert.ok(DOC.includes("| Step | Who acts | GitHub actor | Proof of role |"))
  for (const step of ["claim", "push", "pull request", "review", "label", "merge", "close", "advisor"]) {
    assert.ok(DOC.toLowerCase().includes(step), `the actors table must cover the ${step} step`)
  }
})

test("the pull request is opened by the coordinator, never the delegate", () => {
  const row = DOC.split("\n").find((l) => l.startsWith("| Open the pull request"))
  assert.ok(row, "the actors table must have an Open the pull request row")
  assert.match(row, /coordinator only, never the delegate/)
})

test("the dated label is owner only and an App-applied label is refused", () => {
  const row = DOC.split("\n").find((l) => l.startsWith("| Apply the dated label"))
  assert.ok(row, "the actors table must have an Apply the dated label row")
  assert.match(row, /owner only/i)
  assert.match(row, /refus/i)
  assert.match(row, /App/)
})

test("the actors doc stays within 50 lines and 120 characters per line", () => {
  const lines = DOC.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim().length > 0)
  assert.ok(lines.length <= 50, `docs/ACTORS.md has ${lines.length} lines, budget is 50`)
  for (const line of lines) assert.ok(line.length <= 120, `docs/ACTORS.md line exceeds 120 characters: ${line}`)
})
