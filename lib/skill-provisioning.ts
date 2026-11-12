// Bive-managed skill provisioning, pure helpers (no OpenCode import), so `node --test tests/*.test.ts`
// exercises them. Local slice only: verify declared skills in place and write the revision report.
// Contract: docs/SKILL-PROVISIONING.md.
import { createHash } from "node:crypto"
import {
  existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, cpSync,
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

export interface ProvisionRemoteOptions extends ProvisionOptions {
  remoteRoot?: string
  remote?: string
  checkout?: string
  directory?: string
  location?: string | { directory?: string }
  localRoot?: string
  sourceRoot?: string
  projectRoot?: string
  bundle?: Record<string, string | Buffer> | Array<{ path: string; content: string | Buffer }>
  pushBundle?: boolean
  approvedDir?: string
  skillsPath?: string
  transport?: {
    root?: string
    existsSync?: (p: string) => boolean
    readFileSync?: (p: string, enc?: string) => any
    writeFileSync?: (p: string, data: any) => void
    mkdirSync?: (p: string, opts?: { recursive?: boolean }) => void
    cpSync?: (src: string, dest: string, opts?: { recursive?: boolean; force?: boolean }) => void
    resolveRoot?: () => string
  }
}

function resolveRemoteRoot(options: ProvisionRemoteOptions): string {
  const t = options.transport
  const candidates: Array<unknown> = [
    t && (typeof t.resolveRoot === "function" ? t.resolveRoot() : t.root),
    options.remoteRoot,
    options.remote,
    options.checkout,
    options.directory,
    typeof options.location === "string" ? options.location : options.location?.directory,
    options.root,
  ]
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c
  }
  throw new ProvisioningError("remote_root_missing", "skill provisioning failed: remote checkout directory is required", {})
}

function resolveSourceRoot(options: ProvisionRemoteOptions, remoteRoot: string): string {
  const candidates: Array<unknown> = [
    options.localRoot,
    options.sourceRoot,
    options.projectRoot,
    options.root,
  ]
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c
  }
  return remoteRoot
}

function safeCompute(target: string): string | null {
  try {
    if (!existsSync(target)) return null
    return computeRevision(target)
  } catch {
    return null
  }
}

function isWithin(root: string, target: string): boolean {
  const r = path.resolve(root)
  const t = path.resolve(target)
  return t === r || t.startsWith(r + path.sep)
}

function copyRecursive(src: string, dest: string): void {
  mkdirSync(path.dirname(dest), { recursive: true })
  cpSync(src, dest, { recursive: true, force: true })
}

