import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

test("AGENTS.md carries the role-at-start rule and agrees with docs/ROLE-START.md (#232)", () => {
  const a = read("AGENTS.md")
  for (const re of [/Role at session start/, /named agent/, /BIVE_ROLE/, /\.bive\/state\/role/, /\.worktrees\/issue-<n>/,
    /asks once/, /none of these/, /never\s+asks/, /blocked: no role assigned/, /grants no authority/, /\.bive\/models\.json/,
    /only a work role sets its worktree identity/]) assert.match(a, re)
  const d = read("docs/ROLE-START.md")
  for (const re of [/named agent/, /BIVE_ROLE/, /none of these/, /blocked: no role assigned/]) assert.match(d, re)
})

test("the role question comes first in AGENTS.md, before any answer, and OpenCode's agents are not a role (#232)", () => {
  const a = read("AGENTS.md")
  const first = a.indexOf("## First, before you answer anything: your role")
  assert.ok(first > 0 && first < a.indexOf("## Roles"), "the role section precedes ## Roles")
  const sec = a.slice(first, a.indexOf("## Roles"))
  assert.match(sec, /Before replying to the first message of a session, even a greeting or a plain question/)
  assert.match(sec, /`build`, `plan`, `general`, `explore`\) are \*\*not\*\* a Bive role/)
  assert.match(sec, /advisor,\s+coordinator, delegate, none of these: just answer a question/)
  assert.match(sec, /never ask again in this\s+session/)
  assert.match(a, /the named agent \(a Bive one: advisor, coordinator, delegate\)/)
})
