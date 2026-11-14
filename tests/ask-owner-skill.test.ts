import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"
import { provisionLocal } from "../lib/skill-provisioning.ts"

const ROOT = path.resolve(import.meta.dirname, "..")
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")

test("every role gets the bive-ask-owner skill at the declared revision", () => {
  // Editing the skill changes its hash: update .bive/skills.json (revision) in the same commit.
  for (const role of ["advisor", "coordinator", "delegate"]) {
    const report = provisionLocal({ root: ROOT, role, reportPath: false })
    const expected = role === "coordinator" ? ["bive-ask-owner", "bive-pick-model", "bive-registry-optin"] : ["bive-ask-owner"]
    assert.deepEqual(report.skills.map((s) => s.id).sort(), expected, role)
    for (const s of report.skills) assert.equal(s.revision, s.observed_revision, `${role} ${s.id}`)
  }
})

test("the question template offers yes, no and other, with a recommendation and reversibility", () => {
  const t = read(".bive/templates/question.md")
  for (const k of ["**To**", "**Path**", "**Yes**", "**No**", "**Other**", "**Ask advisor**", "**Coordinator decides**", "**Recommended**", "**Blocks**", "**Reversible**", "**Default if unanswered**"]) {
    assert.ok(t.includes(k), `template lacks ${k}`)
  }
})

test("the skill states the ladder and the delegate and coordinator prompts point at it", () => {
  const s = read(".opencode/skills/bive-ask-owner/SKILL.md")
  assert.match(s, /^---\nname: bive-ask-owner\n/)
  assert.match(s, /Delegate.*Coordinator.*Owner/s)
  assert.match(s, /Bypass/)
  assert.match(s, /GitHub record/)
  assert.match(s, /unanswered after 1/)
  assert.match(s, /transmit/i)
  assert.match(read(".bive/prompts/DELEGATE.md"), /bive-ask-owner/)
  assert.match(read(".bive/prompts/COORDINATOR.md"), /bive-ask-owner/)
})

test("the registry opt-in skill creates no id without a yes, and the human guide covers the label", () => {
  const s = read(".opencode/skills/bive-registry-optin/SKILL.md")
  assert.match(s, /^---\nname: bive-registry-optin\n/)
  assert.match(s, /never create, copy or commit an id without a yes/i)
  assert.match(s, /write nothing/i)
  const h = read("docs/FOR-HUMANS.md")
  assert.match(h, /bive-merge-authorized-until-YYYY-MM-DD/)
  assert.match(h, /registry/i)
})

test("the pick-model skill points at the check, keeps the probe opt-in and the canonical identity (#206)", () => {
  const s = read(".opencode/skills/bive-pick-model/SKILL.md")
  assert.match(s, /^---\nname: bive-pick-model\n/)
  assert.match(s, /node lib\/models-check-cli\.ts/)
  assert.match(s, /--probe/)
  assert.match(s, /It sends nothing/)
  assert.match(s, /\*\*canonical\*\* name/)
  assert.ok(fs.existsSync(path.join(ROOT, "lib/models-check-cli.ts")))
  assert.match(read("docs/PROVIDERS.md"), /models-check-cli\.ts/)
})