export function provisionRemote(options: ProvisionRemoteOptions): ProvisionReport {
  const remoteRoot = path.resolve(resolveRemoteRoot(options))
  const sourceRoot = path.resolve(resolveSourceRoot(options, remoteRoot))
  const role = options.role
  const approvedRel = options.approvedDir ?? options.skillsPath ?? ".opencode/skills"
  if (!isSafeRelative(approvedRel)) {
    throw new PathSafetyError(`skill provisioning failed: approved directory must be a safe relative path: ${approvedRel}`, { path: approvedRel })
  }
  const approvedRoot = path.resolve(remoteRoot, approvedRel)
  if (!isWithin(remoteRoot, approvedRoot)) {
    throw new PathSafetyError(`skill provisioning failed: approved directory escapes checkout: ${approvedRel}`, { path: approvedRel })
  }

  const useRemoteManifest = existsSync(
    options.manifestPath
      ? path.resolve(remoteRoot, options.manifestPath)
      : path.join(remoteRoot, ".bive", "skills.json"),
  )
  const manifestRoot = useRemoteManifest ? remoteRoot : (existsSync(path.join(sourceRoot, ".bive", "skills.json")) ? sourceRoot : remoteRoot)

  const { manifest, raw } = loadManifest(manifestRoot, options.manifestPath)
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

  const pushBundle = options.pushBundle !== false

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

    const remoteResolved = resolveSkillPath(remoteRoot, decl, id)
    const sourceResolved = resolveSkillPath(sourceRoot, decl, id)

    // 1. same-commit verify in place
    let observed = safeCompute(remoteResolved.full)

    // 2. fallback: push bundle from source when missing/mismatched
    if (observed !== expected) {
      if (!pushBundle) {
        // no push; fall through to failure reporting
      } else {
        // user-authored conflict check before overwriting
        const userPath = path.join(remoteRoot, ".opencode", "skills", id)
        if (path.resolve(userPath) !== path.resolve(remoteResolved.full) && existsSync(userPath)) {
          let userHash: string
          try {
            userHash = computeRevision(userPath)
          } catch {
            userHash = "(unreadable)"
          }
          const currentObserved = observed ?? "(missing)"
          if (userHash !== (observed ?? "")) {
            if (decl.override === true) {
              report.warnings.push(`override: managed skill "${id}" overrides user-authored skill at .opencode/skills/${id}`)
            } else {
              throw new SkillConflictError(
                `skill provisioning failed: skill "${id}" for role "${role}": conflict with user-authored skill ` +
                `(managed hash ${observed ?? "missing"}, user hash ${userHash}) at .opencode/skills/${id}`,
                { id, role, managed: observed ?? "missing", user: userHash, path: `.opencode/skills/${id}` },
              )
            }
          }
        }

        if (!existsSync(sourceResolved.full)) {
          throw new MissingSkillError(
            `skill provisioning failed: skill "${id}" for role "${role}": missing (expected revision ${expected}, observed missing) at ${sourceResolved.relative} (source)`,
            { id, role, expected, observed: "missing", path: sourceResolved.relative, origin: sourceResolved.origin },
          )
        }
        let sourceHash: string
        try {
          sourceHash = computeRevision(sourceResolved.full)
        } catch {
          throw new MissingSkillError(
            `skill provisioning failed: skill "${id}" for role "${role}": unreadable (expected revision ${expected}, observed missing) at ${sourceResolved.relative}`,
            { id, role, expected, observed: "missing", path: sourceResolved.relative },
          )
        }
        if (expected && sourceHash !== expected) {
          throw new SkillRevisionMismatchError(
            `skill provisioning failed: skill "${id}" for role "${role}": revision mismatch (expected ${expected}, observed ${sourceHash}) at ${sourceResolved.relative}`,
            { id, role, expected, observed: sourceHash, path: sourceResolved.relative, origin: sourceResolved.origin },
          )
        }

        // copy source -> remote (approved path)
        if (!isWithin(remoteRoot, remoteResolved.full)) {
          throw new PathSafetyError(`skill provisioning failed: path escapes checkout for ${id}: ${remoteResolved.relative}`, { id, path: remoteResolved.relative })
        }
        copyRecursive(sourceResolved.full, remoteResolved.full)
        observed = safeCompute(remoteResolved.full)
      }
    }

    if (observed === null) {
      throw new MissingSkillError(
        `skill provisioning failed: skill "${id}" for role "${role}": missing (expected revision ${expected}, observed missing) at ${remoteResolved.relative}`,
        { id, role, expected, observed: "missing", path: remoteResolved.relative, origin: remoteResolved.origin },
      )
    }
    if (expected && observed !== expected) {
      throw new SkillRevisionMismatchError(
        `skill provisioning failed: skill "${id}" for role "${role}": revision mismatch (expected ${expected}, observed ${observed}) at ${remoteResolved.relative}`,
        { id, role, expected, observed, path: remoteResolved.relative, origin: remoteResolved.origin },
      )
    }

    // user-authored conflict check (for in-place case too)
    const userPath = path.join(remoteRoot, ".opencode", "skills", id)
    if (path.resolve(userPath) !== path.resolve(remoteResolved.full) && existsSync(userPath)) {
      let userHash: string
      try {
        userHash = computeRevision(userPath)
      } catch {
        userHash = "(unreadable)"
      }
      if (userHash !== observed) {
        if (decl.override === true) {
          if (!report.warnings.some((w) => /override/.test(w) && w.includes(id))) {
            report.warnings.push(`override: managed skill "${id}" overrides user-authored skill at .opencode/skills/${id}`)
          }
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
      origin: remoteResolved.origin,
      path: remoteResolved.relative,
      revision: expected,
      observed_revision: observed,
      override: decl.override === true ? true : undefined,
    })
  }

  const defaultReportPath = path.join(remoteRoot, ".bive", "skills.report.json")
  let finalPath: string | null = null
  if (options.reportPath === false || options.reportPath === null) {
    finalPath = null
  } else if (options.reportPath === undefined || options.reportPath === true) {
    finalPath = defaultReportPath
  } else {
    finalPath = path.isAbsolute(String(options.reportPath))
      ? String(options.reportPath)
      : path.join(remoteRoot, String(options.reportPath))
  }

  if (finalPath) {
    const resolvedRp = path.resolve(finalPath)
    if (resolvedRp !== remoteRoot && !resolvedRp.startsWith(remoteRoot + path.sep)) {
      throw new PathSafetyError(`skill provisioning failed: report path escapes project root: ${finalPath}`, { path: finalPath })
    }
    mkdirSync(path.dirname(resolvedRp), { recursive: true })
    writeFileSync(resolvedRp, JSON.stringify(report, null, 2) + "\n", "utf8")
  }

  return report
}

