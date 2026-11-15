import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

test("COORDINATING states what makes CI evidence reusable and what does not (#227)", () => {
  const d = read("docs/COORDINATING.md")
  for (const re of [/reviewed head SHA/, /run URL/, /synthetic\s+merge SHA/, /stale/, /partial run that still exited 0/,
    /skipped/, /untrusted/, /core run once per batch|once per batch of merges/]) assert.match(d, re)
  assert.match(read("docs/REQUIRED-CHECKS.md"), /Reusing CI as evidence/)
})

test("COORDINATING makes the milestone the work queue with one query per object type (#228)", () => {
  const d = read("docs/COORDINATING.md")
  assert.match(d, /gh issue list --milestone/)
  assert.match(d, /gh pr list --state open --search 'milestone:/)
  assert.match(d, /`Part of`\s+issue stays open/)
  assert.match(d, /no:milestone/)
})

test("PROVIDERS states the least-cost capable rule, cites bench, and invents no price (#231)", () => {
  const d = read("docs/PROVIDERS.md")
  for (const re of [/least costly model that is capable/, /RESULTS\.md/, /unknown price is not free/, /canonical/,
    /no prices/]) assert.match(d, re)
})

test("the merge exception is no longer described as 'design, not implemented' in REQUIRED-CHECKS (COORDINATING is corrected by PR 267)", () => {
  for (const f of ["docs/REQUIRED-CHECKS.md"]) assert.doesNotMatch(read(f), /design, not implemented/)
})
