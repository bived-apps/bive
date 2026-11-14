import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

test("the identity benchmark draft keeps its authority limits, hard-fail cases and unverified-identity rule", () => {
  const d = fs.readFileSync(new URL("../docs/IDENTITY-BENCH.md", import.meta.url), "utf8")
  for (const re of [/protocol draft/i, /Capability evidence only/, /grants no authority/, /unverified/, /fresh agent/,
    /3 fresh draws/, /hard fail/i, /bench history is frozen/i, /no model judge/, /Open \(owner\)/]) assert.match(d, re)
  for (let n = 1; n <= 9; n++) assert.match(d, new RegExp(`^\\| ${n} \\|`, "m"), `case ${n} is missing`)
})
