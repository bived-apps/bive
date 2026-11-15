import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

test("docs/ROLE-STYLE.md states output, reading and session rules and never loosens the core prompts", () => {
  const d = read("docs/ROLE-STYLE.md")
  for (const re of [/No greetings/, /one-line|One line|one line/, /\/compact/, /new session/i, /never loosen/, /core prompt wins/]) {
    assert.match(d, re)
  }
})

test("each role has a short project addition that points at the style doc and loosens nothing", () => {
  for (const role of ["ADVISOR", "COORDINATOR", "DELEGATE"]) {
    const p = read(`.bive/prompts/project/${role}.md`)
    assert.match(p, /docs\/ROLE-STYLE\.md/)
    assert.match(p, /never loosens a core rule/)
    assert.ok(p.split("\n").length <= 10, `${role} addition stays short`)
  }
})
