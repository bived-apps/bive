export const AUTHORIZATION_LABEL_PREFIX = "bive-merge-authorized-until-"
export const OVERRIDE_LABEL_PREFIX = "bive-owner-override-"

// Integration branches the gate covers: Bive's own `bived`, and one `milestone/<name>` per coordinator (#88).
export function isIntegrationBranch(ref) {
  return ref === "bived" || (typeof ref === "string" && /^milestone\/[A-Za-z0-9._-]+$/.test(ref))
}

const identity = (check) => `${check.workflow} / ${check.name}`
const REQUIRED_CHECKS = [
  { workflow: "bive-tests", name: "tests" },
  { workflow: "bive-inviolable", name: "check" },
]

function validateDatedLabel(label, prefix, { now, appliedAt, appliedBy, owner, actorType, performedViaApp }) {
  const match = new RegExp(`^${prefix}(\\d{4}-\\d{2}-\\d{2})$`).exec(label)
  if (!match) return { ok: false, reason: `${prefix} label must end in YYYY-MM-DD` }
  const labelDate = match[1]
  const date = new Date(`${labelDate}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== labelDate) {
    return { ok: false, reason: `${prefix} label contains an invalid UTC date` }
  }
  const expiresAt = Date.parse(`${labelDate}T23:59:59.999Z`)
  if (now > expiresAt) return { ok: false, reason: `${prefix} authorization has expired` }

  if (appliedAt) {
    const applied = new Date(appliedAt)
    if (Number.isNaN(applied.valueOf())) {
      return { ok: false, reason: `${prefix} label event has an invalid date` }
    }
    const appliedDate = applied.toISOString().slice(0, 10)
    if (labelDate !== appliedDate) {
      return { ok: false, reason: `${prefix} label date does not match the day it was applied` }
    }
  }

  if (owner && appliedBy) {
    const allowed = Array.isArray(owner) ? owner : [owner]
    if (!allowed.includes(appliedBy)) {
      return { ok: false, reason: `${prefix} label was not applied by the repository owner` }
    }
  }

  // Issue #130: an agent acting under a GitHub App must never be the actor of a
  // dated authorization/override label. Refuse when the labeled event's actor is
  // a Bot or was performed via a GitHub App, so the owner's identity stays distinct.
  if (actorType === "Bot" || performedViaApp) {
    return { ok: false, reason: `${prefix} label was applied by an agent (Bot or GitHub App), not the owner` }
  }

  return { ok: true }
}

export function validateMergeAuthorization({ labels = [], baseRef, now = Date.now(),
  labelAppliedAt = null, labelAppliedBy = null, owner = null,
  labelActorType = null, labelPerformedViaApp = null,
  overrideAppliedAt = null, overrideAppliedBy = null, overrideOwner = null,
  overrideActorType = null, overridePerformedViaApp = null }) {
  if (!isIntegrationBranch(baseRef)) {
    return { ok: false, reason: "merge gate only authorizes pull requests targeting bived or milestone/<name>" }
  }
  const matches = labels.filter((label) => label.startsWith(AUTHORIZATION_LABEL_PREFIX))
  if (matches.length !== 1) return { ok: false, reason: "exactly one dated merge-authorization label is required" }

  const result = validateDatedLabel(matches[0], AUTHORIZATION_LABEL_PREFIX, {
    now, appliedAt: labelAppliedAt, appliedBy: labelAppliedBy, owner,
    actorType: labelActorType, performedViaApp: labelPerformedViaApp })
  if (!result.ok) return result

  const overrides = labels.filter((label) => label.startsWith(OVERRIDE_LABEL_PREFIX))
  if (overrides.length > 1) return { ok: false, reason: "at most one owner-override label is allowed" }
  if (overrides.length === 1) {
    const oResult = validateDatedLabel(overrides[0], OVERRIDE_LABEL_PREFIX, {
      now, appliedAt: overrideAppliedAt, appliedBy: overrideAppliedBy, owner: overrideOwner,
      actorType: overrideActorType, performedViaApp: overridePerformedViaApp })
    if (!oResult.ok) return oResult
  }

  return { ok: true }
}

function isRedBucket(bucket) {
  return bucket !== "pass" && bucket !== "pending" && bucket !== undefined && bucket !== null && bucket !== ""
}

export function evaluateMergeGate({ labels = [], baseRef, checks = [], now = Date.now(),
  labelAppliedAt = null, labelAppliedBy = null, owner = null,
  labelActorType = null, labelPerformedViaApp = null,
  overrideAppliedAt = null, overrideAppliedBy = null, overrideOwner = null,
  overrideActorType = null, overridePerformedViaApp = null }) {
  const override = labels.some((l) => l.startsWith(OVERRIDE_LABEL_PREFIX))
  const grant = validateMergeAuthorization({ labels, baseRef, now, labelAppliedAt, labelAppliedBy, owner,
    labelActorType, labelPerformedViaApp,
    overrideAppliedAt, overrideAppliedBy, overrideOwner,
    overrideActorType, overridePerformedViaApp })
  if (!grant.ok) return grant

  const coordinator = labels.includes("coordinator")
  const actionableChecks = checks.filter((check) => identity(check) !== "bive-merge-gate / merge-gate")

  for (const required of REQUIRED_CHECKS) {
    const found = actionableChecks.filter((check) => identity(check) === identity(required))
    if (found.length === 0) {
      if (override) continue
      return { ok: false, reason: `expected exactly one ${identity(required)} check` }
    }
    if (found.length > 1) return { ok: false, reason: `expected exactly one ${identity(required)} check` }
    const bucket = found[0].bucket
    const expectedSkip = coordinator && identity(required) === "bive-inviolable / check" && bucket === "skipping"
    if (bucket === "pass" || expectedSkip) continue
    if (override && bucket === "pending") continue
    return { ok: false, reason: `${identity(required)} is ${bucket || "missing a result"}` }
  }

  const redUnexpected = actionableChecks.find((check) => {
    if (identity(check) === "bive-tests / tests" || identity(check) === "bive-inviolable / check") return false
    const bucket = check.bucket
    if (bucket === "pass") return false
    if (override && bucket === "pending") return false
    if (coordinator && identity(check) === "bive-inviolable / check" && bucket === "skipping") return false
    return true
  })
  if (redUnexpected) {
    return { ok: false, reason: `${identity(redUnexpected)} is ${redUnexpected.bucket || "missing a result"}` }
  }

  return { ok: true, reason: override
    ? "dated authorization, owner override and required checks are valid"
    : "dated authorization and required checks are valid" }
}