import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const text = fs.readFileSync(new URL("../opencode.jsonc", import.meta.url), "utf8")
const cfg = JSON.parse(text.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"))

test("compaction summaries use a free model listed in the team (owner, 2026-11-15)", () => {
  const m = cfg.agents.compaction.model as string
  assert.match(m, /-free$/)
  const team = JSON.parse(fs.readFileSync(new URL("../.bive/models.json", import.meta.url), "utf8"))
  assert.ok([...team.coordinator, ...team.delegate].includes(m), m)
})
