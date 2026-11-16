import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

test("GitHub App doc records what exists, tests, tokens and revoke steps", () => {
  const d = fs.readFileSync(new URL("../docs/GITHUB-APP.md", import.meta.url), "utf8")

  for (const re of [
    /one App for all agents/i,
    /no agent creates or installs the App/,
    /Do not give the App any bypass/,
    /cannot tell them apart/,
    /^## What exists \(2026-11-14\)/m,
    /^## Tests passed/m,
    /^## Tokens for a session \(option A, #299\)/m,
    /^## Revoke, rotate, stop/m,
    /\b5761164\b/,
    /`bived-agents`/,
    /refused by bive-merge-gate/,
    /one hour/i,
    /generate a new key on the App page, store it, delete the old key on the App page/,
    /delete every key or suspend\/uninstall the App on the organisation's installed Apps page/,
    /uninstall the App to stop App-token sessions; stop the OpenCode service and sessions/,
  ]) {
    assert.match(d, re)
  }

  assert.doesNotMatch(d, /BEGIN/)
  assert.doesNotMatch(d, /PRIVATE KEY/)
})