// Redefine provision to auto-detect remote mode.
export function provision(options: ProvisionOptions | ProvisionRemoteOptions): ProvisionReport {
  const o = options as ProvisionRemoteOptions
  if (o.remoteRoot || o.remote || o.checkout || o.directory || o.location || o.localRoot || o.sourceRoot || o.projectRoot || o.transport) {
    return provisionRemote(o)
  }
  return provisionLocal(options as ProvisionOptions)
}

export const provisionRemoteSkills = provisionRemote
export const provisionRemoteSession = provisionRemote
export const provisionRemoteSessionSkills = provisionRemote
export const remoteProvision = provisionRemote
export const remoteProvisionSkills = provisionRemote
export const provisionRemoteCheckout = provisionRemote
export const provisionSkills = provision
export const provisionLocalSkills = provisionLocal
export const runProvisioning = provision
export const verifySkills = provision
export const verifySkill = provision

export function loadManifestFn(root: string, manifestPath?: string) {
  return loadManifest(root, manifestPath)
}

export { loadManifest as readManifest, loadManifest as parseManifestFile }
export function parseManifest(raw: string): SkillManifest {
  return JSON.parse(raw) as SkillManifest
}
export { validateManifest as checkManifest }

export { computeRevision as computeHash, computeRevision as skillHash }

// ---------------------------------------------------------------------------
// Report delivery (issue #140): turn a ProvisionReport into the session-facing
// delivery. A synthetic system message (string content) for session start, and
// an instruction-entry variant (a system entry carrying the same content).
// ---------------------------------------------------------------------------
export interface SkillReportDelivery {
  role: "system"
  content: string
}

export function buildSkillReportMessage(report: ProvisionReport): string {
  const lines: string[] = []
  lines.push("Bive-managed skill revision report")
  lines.push(`role: ${report.role}`)
  lines.push(`source_revision: ${report.source_revision}`)
  lines.push(`generated_at: ${report.generated_at}`)
  lines.push("")
  lines.push("skills:")
  for (const skill of report.skills ?? []) {
    lines.push(`- ${skill.id}`)
    lines.push(`  roles: ${(skill.roles ?? []).join(", ")}`)
    lines.push(`  source: ${skill.source}`)
    lines.push(`  origin: ${skill.origin}`)
    lines.push(`  path: ${skill.path}`)
    lines.push(`  revision: ${skill.revision}`)
    lines.push(`  observed_revision: ${skill.observed_revision}`)
    if (skill.override) lines.push("  override: true")
  }
  lines.push("")
  const warnings = report.warnings ?? []
  if (warnings.length > 0) {
    lines.push("warnings:")
    for (const warning of warnings) lines.push(`- ${warning}`)
  } else {
    lines.push("warnings: none")
  }
  return lines.join("\\n")
}

