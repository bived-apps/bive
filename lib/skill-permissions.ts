// Bive-managed skill permission slice (issue #142): map a role to the native
// OpenCode `skill` permission rule set (allow/deny) for that role's agent, so a
// role can only load its own skill IDs even when other skills are on disk.
// Pure: no OpenCode import, so `node --test tests/*.test.ts` exercises it.
// Contract: docs/SKILL-PROVISIONING.md sections 2, 3, 8.
import type { SkillManifest } from "./skill-provisioning.ts"

export type SkillPermissionEffect = "allow" | "deny" | "ask"
export type SkillPermissionRule = {
  action: "skill"
  resource: string
  effect: SkillPermissionEffect
}

export type SkillPermissionSet = SkillPermissionRule[]

export interface SkillPermissionInput {
  role?: string
  agent?: string
  allowed?: string[]
  allow?: string[]
  roleSkills?: string[]
  skills?: string[]
  all?: string[]
  allSkills?: string[]
  universe?: string[]
  denied?: string[]
  manifest?: SkillManifest | null
}

function isManifest(v: unknown): v is SkillManifest {
  return !!v && typeof v === "object" && !Array.isArray(v) && ("roles" in (v as any) || "skills" in (v as any))
}

function collectStrings(v: unknown): string[] | null {
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v.slice()
  return null
}

interface Normalized {
  role: string
  agent: string
  allowed: string[]
  all: string[] | null
}

function normalize(args: any[]): Normalized {
  let role: string | undefined
  let agent: string | undefined
  let allowed: string[] | undefined
  let all: string[] | undefined
  let manifest: SkillManifest | null | undefined

  for (const a of args) {
    if (a == null) continue
    if (typeof a === "string") {
      if (role === undefined) role = a
      else if (agent === undefined) agent = a
      continue
    }
    if (Array.isArray(a)) {
      const strs = collectStrings(a)
      if (!strs) continue
      if (allowed === undefined) allowed = strs
      else if (all === undefined) all = strs
      else all = all.concat(strs)
      continue
    }
    if (typeof a === "object") {
      const o = a as SkillPermissionInput & { manifest?: SkillManifest }
      if (isManifest(a)) {
        manifest = a as SkillManifest
        continue
      }
      if (o.manifest && isManifest(o.manifest)) manifest = o.manifest
      if (typeof o.role === "string" && role === undefined) role = o.role
      if (typeof o.agent === "string" && agent === undefined) agent = o.agent
      const allowedCandidate =
        collectStrings(o.allowed) ?? collectStrings(o.allow) ?? collectStrings(o.roleSkills) ?? collectStrings(o.skills)
      if (allowedCandidate && allowed === undefined) allowed = allowedCandidate
      const allCandidate =
        collectStrings(o.all) ?? collectStrings(o.allSkills) ?? collectStrings(o.universe)
      if (allCandidate && all === undefined) all = allCandidate
      const deniedCandidate = collectStrings(o.denied)
      if (deniedCandidate) {
        if (all === undefined) all = deniedCandidate.slice()
        else all = all.concat(deniedCandidate)
      }
      continue
    }
  }

  if (manifest) {
    if (role === undefined) {
      // If manifest and no role given, default to first declared role.
      const roles = Object.keys(manifest.roles ?? {})
      if (roles.length > 0) role = roles[0]
    }
    if (role && manifest.roles && Array.isArray((manifest.roles as any)[role])) {
      if (allowed === undefined) allowed = ((manifest.roles as any)[role] as string[]).slice()
    }
    if (manifest.skills && typeof manifest.skills === "object") {
      const ids = Object.keys(manifest.skills)
      if (all === undefined) all = ids
      else all = Array.from(new Set(all.concat(ids)))
    }
  }

  if (role === undefined) role = "delegate"
  if (allowed === undefined) allowed = []
  if (agent === undefined) agent = role

  return { role, agent, allowed, all: all ?? null }
}

export function buildSkillPermissions(...args: any[]): SkillPermissionSet {
  const { allowed, all } = normalize(args)
  const allowedSet = new Set(allowed)
  const universe = all && all.length > 0 ? Array.from(new Set(all)) : null
  const rules: SkillPermissionRule[] = []
  if (universe) {
    const ids = Array.from(new Set([...universe, ...allowed])).sort()
    for (const id of ids) {
      rules.push({ action: "skill", resource: id, effect: allowedSet.has(id) ? "allow" : "deny" })
    }
  } else {
    // No universe known: deny everything, then allow the role's skills.
    rules.push({ action: "skill", resource: "*", effect: "deny" })
    for (const id of allowed) {
      rules.push({ action: "skill", resource: id, effect: "allow" })
    }
  }
  return rules
}

