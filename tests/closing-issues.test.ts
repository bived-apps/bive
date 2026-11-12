import assert from "node:assert/strict"
import test from "node:test"
import { closingIssueNumbers } from "../lib/closing-issues.ts"

test("one closing keyword per line closes one issue", () => {
  assert.deepEqual(closingIssueNumbers("Closes #1\nCloses #2"), [1, 2])
})

test("Closes #1, #2 closes only the first issue", () => {
  assert.deepEqual(closingIssueNumbers("Closes #1, #2"), [1])
})

test("Part of does not close", () => {
  assert.deepEqual(closingIssueNumbers("Part of #3\nCloses #4"), [4])
})

test("a line without a leading closing keyword does not close", () => {
  assert.deepEqual(closingIssueNumbers("Fixes nothing here"), [])
  assert.deepEqual(closingIssueNumbers(""), [])
  assert.deepEqual(closingIssueNumbers("Resolves #5"), [5])
})