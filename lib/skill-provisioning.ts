// Bive-managed skill provisioning, pure helpers (no OpenCode import), so `node --test tests/*.test.ts`
// exercises them. Local slice only: verify declared skills in place and write the revision report.
// Contract: docs/SKILL-PROVISIONING.md.
import { createHash } from "node:crypto"
import {
  existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync,
} from "node:fs"
import path from "node:path"

export const ROLES = ["supervisor", "coordinator", "delegate"] as const
export type SkillSource = "project" | "catalog" | "path"

export interface SkillDeclaration {
  source?: SkillSource
  path?: string
  revision?: string
  override?: boolean
  version?: string
}

export interface SkillManifest {
  version?: number
  roles?: Record<string, string[]>
  skills?: Record<string, SkillDeclaration>
}

export interface ProvisionedSkill {
  id: string
  roles: string[]
  source: SkillSource
  origin: string
  path: string
  revision: string
  observed_revision: string
  override?: boolean
}

export interface ProvisionReport {
  role: string
  source_revision: string
  generated_at: string
  skills: ProvisionedSkill[]
  warnings: string[]
}

export class ProvisioningError extends Error {
  code: string
  details: Record<string, unknown>
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = "ProvisioningError"
    this.code = code
    this.details = details
  }
}

export class ManifestValidationError extends ProvisioningError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("manifest_invalid", message, details)
    this.name = "ManifestValidationError"
  }
}

export class MissingSkillError extends ProvisioningError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("skill_missing", message, details)
    this.name = "MissingSkillError"
  }
}

export class SkillRevisionMismatchError extends ProvisioningError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("skill_revision_mismatch", message, details)
    this.name = "SkillRevisionMismatchError"
  }
}

export class SkillConflictError extends ProvisioningError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("skill_conflict", message, details)
    this.name = "SkillConflictError"
  }
}

export class PathSafetyError extends ProvisioningError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super("path_unsafe", message, details)
    this.name = "PathSafetyError"
  }
}

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex")
}

function sha256File(filePath: string): string {
  return sha256Buffer(readFileSync(filePath))
}

export function hashFile(filePath: string): string {
  return sha256File(filePath)
}

export function collectFiles(dir: string, base = dir): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectFiles(full, base))
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"))
  }
  return out
}

export function hashDirectory(dir: string): string {
  const files = collectFiles(dir).sort()
  const hash = createHash("sha256")
  for (const rel of files) {
    hash.update(rel + "\0")
    hash.update(readFileSync(path.join(dir, rel)))
    hash.update("\0")
  }
  return hash.digest("hex")
}

export function computeRevision(target: string): string {
  const st = statSync(target)
  if (st.isDirectory()) return hashDirectory(target)
  if (st.isFile()) return sha256File(target)
  throw new ProvisioningError("not_a_skill", `not a file or directory: ${target}`, { path: target })
}

export function loadManifest(root: string, manifestPath?: string): { manifest: SkillManifest; raw: string; path: string } {
  const p = manifestPath ? path.resolve(root, manifestPath) : path.join(root, ".bive", "skills.json")
  if (!existsSync(p)) {
    throw new MissingSkillError(`skill provisioning failed: manifest missing at ${p}`, { path: p, root })
  }
  let raw: string
  try {
    raw = readFileSync(p, "utf8")
  } catch (e) {
    throw new ProvisioningError("manifest_unreadable", `skill provisioning failed: manifest unreadable at ${p}: ${(e as Error).message}`, { path: p })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new ManifestValidationError(`skill provisioning failed: manifest is not valid JSON at ${p}: ${(e as Error).message}`, { path: p })
  }
  return { manifest: parsed as SkillManifest, raw, path: p }
}

function isSafeRelative(p: string): boolean {
  return typeof p === "string" && p.length > 0 && !path.isAbsolute(p) && !p.split(/[\\/]/).includes("..")
}

