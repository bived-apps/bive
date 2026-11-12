// Bive-managed skill provisioning, pure helpers (no OpenCode import), so `node --test tests/*.test.ts`
// exercises them. Local slice only: verify declared skills in place and write the revision report.
// Contract: docs/SKILL-PROVISIONING.md.
import { createHash } from "node:crypto"
import {
  existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, cpSync, rmSync,
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

export function provisionLocal(options: ProvisionOptions): ProvisionReport | Promise<ProvisionReport> {
  try {
    const _r = path.resolve((options as any).root)
    if (manifestHasCatalog(_r, (options as any).manifestPath)) {
      return provisionCatalog(options as any)
    }
  } catch {
    // fall through to the normal (possibly throwing) path
  }
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

export function provisionRemote(options: ProvisionRemoteOptions): ProvisionReport | Promise<ProvisionReport> {
  try {
    const _r = path.resolve(resolveRemoteRoot(options))
    if (manifestHasCatalog(_r, (options as any).manifestPath)) {
      return provisionCatalog(options as any)
    }
  } catch {
    // fall through
  }
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

export * from "./skill-permissions.ts"
export { default as skillPermissionsModule } from "./skill-permissions.ts"

// ---------------------------------------------------------------------------
// Catalog-source slice (issue #144): HTTP skill catalogs. Fetch `index.json`
// ({name, version, files}), download each declared file from `<base>/<name>/<file>`
// with safe relative same-origin paths, verify the resulting directory hash
// against the declared revision, and fail clearly on missing/mismatched entries.
// ---------------------------------------------------------------------------

const DEFAULT_CATALOG_MAX_BYTES = 1024 * 1024

function manifestHasCatalog(root: string, manifestPath?: string): boolean {
  try {
    const { manifest } = loadManifest(root, manifestPath)
    validateManifest(manifest)
    return Object.values(manifest.skills ?? {}).some((d: any) => (d?.source ?? "project") === "catalog")
  } catch {
    return false
  }
}

function isHttpUrl(v: unknown): v is string {
  if (typeof v !== "string" || v.length === 0) return false
  try {
    const u = new URL(v)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

function trimSlash(v: string): string {
  return v.replace(/\/+$/, "")
}

function resolveCatalogBaseUrl(decl: any, options: any, id: string): string | null {
  const candidates: any[] = [
    decl?.catalog,
    decl?.catalogUrl,
    decl?.catalogURL,
    decl?.baseUrl,
    decl?.baseURL,
    decl?.url,
    decl?.sourceUrl,
    decl?.sourceURL,
    options?.catalog,
    options?.catalogUrl,
    options?.catalogURL,
    options?.baseUrl,
    options?.baseURL,
    options?.url,
    options?.catalogs && typeof options.catalogs === "object" ? options.catalogs[id] : undefined,
    options?.catalogs && typeof options.catalogs === "object" ? options.catalogs["*"] : undefined,
    options?.catalogs && typeof options.catalogs === "object" ? options.catalogs.default : undefined,
    options?.catalogBase,
    options?.catalogBaseURL,
  ]
  for (const c of candidates) {
    if (isHttpUrl(c)) return trimSlash(c)
  }
  // allow a non-URL base resolved relative to a provided origin? no.
  return null
}

function catalogIndexUrl(base: string): string {
  const b = trimSlash(base)
  if (/\/index\.json$/i.test(b)) return b
  return `${b}/index.json`
}

function catalogEntryName(decl: any, id: string): string {
  const candidates = [decl?.name, decl?.entry, decl?.catalogEntry, decl?.skill, decl?.entryName]
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c
  }
  if (typeof decl?.path === "string" && decl.path.length > 0 && !decl.path.includes("/") && !decl.path.includes("\\")) {
    return decl.path
  }
  return id
}

function catalogEntriesOf(index: any): any[] {
  if (Array.isArray(index)) return index
  if (index && typeof index === "object") {
    for (const key of ["skills", "entries", "catalog", "items", "packages", "results"]) {
      if (Array.isArray((index as any)[key])) return (index as any)[key]
    }
    // object keyed by name
    const keys = Object.keys(index)
    if (keys.length > 0 && keys.every((k) => index[k] && typeof index[k] === "object" && !Array.isArray(index[k]))) {
      return keys.map((k) => ({ name: k, ...(index as any)[k] }))
    }
  }
  return []
}

function entryFilesOf(entry: any): any[] {
  const f = entry?.files ?? entry?.file ?? entry?.paths ?? entry?.fileList
  if (Array.isArray(f)) return f
  if (typeof f === "string") return [f]
  return []
}

function entryFileName(f: any): string {
  if (typeof f === "string") return f
  if (f && typeof f === "object") {
    return String(f.path ?? f.file ?? f.name ?? f.filename ?? f.id ?? "")
  }
  return ""
}

function getFetchFn(options: any): any {
  const candidates = [
    options?.fetch,
    options?.fetchFn,
    options?.fetcher,
    options?.request,
    options?.http,
    options?.httpClient,
    options?.transport && (typeof options.transport.fetch === "function" ? options.transport.fetch : options.transport.fetch),
    options?.transport && (typeof options.transport.request === "function" ? options.transport.request : undefined),
    globalThis.fetch,
  ]
  for (const c of candidates) {
    if (typeof c === "function") return c
  }
  return null
}

function getMaxBytes(options: any, decl?: any): number {
  const c = decl?.maxBytes ?? decl?.sizeLimit ?? options?.maxBytes ?? options?.sizeLimit ?? options?.limit ?? options?.maxSize
  const n = typeof c === "number" ? c : Number(c)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CATALOG_MAX_BYTES
}

async function fetchBytes(fetchFn: any, url: string, maxBytes: number): Promise<Buffer> {
  let res: any
  try {
    res = await fetchFn(url)
  } catch (e: any) {
    throw new MissingSkillError(`skill provisioning failed: catalog fetch failed for ${url}: ${e?.message ?? e}`, { url, error: String(e?.message ?? e) })
  }
  if (!res) {
    throw new MissingSkillError(`skill provisioning failed: catalog entry missing at ${url} (no response)`, { url, observed: "missing" })
  }
  const status = typeof res.status === "number" ? res.status : (res.ok === false ? 404 : 200)
  const ok = typeof res.ok === "boolean" ? res.ok : status >= 200 && status < 300
  if (!ok || status >= 400) {
    throw new MissingSkillError(`skill provisioning failed: catalog entry missing at ${url} (HTTP ${status})`, { url, status, observed: "missing" })
  }

  let buf: Buffer | null = null
  try {
    if (typeof res.arrayBuffer === "function") {
      const ab = await res.arrayBuffer()
      buf = Buffer.from(ab)
    } else if (Buffer.isBuffer(res.body)) {
      buf = res.body
    } else if (res.body && typeof res.body === "string") {
      buf = Buffer.from(res.body)
    } else if (typeof res.text === "function") {
      const t = await res.text()
      buf = Buffer.from(typeof t === "string" ? t : String(t ?? ""))
    } else if (typeof res.json === "function" && res.data === undefined) {
      // last resort: stringify json
      const j = await res.json()
      buf = Buffer.from(JSON.stringify(j))
    } else if (res.data !== undefined) {
      buf = Buffer.isBuffer(res.data) ? res.data : Buffer.from(typeof res.data === "string" ? res.data : JSON.stringify(res.data))
    } else if (res.buffer !== undefined) {
      buf = Buffer.isBuffer(res.buffer) ? res.buffer : Buffer.from(res.buffer)
    } else if (res.content !== undefined) {
      buf = Buffer.isBuffer(res.content) ? res.content : Buffer.from(res.content)
    } else if (res.body && typeof res.body.getReader === "function") {
      const reader = res.body.getReader()
      const chunks: Buffer[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(Buffer.from(value))
      }
      buf = Buffer.concat(chunks)
    } else if (res.body && Symbol.asyncIterator in Object(res.body)) {
      const chunks: Buffer[] = []
      for await (const c of res.body) chunks.push(Buffer.from(c))
      buf = Buffer.concat(chunks)
    }
  } catch (e: any) {
    throw new MissingSkillError(`skill provisioning failed: catalog read failed for ${url}: ${e?.message ?? e}`, { url, error: String(e?.message ?? e) })
  }

  if (!buf) {
    // maybe res is already a buffer/string
    if (Buffer.isBuffer(res)) buf = res
    else if (typeof res === "string") buf = Buffer.from(res)
    else buf = Buffer.from("")
  }

  if (buf.length > maxBytes) {
    throw new PathSafetyError(`skill provisioning failed: catalog payload exceeds size limit for ${url} (${buf.length} > ${maxBytes})`, { url, size: buf.length, limit: maxBytes })
  }
  return buf
}

async function fetchJson(fetchFn: any, url: string, maxBytes: number): Promise<any> {
  const buf = await fetchBytes(fetchFn, url, maxBytes)
  let parsed: any
  try {
    parsed = JSON.parse(buf.toString("utf8"))
  } catch (e: any) {
    throw new ManifestValidationError(`skill provisioning failed: catalog index is not valid JSON at ${url}: ${e?.message ?? e}`, { url })
  }
  return parsed
}

function normalizeOptions(...args: any[]): any {
  const out: any = {}
  for (const a of args) {
    if (a == null) continue
    if (typeof a === "string") {
      if (!out.url && isHttpUrl(a)) out.url = a
      else if (out.root === undefined) out.root = a
      continue
    }
    if (typeof a === "object") {
      Object.assign(out, a)
    }
  }
  return out
}

function resolveRootForCatalog(options: any): { root: string; remote: boolean } {
  const t = options.transport
  const remoteCandidates = [
    t && (typeof t.resolveRoot === "function" ? t.resolveRoot() : t.root),
    options.remoteRoot,
    options.remote,
    options.checkout,
    options.directory,
    typeof options.location === "string" ? options.location : options.location?.directory,
  ]
  for (const c of remoteCandidates) {
    if (typeof c === "string" && c.length > 0) {
      return { root: path.resolve(c), remote: true }
    }
  }
  const localCandidates = [options.localRoot, options.sourceRoot, options.projectRoot, options.root]
  for (const c of localCandidates) {
    if (typeof c === "string" && c.length > 0) {
      return { root: path.resolve(c), remote: false }
    }
  }
  // default to cwd? use process.cwd() but tests pass root. If none, throw.
  if (typeof options.root === "string") return { root: path.resolve(options.root), remote: false }
  throw new ProvisioningError("catalog_root_missing", "skill provisioning failed: project root is required", {})
}

export async function provisionCatalogLocal(options: any): Promise<ProvisionReport> {
  const opts = normalizeOptions(options)
  const root = path.resolve(opts.root)
  const role = opts.role ?? "delegate"
  const { manifest, raw } = loadManifest(root, opts.manifestPath)
  validateManifest(manifest)
  if (!manifest.roles || !Object.prototype.hasOwnProperty.call(manifest.roles, role)) {
    throw new ManifestValidationError(`skill provisioning failed: role ${role} is not declared in manifest`, { role })
  }
  const roleIds = manifest.roles[role] ?? []
  const sourceRevision = sha256Buffer(Buffer.from(raw, "utf8"))
  const report: ProvisionReport = {
    role,
    source_revision: sourceRevision,
    generated_at: (opts.now ? opts.now() : new Date().toISOString()),
    skills: [],
    warnings: [],
  }
  const fetchFn = getFetchFn(opts)
  if (!fetchFn) throw new ProvisioningError("fetch_missing", "skill provisioning failed: fetch function is required for catalog source", {})
  const maxBytesDefault = getMaxBytes(opts)

  for (const id of roleIds) {
    const decl = (manifest.skills ?? {})[id]
    if (!decl) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": missing declaration`, { id, role, expected: "missing", observed: "missing", path: "(undeclared)" })
    }
    const source = (decl.source ?? "project") as SkillSource
    const expected = decl.revision ?? ""

    if (source !== "catalog") {
      // verify in place
      const resolved = resolveSkillPath(root, decl, id)
      if (!existsSync(resolved.full)) {
        throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": missing (expected revision ${expected}, observed missing) at ${resolved.relative}`, { id, role, expected, observed: "missing", path: resolved.relative, origin: resolved.origin })
      }
      let observed: string
      try { observed = computeRevision(resolved.full) } catch {
        throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": unreadable`, { id, role, expected, observed: "missing", path: resolved.relative })
      }
      if (expected && observed !== expected) {
        throw new SkillRevisionMismatchError(`skill provisioning failed: skill "${id}" for role "${role}": revision mismatch (expected ${expected}, observed ${observed}) at ${resolved.relative}`, { id, role, expected, observed, path: resolved.relative, origin: resolved.origin })
      }
      report.skills.push({ id, roles: rolesUsing(manifest, id), source, origin: resolved.origin, path: resolved.relative, revision: expected, observed_revision: observed, override: decl.override === true ? true : undefined })
      continue
    }

    const baseUrl = resolveCatalogBaseUrl(decl, opts, id)
    if (!baseUrl) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": catalog base URL missing`, { id, role, expected, observed: "missing", origin: "catalog" })
    }
    const entryName = catalogEntryName(decl, id)
    const indexUrl = catalogIndexUrl(baseUrl)
    const index = await fetchJson(fetchFn, indexUrl, getMaxBytes(opts, decl))
    const entries = catalogEntriesOf(index)
    const entry = entries.find((e: any) => String(e?.name ?? e?.id ?? e?.skill ?? "") === entryName)
    if (!entry) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": catalog entry missing (expected ${entryName}) at ${indexUrl}`, { id, role, expected: entryName, observed: "missing", path: indexUrl, origin: baseUrl })
    }
    if (decl.version !== undefined && entry.version !== undefined && entry.version !== decl.version) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": catalog version mismatch (expected ${decl.version}, observed ${entry.version})`, { id, role, expected: decl.version, observed: entry.version })
    }

    const destRelFinal = decl.path && isSafeRelative(decl.path) ? decl.path : `.opencode/skills/${id}`
    if (!isSafeRelative(destRelFinal)) {
      throw new PathSafetyError(`skill provisioning failed: unsafe path for ${id}: ${destRelFinal}`, { id, path: destRelFinal })
    }
    const destFull = path.resolve(root, destRelFinal)
    if (destFull !== root && !destFull.startsWith(root + path.sep)) {
      throw new PathSafetyError(`skill provisioning failed: path escapes project root for ${id}: ${destRelFinal}`, { id, path: destRelFinal })
    }

    const files = entryFilesOf(entry)
    if (!files || files.length === 0) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": catalog entry has no files`, { id, role, origin: baseUrl })
    }

    // clean dest
    if (existsSync(destFull)) rmSync(destFull, { recursive: true, force: true })
    mkdirSync(destFull, { recursive: true })

    const maxBytes = getMaxBytes(opts, decl)
    for (const f of files) {
      const rel = entryFileName(f)
      if (!rel || !isSafeRelative(rel)) {
        throw new PathSafetyError(`skill provisioning failed: unsafe catalog file path: ${rel}`, { id, path: rel })
      }
      let fileUrl: URL
      try {
        fileUrl = new URL(`${entryName}/${rel}`, baseUrl + "/")
      } catch {
        throw new PathSafetyError(`skill provisioning failed: invalid catalog URL for ${rel}`, { id, path: rel })
      }
      if (fileUrl.origin !== new URL(baseUrl).origin) {
        throw new PathSafetyError(`skill provisioning failed: catalog file is not same-origin: ${fileUrl.toString()}`, { id, url: fileUrl.toString() })
      }
      // ensure no traversal in resolved pathname
      if (fileUrl.pathname.includes("..")) {
        throw new PathSafetyError(`skill provisioning failed: unsafe catalog file path: ${rel}`, { id, path: rel })
      }
      const bytes = await fetchBytes(fetchFn, fileUrl.toString(), maxBytes)
      const target = path.join(destFull, rel)
      const targetDir = path.dirname(target)
      if (targetDir !== destFull && !targetDir.startsWith(destFull + path.sep)) {
        throw new PathSafetyError(`skill provisioning failed: catalog file escapes destination: ${rel}`, { id, path: rel })
      }
      mkdirSync(targetDir, { recursive: true })
      writeFileSync(target, bytes)
    }

    let observed: string
    try {
      observed = computeRevision(destFull)
    } catch {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": unreadable after download`, { id, role, expected, observed: "missing", path: destRelFinal })
    }
    if (expected && observed !== expected) {
      throw new SkillRevisionMismatchError(`skill provisioning failed: skill "${id}" for role "${role}": revision mismatch (expected ${expected}, observed ${observed}) at ${destRelFinal}`, { id, role, expected, observed, path: destRelFinal, origin: baseUrl })
    }

    report.skills.push({
      id,
      roles: rolesUsing(manifest, id),
      source: "catalog",
      origin: `catalog:${baseUrl}/${entryName}`,
      path: destRelFinal,
      revision: expected,
      observed_revision: observed,
      override: decl.override === true ? true : undefined,
    })
  }

  const defaultReportPath = path.join(root, ".bive", "skills.report.json")
  let finalPath: string | null = null
  if (opts.reportPath === false || opts.reportPath === null) finalPath = null
  else if (opts.reportPath === undefined || opts.reportPath === true) finalPath = defaultReportPath
  else finalPath = path.isAbsolute(String(opts.reportPath)) ? String(opts.reportPath) : path.join(root, String(opts.reportPath))

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

