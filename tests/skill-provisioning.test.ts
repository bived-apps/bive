import assert from "node:assert/strict"
import test from "node:test"
import os from "node:os"
import path from "node:path"
import fs from "node:fs"
import crypto from "node:crypto"
import { provisionLocal, validateManifest, computeRevision, hashDirectory, MissingSkillError, SkillRevisionMismatchError, SkillConflictError, PathSafetyError } from "../lib/skill-provisioning.ts"

function mkroot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bive-skill-"))
}

function writeSkill(root: string, id: string, content = "# skill\n", relDir = ".opencode/skills") {
  const dir = path.join(root, relDir, id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "SKILL.md"), content)
  return dir
}

function sha256File(p: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")
}

function makeManifest(root: string, role: string, skills: Record<string, any>, roles?: Record<string, string[]>) {
  const manifest = {
    version: 1,
    roles: roles ?? { [role]: Object.keys(skills) },
    skills,
  }
  fs.mkdirSync(path.join(root, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(root, ".bive", "skills.json"), JSON.stringify(manifest, null, 2))
  return manifest
}

test("provisions a declared skill and writes the revision report", () => {
  const root = mkroot()
  const content = "# delegate brief\n"
  writeSkill(root, "bive-delegate-brief", content)
  const skillDir = path.join(root, ".opencode", "skills", "bive-delegate-brief")
  const hash = hashDirectory ? (computeRevision(skillDir)) : ""
  const manifestSkills = {
    "bive-delegate-brief": { source: "project", path: ".opencode/skills/bive-delegate-brief", revision: hash },
  }
  makeManifest(root, "delegate", manifestSkills)
  const report = provisionLocal({ root, role: "delegate" })
  assert.equal(report.role, "delegate")
  assert.equal(report.skills.length, 1)
  assert.equal(report.skills[0].id, "bive-delegate-brief")
  assert.equal(report.skills[0].revision, hash)
  assert.equal(report.skills[0].observed_revision, hash)
  assert.ok(fs.existsSync(path.join(root, ".bive", "skills.report.json")))
  const written = JSON.parse(fs.readFileSync(path.join(root, ".bive", "skills.report.json"), "utf8"))
  assert.equal(written.skills[0].id, "bive-delegate-brief")
})

test("fails clearly on missing skill", () => {
  const root = mkroot()
  makeManifest(root, "delegate", {
    "missing-skill": { source: "project", path: ".opencode/skills/missing-skill", revision: "abc" },
  })
  assert.throws(() => provisionLocal({ root, role: "delegate" }), (e: any) => {
    assert.ok(e instanceof MissingSkillError)
    assert.match(e.message, /missing-skill/)
    assert.match(e.message, /delegate/)
    assert.match(e.message, /expected revision abc/)
    assert.match(e.message, /observed missing/)
    return true
  })
})

test("fails clearly on revision mismatch", () => {
  const root = mkroot()
  writeSkill(root, "s", "# v1\n")
  const dir = path.join(root, ".opencode", "skills", "s")
  makeManifest(root, "delegate", {
    s: { source: "project", path: ".opencode/skills/s", revision: "deadbeef" },
  })
  assert.throws(() => provisionLocal({ root, role: "delegate" }), (e: any) => {
    assert.ok(e instanceof SkillRevisionMismatchError)
    assert.match(e.message, /s/)
    assert.match(e.message, /expected deadbeef/)
    assert.match(e.message, /observed [0-9a-f]{64}/)
    return true
  })
})

test("role scoping: only the role's skills are provisioned", () => {
  const root = mkroot()
  writeSkill(root, "shared", "# shared\n")
  writeSkill(root, "coord-only", "# coord\n")
  const sharedHash = computeRevision(path.join(root, ".opencode", "skills", "shared"))
  const coordHash = computeRevision(path.join(root, ".opencode", "skills", "coord-only"))
  const manifest = {
    version: 1,
    roles: {
      delegate: ["shared"],
      coordinator: ["shared", "coord-only"],
    },
    skills: {
      shared: { source: "project", path: ".opencode/skills/shared", revision: sharedHash },
      "coord-only": { source: "project", path: ".opencode/skills/coord-only", revision: coordHash },
    },
  }
  fs.mkdirSync(path.join(root, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(root, ".bive", "skills.json"), JSON.stringify(manifest))
  const dReport = provisionLocal({ root, role: "delegate", reportPath: false })
  assert.deepEqual(dReport.skills.map((s) => s.id), ["shared"])
  const cReport = provisionLocal({ root, role: "coordinator", reportPath: false })
  assert.deepEqual(cReport.skills.map((s) => s.id), ["shared", "coord-only"])
})

test("conflict with user-authored skill fails unless override", () => {
  const root = mkroot()
  // managed skill at custom path
  const managedDir = path.join(root, "managed", "x")
  fs.mkdirSync(managedDir, { recursive: true })
  fs.writeFileSync(path.join(managedDir, "SKILL.md"), "# managed\n")
  // user-authored skill same id under .opencode/skills/x with different content
  writeSkill(root, "x", "# user\n")
  const hash = computeRevision(managedDir)
  makeManifest(root, "delegate", {
    x: { source: "path", path: "managed/x", revision: hash },
  })
  assert.throws(() => provisionLocal({ root, role: "delegate", reportPath: false }), (e: any) => {
    assert.ok(e instanceof SkillConflictError)
    assert.match(e.message, /conflict/)
    return true
  })
  // with override, succeeds and records warning
  const manifest = JSON.parse(fs.readFileSync(path.join(root, ".bive", "skills.json"), "utf8"))
  manifest.skills.x.override = true
  fs.writeFileSync(path.join(root, ".bive", "skills.json"), JSON.stringify(manifest))
  const report = provisionLocal({ root, role: "delegate", reportPath: false })
  assert.equal(report.skills.length, 1)
  assert.ok(report.warnings.some((w) => /override/.test(w)))
})

test("path safety: report path escaping root fails", () => {
  const root = mkroot()
  writeSkill(root, "s", "# v1\n")
  const hash = computeRevision(path.join(root, ".opencode", "skills", "s"))
  makeManifest(root, "delegate", {
    s: { source: "project", path: ".opencode/skills/s", revision: hash },
  })
  assert.throws(() => provisionLocal({ root, role: "delegate", reportPath: "../outside.json" }), (e: any) => {
    assert.ok(e instanceof PathSafetyError)
    return true
  })
})

test("validateManifest rejects undeclared role reference and duplicate role entries", () => {
  assert.throws(() => validateManifest({ version: 1, roles: { delegate: ["nope"] }, skills: {} }), /undeclared/)
  assert.throws(() => validateManifest({ version: 1, roles: { delegate: ["a", "a"] }, skills: { a: { revision: "r" } } }), /duplicate/)
})

test("missing manifest fails", () => {
  const root = mkroot()
  assert.throws(() => provisionLocal({ root, role: "delegate" }), /manifest missing/)
})

test("role migration: old supervisor role fails closed", () => {
  const root = mkroot()
  writeSkill(root, "s", "# v1\n")
  const hash = computeRevision(path.join(root, ".opencode", "skills", "s"))
  const manifest = {
    version: 1,
    roles: { supervisor: ["s"] },
    skills: { s: { source: "project", path: ".opencode/skills/s", revision: hash } },
  }
  fs.mkdirSync(path.join(root, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(root, ".bive", "skills.json"), JSON.stringify(manifest))
  assert.throws(() => validateManifest(manifest), (e: any) => {
    assert.ok(e.message.includes("role supervisor is not a valid role"))
    return true
  })
})

test("role migration: new advisor role succeeds", () => {
  const root = mkroot()
  writeSkill(root, "advisor-skill", "# advisor\n")
  const hash = computeRevision(path.join(root, ".opencode", "skills", "advisor-skill"))
  const manifest = {
    version: 1,
    roles: { advisor: ["advisor-skill"] },
    skills: { "advisor-skill": { source: "project", path: ".opencode/skills/advisor-skill", revision: hash } },
  }
  fs.mkdirSync(path.join(root, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(root, ".bive", "skills.json"), JSON.stringify(manifest))
  const report = provisionLocal({ root, role: "advisor", reportPath: false })
  assert.equal(report.role, "advisor")
  assert.equal(report.skills.length, 1)
  assert.equal(report.skills[0].id, "advisor-skill")
  assert.equal(report.skills[0].revision, hash)
  assert.equal(report.skills[0].observed_revision, hash)
})

test("role migration: coordinator and delegate unchanged", () => {
  const root = mkroot()
  writeSkill(root, "coord-skill", "# coordinator\n")
  writeSkill(root, "deleg-skill", "# delegate\n")
  const coordHash = computeRevision(path.join(root, ".opencode", "skills", "coord-skill"))
  const delegHash = computeRevision(path.join(root, ".opencode", "skills", "deleg-skill"))
  const manifest = {
    version: 1,
    roles: { coordinator: ["coord-skill"], delegate: ["deleg-skill"] },
    skills: {
      "coord-skill": { source: "project", path: ".opencode/skills/coord-skill", revision: coordHash },
      "deleg-skill": { source: "project", path: ".opencode/skills/deleg-skill", revision: delegHash },
    },
  }
  fs.mkdirSync(path.join(root, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(root, ".bive", "skills.json"), JSON.stringify(manifest))
  const coordReport = provisionLocal({ root, role: "coordinator", reportPath: false })
  assert.equal(coordReport.role, "coordinator")
  assert.equal(coordReport.skills.length, 1)
  assert.equal(coordReport.skills[0].id, "coord-skill")
  const delegReport = provisionLocal({ root, role: "delegate", reportPath: false })
  assert.equal(delegReport.role, "delegate")
  assert.equal(delegReport.skills.length, 1)
  assert.equal(delegReport.skills[0].id, "deleg-skill")
})
