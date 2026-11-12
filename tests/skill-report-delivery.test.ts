import assert from "node:assert/strict"
import test from "node:test"
import os from "node:os"
import path from "node:path"
import fs from "node:fs"
import { provisionLocal, computeRevision } from "../lib/skill-provisioning.ts"
import {
  buildSkillReportMessage,
  formatSkillReport,
  skillReportInstructionEntry,
} from "../lib/skill-provisioning.ts"

function mkroot() { return fs.mkdtempSync(path.join(os.tmpdir(), "bive-skill-report-")) }
function writeSkill(root, id, content = "# skill\n") {
  const dir = path.join(root, ".opencode", "skills", id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "SKILL.md"), content)
  return dir
}
function makeManifest(root, role, skills) {
  const manifest = { version: 1, roles: { [role]: Object.keys(skills) }, skills }
  fs.mkdirSync(path.join(root, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(root, ".bive", "skills.json"), JSON.stringify(manifest))
}

test("builds a system message carrying role, source revision and per-skill revisions", async () => {
  const root = mkroot()
  writeSkill(root, "bive-delegate-brief", "# delegate brief\n")
  const skillDir = path.join(root, ".opencode", "skills", "bive-delegate-brief")
  const hash = computeRevision(skillDir)
  makeManifest(root, "delegate", {
    "bive-delegate-brief": { source: "project", path: ".opencode/skills/bive-delegate-brief", revision: hash },
  })
  const report = provisionLocal({ root, role: "delegate", reportPath: false })
  const message = buildSkillReportMessage(report)
  assert.equal(typeof message, "string")
  assert.match(message, /bive-delegate-brief/)
  assert.match(message, new RegExp(hash))
  assert.match(message, new RegExp(report.source_revision))
  assert.match(message, /role: delegate/)
  assert.match(message, /source: project/)
  assert.match(message, /origin: \.opencode\/skills\/bive-delegate-brief/)
})

test("instruction entry variant carries the same content", async () => {
  const root = mkroot()
  writeSkill(root, "s", "# v1\n")
  const hash = computeRevision(path.join(root, ".opencode", "skills", "s"))
  makeManifest(root, "delegate", { s: { source: "project", path: ".opencode/skills/s", revision: hash } })
  const report = provisionLocal({ root, role: "delegate", reportPath: false })
  const entry: any = skillReportInstructionEntry(report)
  assert.equal(entry.role, "system")
  assert.match(String(entry.content), /s/)
  assert.match(String(entry.content), new RegExp(hash))
  assert.match(String(entry), new RegExp(report.source_revision))
})

test("formatSkillReport alias agrees", async () => {
  const root = mkroot()
  writeSkill(root, "s", "# v1\n")
  const hash = computeRevision(path.join(root, ".opencode", "skills", "s"))
  makeManifest(root, "delegate", { s: { source: "project", path: ".opencode/skills/s", revision: hash } })
  const report = provisionLocal({ root, role: "delegate", reportPath: false })
  assert.equal(formatSkillReport(report), buildSkillReportMessage(report))
})
