export const AUTHORIZATION_LABEL_PREFIX = "bive-merge-authorized-until-"

// Integration branches the gate covers: Bive's own `bived`, and one `milestone/<name>` per coordinator (#88).
export function isIntegrationBranch(ref) {
  return ref === "bived" || (typeof ref === "string" && /^milestone\/[A-Za-z0-9._-]+$/.test(ref))
}

const identity = (check) => `${check.workflow} / ${check.name}`
const REQUIRED_CHECKS = [
  { workflow: "bive-tests", name: "tests" },
  { workflow: "bive-inviolable", name: "check" },
]

export function validateMergeAuthorization({ labels = [], baseRef, now = Date.now(),
  labelAppliedAt = null, labelAppliedBy = null, owner = null }) {
  if (!isIntegrationBranch(baseRef)) {
    return { ok: false, reason: "merge gate only authorizes pull requests targeting bived or milestone/<name>" }
  }
  const matches = labels.filter((label) => label.startsWith(AUTHORIZATION_LABEL_PREFIX))
  if (matches.length !== 1) return { ok: false, reason: "exactly one dated merge-authorization label is required" }

  const match = /^bive-merge-authorized-until-(\d{4}-\d{2}-\d{2})$/.exec(matches[0])
  if (!match) return { ok: false, reason: "merge-authorization label must end in YYYY-MM-DD" }
  const labelDate = match[1]
  const date = new Date(`${labelDate}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== labelDate) {
    return { ok: false, reason: "merge-authorization label contains an invalid UTC date" }
  }
  const expiresAt = Date.parse(`${labelDate}T23:59:59.999Z`)
  if (now > expiresAt) return { ok: false, reason: "merge authorization has expired" }

  // The label's date must be the UTC day on which it was applied: a label dated
  // tomorrow or later (or any day other than the applying day) is refused.
  if (labelAppliedAt) {
    const applied = new Date(labelAppliedAt)
    if (Number.isNaN(applied.valueOf())) {
      return { ok: false, reason: "merge-authorization label event has an invalid date" }
    }
    const appliedDate = applied.toISOString().slice(0, 10)
    if (labelDate !== appliedDate) {
      return { ok: false, reason: "merge-authorization label date does not match the day it was applied" }
    }
  }

  // The label must have been applied by the repository owner (or a listed owner
  // identity). With a single shared account this cannot distinguish owner from
  // agent; see docs/REQUIRED-CHECKS.md for what this does and does not prove.
  if (owner && labelAppliedBy) {
    const allowed = Array.isArray(owner) ? owner : [owner]
    if (!allowed.includes(labelAppliedBy)) {
      return { ok: false, reason: "merge-authorization label was not applied by the repository owner" }
    }
  }

  return { ok: true }
}

export function evaluateMergeGate({ labels = [], baseRef, checks = [], now = Date.now(),
  labelAppliedAt = null, labelAppliedBy = null, owner = null }) {
  const grant = validateMergeAuthorization({ labels, baseRef, now, labelAppliedAt, labelAppliedBy, owner })
  if (!grant.ok) return grant

  const coordinator = labels.includes("coordinator")
  const actionableChecks = checks.filter((check) => identity(check) !== "bive-merge-gate / merge-gate")
  for (const required of REQUIRED_CHECKS) {
    const found = actionableChecks.filter((check) => identity(check) === identity(required))
    if (found.length !== 1) return { ok: false, reason: `expected exactly one ${identity(required)} check` }
    const bucket = found[0].bucket
    const expectedSkip = coordinator && identity(required) === "bive-inviolable / check" && bucket === "skipping"
    if (bucket !== "pass" && !expectedSkip) {
      return { ok: false, reason: `${identity(required)} is ${bucket || "missing a result"}` }
    }
  }

  const unexpected = actionableChecks.find((check) => check.bucket !== "pass"
    && !(coordinator && identity(check) === "bive-inviolable / check" && check.bucket === "skipping"))
  if (unexpected) return { ok: false, reason: `${identity(unexpected)} is ${unexpected.bucket || "missing a result"}` }
  return { ok: true, reason: "dated authorization and required checks are valid" }
}