export function validateManifest(manifest: SkillManifest): void {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new ManifestValidationError("skill provisioning failed: manifest must be an object", {})
  }
  if (manifest.version !== undefined && (typeof manifest.version !== "number" || manifest.version < 1)) {
    throw new ManifestValidationError("skill provisioning failed: manifest version must be a positive number", { version: manifest.version })
  }
  if (!manifest.roles || typeof manifest.roles !== "object" || Array.isArray(manifest.roles)) {
    throw new ManifestValidationError("skill provisioning failed: manifest.roles must be an object", {})
  }
  if (!manifest.skills || typeof manifest.skills !== "object" || Array.isArray(manifest.skills)) {
    throw new ManifestValidationError("skill provisioning failed: manifest.skills must be an object", {})
  }
  for (const [role, ids] of Object.entries(manifest.roles)) {
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string" && x.length > 0)) {
      throw new ManifestValidationError(`skill provisioning failed: roles.${role} must be an array of non-empty strings`, { role })
    }
  }
  for (const [id, decl] of Object.entries(manifest.skills)) {
    if (!decl || typeof decl !== "object" || Array.isArray(decl)) {
      throw new ManifestValidationError(`skill provisioning failed: skills.${id} must be an object`, { id })
    }
    const source = (decl.source ?? "project") as SkillSource
    if (!["project", "catalog", "path"].includes(source)) {
      throw new ManifestValidationError(`skill provisioning failed: skills.${id}.source must be project, catalog or path`, { id, source })
    }
    if (typeof decl.revision !== "string" || decl.revision.length === 0) {
      throw new ManifestValidationError(`skill provisioning failed: skills.${id}.revision must be a non-empty string`, { id })
    }
    if (source === "catalog") {
      if (decl.path !== undefined && !isSafeRelative(decl.path)) {
        throw new ManifestValidationError(`skill provisioning failed: skills.${id}.path must be a safe relative path`, { id, path: decl.path })
      }
    } else {
      const p = decl.path ?? `.opencode/skills/${id}`
      if (!isSafeRelative(p)) {
        throw new ManifestValidationError(`skill provisioning failed: skills.${id}.path must be a safe relative path`, { id, path: p })
      }
    }
    if (decl.override !== undefined && typeof decl.override !== "boolean") {
      throw new ManifestValidationError(`skill provisioning failed: skills.${id}.override must be boolean`, { id })
    }
  }
  for (const [role, ids] of Object.entries(manifest.roles)) {
    for (const id of ids) {
      if (!Object.prototype.hasOwnProperty.call(manifest.skills, id)) {
        throw new ManifestValidationError(`skill provisioning failed: role ${role} references undeclared skill ${id}`, { role, id })
      }
    }
  }
  for (const [role, ids] of Object.entries(manifest.roles)) {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) {
        throw new ManifestValidationError(`skill provisioning failed: role ${role} lists duplicate skill ${id}`, { role, id })
      }
      seen.add(id)
    }
  }
}

function resolveSkillPath(root: string, decl: SkillDeclaration, id: string): { full: string; relative: string; origin: string } {
  const source = (decl.source ?? "project") as SkillSource
  if (source === "catalog") {
    const rel = decl.path ? decl.path : `.opencode/skills/${id}`
    if (!isSafeRelative(rel)) throw new PathSafetyError(`skill provisioning failed: unsafe path for ${id}: ${rel}`, { id, path: rel })
    const full = path.resolve(root, rel)
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new PathSafetyError(`skill provisioning failed: path escapes project root for ${id}: ${rel}`, { id, path: rel })
    }
    return { full, relative: rel, origin: decl.path ? `catalog:${decl.path}` : `catalog:${id}` }
  }
  const rel = decl.path ?? `.opencode/skills/${id}`
  if (!isSafeRelative(rel)) {
    throw new PathSafetyError(`skill provisioning failed: unsafe path for ${id}: ${rel}`, { id, path: rel })
  }
  const full = path.resolve(root, rel)
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new PathSafetyError(`skill provisioning failed: path escapes project root for ${id}: ${rel}`, { id, path: rel })
  }
  return { full, relative: rel, origin: rel }
}

function rolesUsing(manifest: SkillManifest, id: string): string[] {
  const out: string[] = []
  for (const [role, ids] of Object.entries(manifest.roles ?? {})) {
    if (Array.isArray(ids) && ids.includes(id)) out.push(role)
  }
  return out
}

export interface ProvisionOptions {
  root: string
  role: string
  manifestPath?: string
  reportPath?: string | false | null | true
  now?: () => string
  globalSkills?: Record<string, string>
}

