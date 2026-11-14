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
