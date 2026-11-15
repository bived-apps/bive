import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

test("AGENTS.md asks for #N as links to the current repository and a direct link at hand-over", () => {
  const a = fs.readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8")
  assert.match(a, /Issues and pull requests as links \(owner, 2026-11-14\)/)
  assert.match(a, /\[#N\]\(https:\/\/github\.com\/<owner>\/<repo>\/issues\/N\)/)
  assert.match(a, /direct link to each pull request ready to merge/)
})
