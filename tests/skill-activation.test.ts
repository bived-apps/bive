import assert from "node:assert/strict"
import test from "node:test"
import os from "node:os"
import path from "node:path"
import fs from "node:fs"
import { activateManagedSession, provisionLocal, computeRevision, MissingSkillError, SkillRevisionMismatchError } from "../lib/skill-provisioning.ts"
import { buildSkillPermissions } from "../lib/skill-permissions.ts"

function mkroot() { return fs.mkdtempSync(path.join(os.tmpdir(), "bive-skill-act-")) }
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

test("activates a local managed session and reports revisions", () => {
  const root = mkroot()
  writeSkill(root, "s", "# v1\n")
  const hash = computeRevision(path.join(root, ".opencode", "skills", "s"))
  makeManifest(root, "delegate", { s: { source: "project", path: ".opencode/skills/s", revision: hash } })
  const result: any = activateManagedSession({ root, role: "delegate" })
  assert.equal(result.role, "delegate")
  assert.equal(result.report.role, "delegate")
  assert.equal(result.report.skills.length, 1)
  assert.match(result.systemMessage, new RegExp(hash))
  assert.match(result.systemMessage, /source_revision/)
  assert.ok(result.permissions.some((r: any) => r.resource === "s" && r.effect === "allow"))
  assert.ok(fs.existsSync(path.join(root, ".bive", "skills.report.json")))
})

test("activates a remote managed session", () => {
  const local = mkroot()
  const remote = mkroot()
  writeSkill(local, "s", "# v1\n")
  const h = computeRevision(path.join(local, ".opencode", "skills", "s"))
  const manifest = { version: 1, roles: { delegate: ["s"] }, skills: { s: { source: "project", path: ".opencode/skills/s", revision: h } } }
  fs.mkdirSync(path.join(local, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(local, ".bive", "skills.json"), JSON.stringify(manifest))
  fs.mkdirSync(path.join(remote, ".bive"), { recursive: true })
  fs.writeFileSync(path.join(remote, ".bive", "skills.json"), JSON.stringify(manifest))
  const result: any = activateManagedSession({ localRoot: local, remoteRoot: remote, role: "delegate" })
  assert.equal(result.report.skills.length, 1)
  assert.ok(fs.existsSync(path.join(remote, ".bive", "skills.report.json")))
})

test("fails before start on missing skill", () => {
  const root = mkroot()
  makeManifest(root, "delegate", { "missing-skill": { source: "project", path: ".opencode/skills/missing-skill", revision: "abc" } })
  assert.throws(() => activateManagedSession({ root, role: "delegate" }), (e: any) => {
    assert.ok(e instanceof MissingSkillError)
    return true
  })
})

test("fails before start on revision mismatch", () => {
  const root = mkroot()
  writeSkill(root, "s", "# v1\n")
  makeManifest(root, "delegate", { s: { source: "project", path: ".opencode/skills/s", revision: "deadbeef" } })
  assert.throws(() => activateManagedSession({ root, role: "delegate" }), (e: any) => {
    assert.ok(e instanceof SkillRevisionMismatchError)
    return true
  })
})

test("async activation returns a promise for catalog sources", async () => {
  const http = await import("node:http")
  const root = mkroot()
  const tmp = mkroot()
  const content = "# catalog skill\n"
  const dir = path.join(tmp, "s")
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "SKILL.md"), content)
  const hash = computeRevision(dir)
  makeManifest(root, "delegate", { s: { source: "catalog", revision: hash } })
  const server = http.createServer((req, res) => {
    if (req.url === "/index.json") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify([{ name: "s", version: "1", files: ["SKILL.md"] }])) }
    else if (req.url === "/s/SKILL.md") res.end(content)
    else { res.statusCode = 404; res.end() }
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}`
  try {
    const result: any = await activateManagedSession({ root, role: "delegate", catalog: base })
    assert.equal(result.report.skills.length, 1)
    assert.equal(result.report.skills[0].source, "catalog")
  } finally {
    server.close()
  }
})