import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

test("ROLE-START designs the precedence, the one question, fail-closed eligibility and no questions when non-interactive", () => {
  const d = read("docs/ROLE-START.md")
  for (const re of [/named agent/, /BIVE_ROLE/, /\.bive\/state\/role/, /none of these/, /conflict/i, /fails? closed/,
    /Non-interactive runs never ask/, /bive-ask-owner/, /Authority stays explicit/, /proposal, not in force/]) assert.match(d, re)
})

test("ADVISOR-INVITATIONS keeps advice non-authoritative, discloses provider and price, and marks what is unverified", () => {
  const d = read("docs/ADVISOR-INVITATIONS.md")
  for (const re of [/never a new execution role/, /serving provider/, /unknown price is not free/, /full transcript/,
    /Unverified/, /advice, not authorization/, /proposal, not in force/]) assert.match(d, re)
})
