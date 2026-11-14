import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const size = (p: string) => fs.statSync(new URL(`../${p}`, import.meta.url)).size
const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

// Fixed context a role is told to read at start (issue #233). Ceilings sit a little above the measured sizes
// (docs/ROLE-CONTEXT.md) so ordinary edits fit and a regression such as a 40 KB handoff does not.
const FILES = {
  delegate: ["AGENTS.md", "HANDOFF.md", ".bive/prompts/DELEGATE.md", ".bive/prompts/project/DELEGATE.md"],
  advisor: ["AGENTS.md", "HANDOFF.md", ".bive/prompts/ADVISOR.md", ".bive/prompts/project/ADVISOR.md"],
  coordinator: ["AGENTS.md", "HANDOFF.md", ".bive/prompts/COORDINATOR.md", ".bive/prompts/project/COORDINATOR.md"],
}
const CEILING = { delegate: 30_000, advisor: 28_000, coordinator: 42_000 }

for (const role of Object.keys(FILES) as Array<keyof typeof FILES>) {
  test(`fixed context of the ${role} stays under its ceiling`, () => {
    const total = FILES[role].reduce((n, f) => n + size(f), 0)
    assert.ok(total <= CEILING[role], `${role} fixed context is ${total} B, ceiling ${CEILING[role]} B`)
  })
}

test("the safety rules stay in the role prompts and docs/ROLE-CONTEXT.md states the measured budget and the open decision", () => {
  assert.match(read(".bive/prompts/DELEGATE.md"), /Never create a pull request/)
  assert.match(read(".bive/prompts/DELEGATE.md"), /Hard stop on refusal/)
  const d = read("docs/ROLE-CONTEXT.md")
  for (const re of [/40,721 B/, /6,880 B/, /Owner decision/, /not verified here/]) assert.match(d, re)
})

test("the coordinator project addition names the milestone queue (#228)", () => {
  assert.match(read(".bive/prompts/project/COORDINATOR.md"), /Milestones are the work queue/)
})
