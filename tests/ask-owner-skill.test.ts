import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"
import { provisionLocal } from "../lib/skill-provisioning.ts"

const ROOT = path.resolve(import.meta.dirname, "..")
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")

test("every role gets the bive-ask-owner skill at the declared revision", () => {
  // Editing the skill changes its hash: update .bive/skills.json (revision) in the same commit.
  for (const role of ["supervisor", "coordinator", "delegate"]) {
    const report = provisionLocal({ root: ROOT, role, reportPath: false })
    assert.deepEqual(report.skills.map((s) => s.id), ["bive-ask-owner"], role)
    assert.equal(report.skills[0].revision, report.skills[0].observed_revision, role)
  }
})

test("the question template offers yes, no and other, with a recommendation and reversibility", () => {
  const t = read(".bive/templates/question.md")
  for (const k of ["**Yes**", "**No**", "**Other**", "**Ask supervisor**", "**Coordinator decides**", "**Recommended**", "**Blocks**", "**Reversible**", "**Default if unanswered**"]) {
    assert.ok(t.includes(k), `template lacks ${k}`)
  }
})

test("the skill states the ladder and the delegate and coordinator prompts point at it", () => {
  const s = read(".opencode/skills/bive-ask-owner/SKILL.md")
  assert.match(s, /^---\nname: bive-ask-owner\n/)
  assert.match(s, /Delegate.*Coordinator.*Supervisor/s)
  assert.match(read(".bive/prompts/DELEGATE.md"), /bive-ask-owner/)
  assert.match(read(".bive/prompts/COORDINATOR.md"), /bive-ask-owner/)
})