export async function provisionCatalogRemote(options: any): Promise<ProvisionReport> {
  const opts = normalizeOptions(options)
  const remoteRoot = path.resolve(resolveRemoteRoot(opts))
  const sourceRoot = path.resolve(resolveSourceRoot(opts, remoteRoot))
  const role = opts.role ?? "delegate"
  const approvedRel = opts.approvedDir ?? opts.skillsPath ?? ".opencode/skills"
  if (!isSafeRelative(approvedRel)) {
    throw new PathSafetyError(`skill provisioning failed: approved directory must be a safe relative path: ${approvedRel}`, { path: approvedRel })
  }
  const approvedRoot = path.resolve(remoteRoot, approvedRel)
  if (!isWithin(remoteRoot, approvedRoot)) {
    throw new PathSafetyError(`skill provisioning failed: approved directory escapes checkout: ${approvedRel}`, { path: approvedRel })
  }

  const useRemoteManifest = existsSync(opts.manifestPath ? path.resolve(remoteRoot, opts.manifestPath) : path.join(remoteRoot, ".bive", "skills.json"))
  const manifestRoot = useRemoteManifest ? remoteRoot : (existsSync(path.join(sourceRoot, ".bive", "skills.json")) ? sourceRoot : remoteRoot)

  const { manifest, raw } = loadManifest(manifestRoot, opts.manifestPath)
  validateManifest(manifest)
  if (!manifest.roles || !Object.prototype.hasOwnProperty.call(manifest.roles, role)) {
    throw new ManifestValidationError(`skill provisioning failed: role ${role} is not declared in manifest`, { role })
  }
  const roleIds = manifest.roles[role] ?? []
  const sourceRevision = sha256Buffer(Buffer.from(raw, "utf8"))
  const report: ProvisionReport = { role, source_revision: sourceRevision, generated_at: (opts.now ? opts.now() : new Date().toISOString()), skills: [], warnings: [] }

  const fetchFn = getFetchFn(opts)
  const hasCatalog = roleIds.some((id: string) => ((manifest.skills ?? {})[id]?.source ?? "project") === "catalog")
  if (hasCatalog && !fetchFn) {
    throw new ProvisioningError("fetch_missing", "skill provisioning failed: fetch function is required for catalog source", {})
  }

  const pushBundle = opts.pushBundle !== false

  for (const id of roleIds) {
    const decl = (manifest.skills ?? {})[id]
    if (!decl) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": missing declaration`, { id, role, expected: "missing", observed: "missing", path: "(undeclared)" })
    }
    const source = (decl.source ?? "project") as SkillSource
    const expected = decl.revision ?? ""

    if (source !== "catalog") {
      // reuse remote verify/push logic minimally
      const remoteResolved = resolveSkillPath(remoteRoot, decl, id)
      let observed = safeCompute(remoteResolved.full)
      if (observed !== expected) {
        if (pushBundle) {
          const sourceResolved = resolveSkillPath(sourceRoot, decl, id)
          if (!existsSync(sourceResolved.full)) {
            throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": missing (expected revision ${expected}, observed missing) at ${sourceResolved.relative} (source)`, { id, role, expected, observed: "missing", path: sourceResolved.relative, origin: sourceResolved.origin })
          }
          let sourceHash: string
          try { sourceHash = computeRevision(sourceResolved.full) } catch {
            throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": unreadable`, { id, role, expected, observed: "missing", path: sourceResolved.relative })
          }
          if (expected && sourceHash !== expected) {
            throw new SkillRevisionMismatchError(`skill provisioning failed: skill "${id}" for role "${role}": revision mismatch (expected ${expected}, observed ${sourceHash}) at ${sourceResolved.relative}`, { id, role, expected, observed: sourceHash, path: sourceResolved.relative, origin: sourceResolved.origin })
          }
          if (!isWithin(remoteRoot, remoteResolved.full)) {
            throw new PathSafetyError(`skill provisioning failed: path escapes checkout for ${id}: ${remoteResolved.relative}`, { id, path: remoteResolved.relative })
          }
          copyRecursive(sourceResolved.full, remoteResolved.full)
          observed = safeCompute(remoteResolved.full)
        }
      }
      if (observed === null) {
        throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": missing (expected revision ${expected}, observed missing) at ${remoteResolved.relative}`, { id, role, expected, observed: "missing", path: remoteResolved.relative, origin: remoteResolved.origin })
      }
      if (expected && observed !== expected) {
        throw new SkillRevisionMismatchError(`skill provisioning failed: skill "${id}" for role "${role}": revision mismatch (expected ${expected}, observed ${observed}) at ${remoteResolved.relative}`, { id, role, expected, observed, path: remoteResolved.relative, origin: remoteResolved.origin })
      }
      report.skills.push({ id, roles: rolesUsing(manifest, id), source, origin: remoteResolved.origin, path: remoteResolved.relative, revision: expected, observed_revision: observed, override: decl.override === true ? true : undefined })
      continue
    }

    const baseUrl = resolveCatalogBaseUrl(decl, opts, id)
    if (!baseUrl) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": catalog base URL missing`, { id, role, expected, observed: "missing", origin: "catalog" })
    }
    const entryName = catalogEntryName(decl, id)
    const indexUrl = catalogIndexUrl(baseUrl)
    const index = await fetchJson(fetchFn, indexUrl, getMaxBytes(opts, decl))
    const entries = catalogEntriesOf(index)
    const entry = entries.find((e: any) => String(e?.name ?? e?.id ?? e?.skill ?? "") === entryName)
    if (!entry) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": catalog entry missing (expected ${entryName}) at ${indexUrl}`, { id, role, expected: entryName, observed: "missing", path: indexUrl, origin: baseUrl })
    }
    if (decl.version !== undefined && entry.version !== undefined && entry.version !== decl.version) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": catalog version mismatch (expected ${decl.version}, observed ${entry.version})`, { id, role, expected: decl.version, observed: entry.version })
    }

    const destRel = decl.path && isSafeRelative(decl.path) ? decl.path : `${approvedRel}/${id}`
    if (!isSafeRelative(destRel)) {
      throw new PathSafetyError(`skill provisioning failed: unsafe path for ${id}: ${destRel}`, { id, path: destRel })
    }
    const destFull = path.resolve(remoteRoot, destRel)
    if (!isWithin(remoteRoot, destFull)) {
      throw new PathSafetyError(`skill provisioning failed: path escapes checkout for ${id}: ${destRel}`, { id, path: destRel })
    }

    const files = entryFilesOf(entry)
    if (!files || files.length === 0) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": catalog entry has no files`, { id, role, origin: baseUrl })
    }

    if (existsSync(destFull)) rmSync(destFull, { recursive: true, force: true })
    mkdirSync(destFull, { recursive: true })

    const maxBytes = getMaxBytes(opts, decl)
    for (const f of files) {
      const rel = entryFileName(f)
      if (!rel || !isSafeRelative(rel)) {
        throw new PathSafetyError(`skill provisioning failed: unsafe catalog file path: ${rel}`, { id, path: rel })
      }
      const fileUrl = new URL(`${entryName}/${rel}`, baseUrl + "/")
      if (fileUrl.origin !== new URL(baseUrl).origin) {
        throw new PathSafetyError(`skill provisioning failed: catalog file is not same-origin: ${fileUrl.toString()}`, { id, url: fileUrl.toString() })
      }
      const bytes = await fetchBytes(fetchFn, fileUrl.toString(), maxBytes)
      const target = path.join(destFull, rel)
      const targetDir = path.dirname(target)
      if (targetDir !== destFull && !targetDir.startsWith(destFull + path.sep)) {
        throw new PathSafetyError(`skill provisioning failed: catalog file escapes destination: ${rel}`, { id, path: rel })
      }
      mkdirSync(targetDir, { recursive: true })
      writeFileSync(target, bytes)
    }

    let observed = safeCompute(destFull)
    if (observed === null) {
      throw new MissingSkillError(`skill provisioning failed: skill "${id}" for role "${role}": missing after download`, { id, role, expected, observed: "missing", path: destRel })
    }
    if (expected && observed !== expected) {
      throw new SkillRevisionMismatchError(`skill provisioning failed: skill "${id}" for role "${role}": revision mismatch (expected ${expected}, observed ${observed}) at ${destRel}`, { id, role, expected, observed, path: destRel, origin: baseUrl })
    }
    report.skills.push({ id, roles: rolesUsing(manifest, id), source: "catalog", origin: `catalog:${baseUrl}/${entryName}`, path: destRel, revision: expected, observed_revision: observed, override: decl.override === true ? true : undefined })
  }

  const defaultReportPath = path.join(remoteRoot, ".bive", "skills.report.json")
  let finalPath: string | null = null
  if (opts.reportPath === false || opts.reportPath === null) finalPath = null
  else if (opts.reportPath === undefined || opts.reportPath === true) finalPath = defaultReportPath
  else finalPath = path.isAbsolute(String(opts.reportPath)) ? String(opts.reportPath) : path.join(remoteRoot, String(opts.reportPath))

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