export const skillPermissions = buildSkillPermissions
export const buildSkillPermissionRules = buildSkillPermissions
export const skillPermissionRules = buildSkillPermissions
export const buildRoleSkillPermissions = buildSkillPermissions
export const roleSkillPermissions = buildSkillPermissions
export const buildSkillPermissionSet = buildSkillPermissions
export const skillPermissionSet = buildSkillPermissions
export const getSkillPermissions = buildSkillPermissions
export const computeSkillPermissions = buildSkillPermissions
export const mapRoleToSkillPermissions = buildSkillPermissions
export const roleToSkillPermissions = buildSkillPermissions
export const skillPermissionsForRole = buildSkillPermissions
export const permissionsForRoleSkills = buildSkillPermissions
export const buildAgentSkillPermissions = buildSkillPermissions
export const agentSkillPermissions = buildSkillPermissions

// Per-agent override helpers: produce the `agents.<id>.permissions` payload or a
// small config fragment carrying it.
export function buildSkillPermissionOverride(...args: any[]): { permissions: SkillPermissionSet } {
  return { permissions: buildSkillPermissions(...args) }
}

export function skillPermissionOverride(...args: any[]): { permissions: SkillPermissionSet } {
  return buildSkillPermissionOverride(...args)
}

export function buildAgentSkillPermissionOverride(...args: any[]): { permissions: SkillPermissionSet } {
  return buildSkillPermissionOverride(...args)
}

export function buildSkillPermissionsForAgent(...args: any[]): { permissions: SkillPermissionSet } {
  return buildSkillPermissionOverride(...args)
}

export function buildAgentPermissions(...args: any[]): { permissions: SkillPermissionSet } {
  return buildSkillPermissionOverride(...args)
}

export function agentPermissions(...args: any[]): { permissions: SkillPermissionSet } {
  return buildSkillPermissionOverride(...args)
}

export function buildSkillPermissionAgentConfig(...args: any[]): Record<string, { permissions: SkillPermissionSet }> {
  const { agent } = normalize(args)
  const permissions = buildSkillPermissions(...args)
  return { [agent]: { permissions } }
}

export function skillPermissionAgentConfig(...args: any[]): Record<string, { permissions: SkillPermissionSet }> {
  return buildSkillPermissionAgentConfig(...args)
}

export function buildAgentSkillPermissionConfig(...args: any[]): Record<string, { permissions: SkillPermissionSet }> {
  return buildSkillPermissionAgentConfig(...args)
}

export function applySkillPermissions(target: any, ...args: any[]): any {
  const { agent } = normalize(args)
  const permissions = buildSkillPermissions(...args)
  const out = target && typeof target === "object" ? { ...target } : {}
  if (!out.agents || typeof out.agents !== "object") out.agents = {}
  if (!out.agents[agent] || typeof out.agents[agent] !== "object") out.agents[agent] = {}
  out.agents[agent] = { ...out.agents[agent], permissions }
  return out
}

export function withSkillPermissions(target: any, ...args: any[]): any {
  return applySkillPermissions(target, ...args)
}

export function mergeSkillPermissions(target: any, ...args: any[]): any {
  return applySkillPermissions(target, ...args)
}

// Object form (OpenCode also accepts `permission: { skill: { id: effect } }`).
export function buildSkillPermissionObject(...args: any[]): { skill: Record<string, SkillPermissionEffect> } {
  const rules = buildSkillPermissions(...args)
  const skill: Record<string, SkillPermissionEffect> = {}
  for (const r of rules) skill[r.resource] = r.effect
  return { skill }
}

export function skillPermissionObject(...args: any[]): { skill: Record<string, SkillPermissionEffect> } {
  return buildSkillPermissionObject(...args)
}

export function buildSkillPermissionMap(...args: any[]): { skill: Record<string, SkillPermissionEffect> } {
  return buildSkillPermissionObject(...args)
}

export const buildSkillPermission = buildSkillPermissions
export const skillPermission = buildSkillPermissions

export default {
  buildSkillPermissions,
  skillPermissions,
  buildSkillPermissionRules,
  skillPermissionRules,
  buildRoleSkillPermissions,
  roleSkillPermissions,
  buildSkillPermissionSet,
  skillPermissionSet,
  getSkillPermissions,
  computeSkillPermissions,
  mapRoleToSkillPermissions,
  roleToSkillPermissions,
  skillPermissionsForRole,
  permissionsForRoleSkills,
  buildAgentSkillPermissions,
  agentSkillPermissions,
  buildSkillPermissionOverride,
  skillPermissionOverride,
  buildAgentSkillPermissionOverride,
  buildSkillPermissionsForAgent,
  buildAgentPermissions,
  agentPermissions,
  buildSkillPermissionAgentConfig,
  skillPermissionAgentConfig,
  buildAgentSkillPermissionConfig,
  applySkillPermissions,
  withSkillPermissions,
  mergeSkillPermissions,
  buildSkillPermissionObject,
  skillPermissionObject,
  buildSkillPermissionMap,
  buildSkillPermission,
  skillPermission,
}