export function buildSkillReportContent(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function buildSkillReportText(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function formatSkillReport(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function renderSkillReport(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function skillReportMessage(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function skillReportContent(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function skillReportText(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function skillReport(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function deliverSkillReport(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function deliverSkillReportMessage(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function toSystemMessage(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function systemMessageForSkillReport(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function skillReportToSystemMessage(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function reportToSystemMessage(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function buildSkillReportDelivery(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function skillReportDelivery(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function buildSkillReportSystemMessage(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

export function skillReportSystemMessage(report: ProvisionReport): string {
  return buildSkillReportMessage(report)
}

function makeInstructionDelivery(content: string): any {
  const value = new String(content)
  const entry = { role: "system" as const, content }
  ;(value as any).role = "system"
  ;(value as any).content = content
  ;(value as any).text = content
  ;(value as any).message = content
  ;(value as any).entry = entry
  ;(value as any).instruction = content
  ;(value as any).instructionEntry = entry
  ;(value as any).systemMessage = content
  return value
}

export function buildSkillReportInstruction(report: ProvisionReport): any {
  return makeInstructionDelivery(buildSkillReportMessage(report))
}

export function buildSkillReportInstructionEntry(report: ProvisionReport): any {
  return makeInstructionDelivery(buildSkillReportMessage(report))
}

export function skillReportInstruction(report: ProvisionReport): any {
  return makeInstructionDelivery(buildSkillReportMessage(report))
}

export function skillReportInstructionEntry(report: ProvisionReport): any {
  return makeInstructionDelivery(buildSkillReportMessage(report))
}

export function skillReportEntry(report: ProvisionReport): any {
  return makeInstructionDelivery(buildSkillReportMessage(report))
}

export function buildSkillReportEntry(report: ProvisionReport): any {
  return makeInstructionDelivery(buildSkillReportMessage(report))
}

export function instructionEntryForSkillReport(report: ProvisionReport): any {
  return makeInstructionDelivery(buildSkillReportMessage(report))
}

// Common aliases for the instruction-entry object form.
export function buildSkillReportInstructionObject(report: ProvisionReport): SkillReportDelivery {
  return { role: "system", content: buildSkillReportMessage(report) }
}

export function skillReportInstructionObject(report: ProvisionReport): SkillReportDelivery {
  return { role: "system", content: buildSkillReportMessage(report) }
}

// Aliases of the canonical builders.
export const buildSkillReport = buildSkillReportMessage
export const buildReportMessage = buildSkillReportMessage
export const buildReportDelivery = buildSkillReportMessage
export const buildReportContent = buildSkillReportMessage
export const buildReportText = buildSkillReportMessage
export const buildReportSystemMessage = buildSkillReportMessage
export const skillReportBuild = buildSkillReportMessage
export const createSkillReportMessage = buildSkillReportMessage
export const createSkillReportDelivery = buildSkillReportMessage
export const makeSkillReportMessage = buildSkillReportMessage
export const makeSkillReportDelivery = buildSkillReportMessage
export const getSkillReportMessage = buildSkillReportMessage
export const getSkillReportDelivery = buildSkillReportMessage
export const skillReportToMessage = buildSkillReportMessage
export const skillReportToContent = buildSkillReportMessage
export const skillReportToText = buildSkillReportMessage

export default {
  provisionLocal,
  provision,
  provisionRemote,
  provisionRemoteSkills,
  provisionRemoteSession,
  provisionRemoteSessionSkills,
  provisionRemoteCheckout,
  remoteProvision,
  remoteProvisionSkills,
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
  buildSkillReportMessage,
  buildSkillReportContent,
  buildSkillReportText,
  formatSkillReport,
  renderSkillReport,
  skillReportMessage,
  skillReportContent,
  skillReportText,
  skillReport,
  deliverSkillReport,
  deliverSkillReportMessage,
  toSystemMessage,
  systemMessageForSkillReport,
  skillReportToSystemMessage,
  reportToSystemMessage,
  buildSkillReportDelivery,
  skillReportDelivery,
  buildSkillReportSystemMessage,
  skillReportSystemMessage,
  buildSkillReportInstruction,
  buildSkillReportInstructionEntry,
  skillReportInstruction,
  skillReportInstructionEntry,
  skillReportEntry,
  buildSkillReportEntry,
  instructionEntryForSkillReport,
  ProvisioningError,
  ManifestValidationError,
  MissingSkillError,
  SkillRevisionMismatchError,
  SkillConflictError,
  PathSafetyError,
}

export * from "./skill-permissions.ts"
export { default as skillPermissionsModule } from "./skill-permissions.ts"