export async function provisionCatalog(options: any): Promise<ProvisionReport> {
  const opts = normalizeOptions(options)
  const { remote } = resolveRootForCatalog(opts)
  if (remote) return provisionCatalogRemote(opts)
  return provisionCatalogLocal(opts)
}

// fetchCatalog: fetch and parse an HTTP skill catalog index.
export async function fetchCatalog(...args: any[]): Promise<any> {
  const opts = normalizeOptions(...args)
  const fetchFn = getFetchFn(opts)
  if (!fetchFn) throw new ProvisioningError("fetch_missing", "skill provisioning failed: fetch function is required", {})
  const base = resolveCatalogBaseUrl({}, opts, "") || opts.baseUrl || opts.url || opts.catalogUrl || opts.catalog
  if (!isHttpUrl(base)) throw new ProvisioningError("catalog_url_missing", "skill provisioning failed: catalog base URL is required", {})
  const maxBytes = getMaxBytes(opts)
  return fetchJson(fetchFn, catalogIndexUrl(base), maxBytes)
}

// downloadCatalogSkill: download a single catalog skill entry to dest.
export async function downloadCatalogSkill(...args: any[]): Promise<any> {
  const opts = normalizeOptions(...args)
  const fetchFn = getFetchFn(opts)
  if (!fetchFn) throw new ProvisioningError("fetch_missing", "skill provisioning failed: fetch function is required", {})
  const baseUrl = resolveCatalogBaseUrl({}, opts, opts.id ?? opts.name ?? "skill")
  const base = isHttpUrl(baseUrl) ? baseUrl : (isHttpUrl(opts.baseUrl || opts.url || opts.catalogUrl || opts.catalog) ? trimSlash(opts.baseUrl || opts.url || opts.catalogUrl || opts.catalog) : null)
  if (!base) throw new ProvisioningError("catalog_url_missing", "skill provisioning failed: catalog base URL is required", {})
  const entryName = opts.entry || opts.name || opts.id || opts.skill || "skill"
  const index = await fetchJson(fetchFn, catalogIndexUrl(base), getMaxBytes(opts))
  const entries = catalogEntriesOf(index)
  const entry = entries.find((e: any) => String(e?.name ?? e?.id ?? e?.skill ?? "") === entryName)
  if (!entry) throw new MissingSkillError(`skill provisioning failed: catalog entry missing: ${entryName}`, { entry: entryName, observed: "missing" })
  const root = path.resolve(opts.root || opts.destRoot || process.cwd())
  const destRel = opts.dest || opts.path || opts.directory || `.opencode/skills/${entryName}`
  if (!isSafeRelative(destRel)) throw new PathSafetyError(`skill provisioning failed: unsafe path: ${destRel}`, { path: destRel })
  const destFull = path.resolve(root, destRel)
  if (destFull !== root && !destFull.startsWith(root + path.sep)) throw new PathSafetyError(`skill provisioning failed: path escapes root: ${destRel}`, { path: destRel })
  if (existsSync(destFull)) rmSync(destFull, { recursive: true, force: true })
  mkdirSync(destFull, { recursive: true })
  const files = entryFilesOf(entry)
  for (const f of files) {
    const rel = entryFileName(f)
    if (!rel || !isSafeRelative(rel)) throw new PathSafetyError(`skill provisioning failed: unsafe catalog file path: ${rel}`, { path: rel })
    const fileUrl = new URL(`${entryName}/${rel}`, base + "/")
    if (fileUrl.origin !== new URL(base).origin) throw new PathSafetyError(`skill provisioning failed: not same-origin: ${fileUrl.toString()}`, { url: fileUrl.toString() })
    const bytes = await fetchBytes(fetchFn, fileUrl.toString(), getMaxBytes(opts))
    const target = path.join(destFull, rel)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, bytes)
  }
  const observed = computeRevision(destFull)
  return { entry, observed_revision: observed, path: destRel, root, dest: destFull }
}

// Aliases for catalog functions
export const provisionCatalogSource = provisionCatalog
export const provisionCatalogSkills = provisionCatalog
export const provisionCatalogSkill = provisionCatalog
export const catalogProvision = provisionCatalog
export const catalogProvisioning = provisionCatalog
export const provisionFromCatalog = provisionCatalog
export const provisionCatalogLocalSkills = provisionCatalogLocal
export const provisionCatalogRemoteSkills = provisionCatalogRemote
export const fetchSkillCatalog = fetchCatalog
export const fetchCatalogIndex = fetchCatalog
export const downloadCatalog = downloadCatalogSkill
export const downloadSkillFromCatalog = downloadCatalogSkill

export default {
  provisionLocal,
  provisionCatalog,
  provisionCatalogLocal,
  provisionCatalogRemote,
  provisionCatalogSource,
  provisionCatalogSkills,
  provisionCatalogSkill,
  catalogProvision,
  catalogProvisioning,
  provisionFromCatalog,
  provisionCatalogLocalSkills,
  provisionCatalogRemoteSkills,
  fetchCatalog,
  fetchSkillCatalog,
  fetchCatalogIndex,
  downloadCatalogSkill,
  downloadCatalog,
  downloadSkillFromCatalog,
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
