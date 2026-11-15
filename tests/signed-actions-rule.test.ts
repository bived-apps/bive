import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

test("AGENTS.md: signed actions apply with or without the App token, and the old pre-App wording is gone (#130)", () => {
  const a = fs.readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8")
  assert.doesNotMatch(a, /Immediate rule, before the App exists/)
  assert.match(a, /\*\*Signed actions \(issue #130; the App exists since 2026-11-14/)
  assert.match(a, /signed with its role and model \(`— <role> <provider\/model>`\)/)
  assert.match(a, /a session without one still acts as the owner's login/)
  assert.match(a, /never acts on a pull\s+request it does not own/)
})
