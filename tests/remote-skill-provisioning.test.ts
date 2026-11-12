import assert from "node:assert/strict"
import test from "node:test"
import os from "node:os"
import path from "node:path"
import fs from "node:fs"
import { provisionRemote, MissingSkillError, SkillRevisionMismatchError } from "../lib/skill-provisioning.ts"
import { computeRevision } from "../lib/skill-provisioning.ts"

function mkroot() { return fs.mkdtempSync(path.join(os.tmpdir(), "bive-remote-")) }
function writeSkill(root, id, content = "# skill\n", relDir = ".opencode/skills") {
  const dir = path.join(root, relDir, id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "SKILL.md"), content)
  return dir
}
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name)
    if (e.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

test("remote same-commit verify", () => {
  const local = mkroot()
  const remote = mkroot()
  writeSkill(local, "s", "# v1\n")
  const h = computeRevision(path.join(local, ".opencode", "skills", "s"))
  const manifest = { version: 1, roles: { delegate: ["s"] }, skills: { s: { source: "project", path: ".opencode/skills/s", revision: h } } }
  fs.mkdirSync(path.join(local, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(local, ".bive", "skills.json"), JSON.stringify(manifest))
  copyDir(local, remote)
  const report = provisionRemote({ localRoot: local, remoteRoot: remote, role: "delegate" })
  assert.equal(report.skills.length, 1)
  assert.ok(fs.existsSync(path.join(remote, ".bive", "skills.report.json")))
})

test("remote bundle push", () => {
  const local = mkroot()
  const remote = mkroot()
  writeSkill(local, "s", "# v1\n")
  const h = computeRevision(path.join(local, ".opencode", "skills", "s"))
  const manifest = { version: 1, roles: { delegate: ["s"] }, skills: { s: { source: "project", path: ".opencode/skills/s", revision: h } } }
  fs.mkdirSync(path.join(local, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(local, ".bive", "skills.json"), JSON.stringify(manifest))
  fs.mkdirSync(path.join(remote, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(remote, ".bive", "skills.json"), JSON.stringify(manifest))
  const report = provisionRemote({ localRoot: local, remoteRoot: remote, role: "delegate" })
  assert.equal(report.skills.length, 1)
  assert.ok(fs.existsSync(path.join(remote, ".opencode", "skills", "s", "SKILL.md")))
})

test("remote missing fails", () => {
  const remote = mkroot()
  const manifest = { version: 1, roles: { delegate: ["s"] }, skills: { s: { source: "project", path: ".opencode/skills/s", revision: "abc" } } }
  fs.mkdirSync(path.join(remote, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(remote, ".bive", "skills.json"), JSON.stringify(manifest))
  assert.throws(() => provisionRemote({ remoteRoot: remote, role: "delegate" }), (e:any) => e instanceof MissingSkillError)
})

test("remote mismatched fails", () => {
  const remote = mkroot()
  writeSkill(remote, "s", "# v2\n")
  const manifest = { version: 1, roles: { delegate: ["s"] }, skills: { s: { source: "project", path: ".opencode/skills/s", revision: "deadbeef" } } }
  fs.mkdirSync(path.join(remote, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(remote, ".bive", "skills.json"), JSON.stringify(manifest))
  assert.throws(() => provisionRemote({ remoteRoot: remote, role: "delegate" }), (e:any) => e instanceof SkillRevisionMismatchError)
})