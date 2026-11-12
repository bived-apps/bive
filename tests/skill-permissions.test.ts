import assert from "node:assert/strict"
import test from "node:test"
import os from "node:os"
import path from "node:path"
import fs from "node:fs"
import { computeRevision } from "../lib/skill-provisioning.ts"
import {
  buildSkillPermissions,
  skillPermissions,
  buildSkillPermissionObject,
} from "../lib/skill-permissions.ts"

function mkroot() { return fs.mkdtempSync(path.join(os.tmpdir(), "bive-skill-perm-")) }

test("builds allow for role skills and deny for others (explicit universe)", () => {
  const rules = buildSkillPermissions("delegate", ["shared"], ["shared", "coord-only"])
  assert.deepEqual(rules, [
    { action: "skill", resource: "coord-only", effect: "deny" },
    { action: "skill", resource: "shared", effect: "allow" },
  ])
})

test("wildcard deny when only allowed skills are given", () => {
  const rules = buildSkillPermissions("delegate", ["bive-delegate-brief"])
  assert.deepEqual(rules, [
    { action: "skill", resource: "*", effect: "deny" },
    { action: "skill", resource: "bive-delegate-brief", effect: "allow" },
  ])
})

test("manifest drives allowed and universe", () => {
  const root = mkroot()
  fs.mkdirSync(path.join(root, ".opencode", "skills", "shared"), { recursive: true })
  fs.mkdirSync(path.join(root, ".opencode", "skills", "coord-only"), { recursive: true })
  fs.writeFileSync(path.join(root, ".opencode", "skills", "shared", "SKILL.md"), "# shared\n")
  fs.writeFileSync(path.join(root, ".opencode", "skills", "coord-only", "SKILL.md"), "# coord\n")
  const sh = computeRevision(path.join(root, ".opencode", "skills", "shared"))
  const ch = computeRevision(path.join(root, ".opencode", "skills", "coord-only"))
  const manifest = {
    version: 1,
    roles: { delegate: ["shared"], coordinator: ["shared", "coord-only"] },
    skills: {
      shared: { source: "project", path: ".opencode/skills/shared", revision: sh },
      "coord-only": { source: "project", path: ".opencode/skills/coord-only", revision: ch },
    },
  }
  const rules = buildSkillPermissions(manifest, "delegate")
  assert.deepEqual(rules, [
    { action: "skill", resource: "coord-only", effect: "deny" },
    { action: "skill", resource: "shared", effect: "allow" },
  ])
})

test("object form mirrors rules", () => {
  const obj = buildSkillPermissionObject("delegate", ["a"], ["a", "b"])
  assert.deepEqual(obj, { skill: { a: "allow", b: "deny" } })
})

test("alias skillPermissions agrees", () => {
  assert.deepEqual(skillPermissions("delegate", ["x"]), buildSkillPermissions("delegate", ["x"]))
})

test("provisioned role advertises exactly its skills", () => {
  // sanity: delegate cannot load coord-only via rules
  const rules = buildSkillPermissions("delegate", ["shared"], ["shared", "coord-only"])
  assert.equal(rules.find((r) => r.resource === "coord-only").effect, "deny")
})