export function provisionLocal(options: ProvisionOptions): ProvisionReport {
  const root = path.resolve(options.root)
  const role = options.role
  const { manifest, raw } = loadManifest(root, options.manifestPath)
  validateManifest(manifest)
  if (!manifest.roles || !Object.prototype.hasOwnProperty.call(manifest.roles, role)) {
    throw new ManifestValidationError(`skill provisioning failed: role ${role} is not declared in manifest`, { role })
  }
  const roleIds = manifest.roles[role] ?? []
  const sourceRevision = sha256Buffer(Buffer.from(raw, "utf8"))
  const report: ProvisionReport = {
    role,
    source_revision: sourceRevision,
    generated_at: (options.now ? options.now() : new Date().toISOString()),
    skills: [],
    warnings: [],
  }

  for (const id of roleIds) {
    const decl = (manifest.skills ?? {})[id]
    if (!decl) {
      throw new MissingSkillError(
        `skill provisioning failed: skill "${id}" for role "${role}": missing declaration (expected revision missing, observed missing)`,
        { id, role, expected: "missing", observed: "missing", path: "(undeclared)" },
      )
    }
    const source = (decl.source ?? "project") as SkillSource
    const expected = decl.revision ?? ""
    const resolved = resolveSkillPath(root, decl, id)

    if (!existsSync(resolved.full)) {
      throw new MissingSkillError(
        `skill provisioning failed: skill "${id}" for role "${role}": missing (expected revision ${expected}, observed missing) at ${resolved.relative}`,
        { id, role, expected, observed: "missing", path: resolved.relative, origin: resolved.origin },
      )
    }

    let observed: string
    try {
      observed = computeRevision(resolved.full)
    } catch (e) {
      throw new MissingSkillError(
        `skill provisioning failed: skill "${id}" for role "${role}": unreadable (expected revision ${expected}, observed missing) at ${resolved.relative}`,
        { id, role, expected, observed: "missing", path: resolved.relative },
      )
    }

    if (expected && observed !== expected) {
      throw new SkillRevisionMismatchError(
        `skill provisioning failed: skill "${id}" for role "${role}": revision mismatch (expected ${expected}, observed ${observed}) at ${resolved.relative}`,
        { id, role, expected, observed, path: resolved.relative, origin: resolved.origin },
      )
    }

    const userPath = path.join(root, ".opencode", "skills", id)
    if (path.resolve(userPath) !== path.resolve(resolved.full) && existsSync(userPath)) {
      let userHash: string
      try {
        userHash = computeRevision(userPath)
      } catch {
        userHash = "(unreadable)"
      }
      if (userHash !== observed) {
        if (decl.override === true) {
          report.warnings.push(`override: managed skill "${id}" overrides user-authored skill at .opencode/skills/${id}`)
        } else {
          throw new SkillConflictError(
            `skill provisioning failed: skill "${id}" for role "${role}": conflict with user-authored skill ` +
            `(managed hash ${observed}, user hash ${userHash}) at .opencode/skills/${id}`,
            { id, role, managed: observed, user: userHash, path: `.opencode/skills/${id}` },
          )
        }
      }
    }

    const globalHash = options.globalSkills?.[id]
    if (globalHash !== undefined && globalHash !== observed) {
      report.warnings.push(`shadowing warning: global skill "${id}" (${globalHash}) differs from managed (${observed})`)
    }

    report.skills.push({
      id,
      roles: rolesUsing(manifest, id),
      source,
      origin: resolved.origin,
      path: resolved.relative,
      revision: expected,
      observed_revision: observed,
      override: decl.override === true ? true : undefined,
    })
  }

  const defaultReportPath = path.join(root, ".bive", "skills.report.json")
  let finalPath: string | null = null
  if (options.reportPath === false || options.reportPath === null) {
    finalPath = null
  } else if (options.reportPath === undefined || options.reportPath === true) {
    finalPath = defaultReportPath
  } else {
    finalPath = path.isAbsolute(String(options.reportPath))
      ? String(options.reportPath)
      : path.join(root, String(options.reportPath))
  }

  if (finalPath) {
    const resolvedRp = path.resolve(finalPath)
    if (resolvedRp !== root && !resolvedRp.startsWith(root + path.sep)) {
      throw new PathSafetyError(`skill provisioning failed: report path escapes project root: ${finalPath}`, { path: finalPath })
    }
    mkdirSync(path.dirname(resolvedRp), { recursive: true })
    writeFileSync(resolvedRp, JSON.stringify(report, null, 2) + "\n", "utf8")
  }

  return report
}

export const provision = provisionLocal
export const provisionSkills = provisionLocal
export const provisionLocalSkills = provisionLocal
export const runProvisioning = provisionLocal
export const verifySkills = provisionLocal
export const verifySkill = provisionLocal

export function loadManifestFn(root: string, manifestPath?: string) {
  return loadManifest(root, manifestPath)
}

export { loadManifest as readManifest, loadManifest as parseManifestFile }
export function parseManifest(raw: string): SkillManifest {
  return JSON.parse(raw) as SkillManifest
}
export { validateManifest as checkManifest }

export { computeRevision as computeHash, computeRevision as skillHash }

export default {
  provisionLocal,
  provision,
  provisionSkills,
  provisionLocalSkills,
  runProvisioning,
  verifySkills,
  verifySkill,
  loadManifest,
  readManifest: loadManifest,
  parseManifest,
  validateManifest,
  checkManifest: validateManifest,
  computeRevision,
  computeHash: computeRevision,
  skillHash: computeRevision,
  hashDirectory,
  hashFile,
  ProvisioningError,
  ManifestValidationError,
  MissingSkillError,
  SkillRevisionMismatchError,
  SkillConflictError,
  PathSafetyError,
}
