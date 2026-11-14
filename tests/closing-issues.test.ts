import assert from "node:assert/strict"
import test from "node:test"
import { closingIssueNumbers } from "../lib/closing-issues.ts"

test("one closing keyword per line closes one issue", () => {
  assert.deepEqual(closingIssueNumbers("Closes #1\nCloses #2"), [1, 2])
})

test("Closes #1, #2 closes only the first issue", () => {
  assert.deepEqual(closingIssueNumbers("Closes #1, #2"), [1])
})

test("Part of does not close", () => {
  assert.deepEqual(closingIssueNumbers("Part of #3\nCloses #4"), [4])
})

test("a line without a leading closing keyword does not close", () => {
  assert.deepEqual(closingIssueNumbers("Fixes nothing here"), [])
  assert.deepEqual(closingIssueNumbers(""), [])
  assert.deepEqual(closingIssueNumbers("Resolves #5"), [5])
})

// ---- issue #229 part 1: .github/scripts/close-integration-issues.mjs ----

import { parseClosingRefs, shouldHandle, planClosures, run } from "../.github/scripts/close-integration-issues.mjs"

const MERGE_SHA = "abc123def4567890abcdef1234567890abcd1234"

function mergedEvent(overrides = {}) {
  return {
    action: "closed",
    pull_request: {
      number: 7,
      merged: true,
      merge_commit_sha: MERGE_SHA,
      base: { ref: "bived" },
      body: "Closes #5",
      ...overrides,
    },
  }
}

test("parseClosingRefs: close/fix/resolve variants each close one issue", () => {
  assert.deepEqual(parseClosingRefs("Close #1", { repo: "me/repo" }), [1])
  assert.deepEqual(parseClosingRefs("Closed #2", { repo: "me/repo" }), [2])
  assert.deepEqual(parseClosingRefs("Fix #3", { repo: "me/repo" }), [3])
  assert.deepEqual(parseClosingRefs("Fixed #4", { repo: "me/repo" }), [4])
  assert.deepEqual(parseClosingRefs("Resolved #5", { repo: "me/repo" }), [5])
})

test("parseClosingRefs: multiple refs are ordered and unique", () => {
  assert.deepEqual(parseClosingRefs("Closes #5\nFixes #6\nCloses #5", { repo: "me/repo" }), [5, 6])
})

test("parseClosingRefs: first ref only, like lib/closing-issues.ts", () => {
  assert.deepEqual(parseClosingRefs("Closes #5, #6", { repo: "me/repo" }), [5])
})

test("parseClosingRefs: fenced code block is ignored", () => {
  const body = "```\nCloses #9\n```\nCloses #5"
  assert.deepEqual(parseClosingRefs(body, { repo: "me/repo" }), [5])
})

test("parseClosingRefs: inline code is ignored", () => {
  assert.deepEqual(parseClosingRefs("`Closes #9`", { repo: "me/repo" }), [])
  assert.deepEqual(parseClosingRefs("Closes `#9`", { repo: "me/repo" }), [])
})

test("parseClosingRefs: an unpaired backtick makes the line unsure, so it is ignored", () => {
  assert.deepEqual(parseClosingRefs("Closes #5 `example", { repo: "me/repo" }), [])
})

test("parseClosingRefs: blockquote lines are ignored", () => {
  assert.deepEqual(parseClosingRefs("> Closes #9\nCloses #5", { repo: "me/repo" }), [5])
})

test("parseClosingRefs: Part of is ignored", () => {
  assert.deepEqual(parseClosingRefs("Part of #9\npart of #8\nCloses #5", { repo: "me/repo" }), [5])
})

test("parseClosingRefs: foreign-repo owner/repo#N references are ignored", () => {
  assert.deepEqual(parseClosingRefs("Closes other/repo#5", { repo: "me/repo" }), [])
})

test("parseClosingRefs: same-repo owner/repo#N references are kept (case-insensitive)", () => {
  assert.deepEqual(parseClosingRefs("Closes me/repo#5", { repo: "me/repo" }), [5])
  assert.deepEqual(parseClosingRefs("Closes ME/REPO#5", { repo: "me/repo" }), [5])
})

test("parseClosingRefs: without a repo to compare against, owner/repo#N is unsure and ignored", () => {
  assert.deepEqual(parseClosingRefs("Closes other/repo#5"), [])
})

test("parseClosingRefs: a plain #N is same-repository even without the repo argument", () => {
  assert.deepEqual(parseClosingRefs("Closes #5"), [5])
})

test("parseClosingRefs: foreign-repo issue URLs are ignored", () => {
  assert.deepEqual(parseClosingRefs("Closes https://github.com/other/repo/issues/5", { repo: "me/repo" }), [])
})

test("parseClosingRefs: same-repo issue URLs are kept", () => {
  assert.deepEqual(parseClosingRefs("Closes https://github.com/me/repo/issues/5", { repo: "me/repo" }), [5])
})

test("parseClosingRefs: an unparseable reference is unsure and ignored", () => {
  assert.deepEqual(parseClosingRefs("Closes see the tracker", { repo: "me/repo" }), [])
})

test("shouldHandle: merged pull request into bived", () => {
  assert.equal(shouldHandle(mergedEvent()), true)
})

test("shouldHandle: milestone/* bases pass", () => {
  assert.equal(shouldHandle(mergedEvent({ base: { ref: "milestone/0.2" } })), true)
  assert.equal(shouldHandle(mergedEvent({ base: { ref: "milestone/x" } })), true)
})

test("shouldHandle: main and other bases fail", () => {
  assert.equal(shouldHandle(mergedEvent({ base: { ref: "main" } })), false)
  assert.equal(shouldHandle(mergedEvent({ base: { ref: "feature/x" } })), false)
  assert.equal(shouldHandle(mergedEvent({ base: { ref: "milestone/" } })), false)
})

test("shouldHandle: unmerged pull request fails", () => {
  const event = mergedEvent()
  event.pull_request.merged = false
  assert.equal(shouldHandle(event), false)
})

test("shouldHandle: other actions fail", () => {
  assert.equal(shouldHandle({ ...mergedEvent(), action: "opened" }), false)
})

test("planClosures: plans an open same-repo issue on a reachable merge commit", () => {
  const plan = planClosures({ event: mergedEvent(), refs: [5], issueStates: { 5: "open" }, mergeCommitReachable: true })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].issue, 5)
  assert.ok(plan[0].comment.includes("pull request #7"))
  assert.ok(plan[0].comment.includes("`bived`"))
  assert.ok(plan[0].comment.includes(MERGE_SHA))
  assert.ok(plan[0].comment.includes(`<!-- bive-close-issues pr=7 sha=${MERGE_SHA} -->`))
  assert.ok(plan[0].comment.includes("— bive-close-issues workflow (GitHub Actions)"))
})

test("planClosures: an unreachable merge commit closes nothing", () => {
  const plan = planClosures({ event: mergedEvent(), refs: [5], issueStates: { 5: "open" }, mergeCommitReachable: false })
  assert.deepEqual(plan, [])
})

test("planClosures: an already-closed issue is skipped", () => {
  const plan = planClosures({ event: mergedEvent(), refs: [5], issueStates: { 5: "closed" }, mergeCommitReachable: true })
  assert.deepEqual(plan, [])
})

test("planClosures: a marker on a still-open issue closes it without a second comment; a closed one is untouched", () => {
  const plan = planClosures({
    event: mergedEvent(),
    refs: [5],
    issueStates: { 5: "open" },
    mergeCommitReachable: true,
    existingComments: { 5: `Looks done.\n\n<!-- bive-close-issues pr=7 sha=${MERGE_SHA} -->\n— bive-close-issues workflow (GitHub Actions)` },
  })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].issue, 5)
  assert.equal(plan[0].comment, null)
  const done = planClosures({ event: mergedEvent(), refs: [5], issueStates: { 5: "closed" }, mergeCommitReachable: true,
    existingComments: { 5: `<!-- bive-close-issues pr=7 sha=${MERGE_SHA} -->` } })
  assert.deepEqual(done, [])
})

test("planClosures: a number that is a pull request is never closed", () => {
  assert.deepEqual(planClosures({ event: mergedEvent(), refs: [5], issueStates: { 5: "pull_request" }, mergeCommitReachable: true }), [])
})

test("planClosures: a marker for a different PR or SHA does not skip", () => {
  const plan = planClosures({
    event: mergedEvent(),
    refs: [5],
    issueStates: { 5: "open" },
    mergeCommitReachable: true,
    existingComments: { 5: `<!-- bive-close-issues pr=8 sha=${MERGE_SHA} -->` },
  })
  assert.equal(plan.length, 1)
})

test("planClosures: an event without a usable PR number, base, or SHA plans nothing", () => {
  const noSha = mergedEvent()
  delete noSha.pull_request.merge_commit_sha
  assert.deepEqual(planClosures({ event: noSha, refs: [5], issueStates: { 5: "open" }, mergeCommitReachable: true }), [])
  assert.deepEqual(planClosures({ event: mergedEvent(), refs: [5], issueStates: { 5: "open" } }), [])
})

test("run: an injected gh call throwing (API timeout) yields an empty plan and no partial state", async () => {
  const calls = []
  const result = await run({
    event: mergedEvent(),
    repository: "me/repo",
    runGh: (args) => { calls.push(args.join(" ")); throw new Error("gh timed out") },
  })
  assert.deepEqual(result.closures, [])
  assert.deepEqual(result.applied, [])
  assert.ok(result.reason.includes("gh timed out"))
  // Nothing was applied: the first failure aborts before any comment or state change.
  assert.equal(calls.length, 1)
})

test("run: happy path with an injected gh runner plans and applies the closure", async () => {
  const calls = []
  const runGh = async (args, options = {}) => {
    const joined = args.join(" ")
    calls.push(options.input ? `${joined} <<comment` : joined)
    if (joined.includes("/compare/")) return { stdout: "behind\n" }
    if (joined.includes("/comments")) return { stdout: "an earlier unrelated comment\n" }
    if (joined.includes("/issues/")) return { stdout: "open\n" }
    if (joined.includes("issue comment")) return { stdout: "" }
    if (joined.includes("PATCH")) return { stdout: "" }
    throw new Error(`unexpected gh call: ${joined}`)
  }
  const result = await run({ event: mergedEvent(), repository: "me/repo", runGh })
  assert.deepEqual(result.applied, [5])
  assert.equal(result.closures.length, 1)
  // comment first, then close
  assert.ok(calls[3].startsWith("issue comment 5"))
  assert.ok(calls[4].includes("PATCH"))
})

test("run: dry run plans without applying", async () => {
  const calls = []
  const runGh = async (args) => {
    const joined = args.join(" ")
    calls.push(joined)
    if (joined.includes("/compare/")) return { stdout: "identical" }
    if (joined.includes("/comments")) return { stdout: "" }
    if (joined.includes("/issues/")) return { stdout: "open" }
    throw new Error(`unexpected gh call: ${joined}`)
  }
  const result = await run({ event: mergedEvent(), repository: "me/repo", runGh, dryRun: true })
  assert.equal(result.closures.length, 1)
  assert.deepEqual(result.applied, [])
  assert.equal(calls.length, 3)
})

test("run: unreachable merge commit plans nothing", async () => {
  const runGh = async (args) => {
    const joined = args.join(" ")
    if (joined.includes("/compare/")) return { stdout: "diverged" }
    throw new Error(`unexpected gh call: ${joined}`)
  }
  const result = await run({ event: mergedEvent(), repository: "me/repo", runGh })
  assert.deepEqual(result.closures, [])
  assert.deepEqual(result.applied, [])
})

test("run: events it does not handle are ignored", async () => {
  let called = false
  const result = await run({ event: { action: "opened", pull_request: {} }, repository: "me/repo", runGh: async () => { called = true } })
  assert.deepEqual(result.closures, [])
  assert.equal(called, false)
})
test("the close-issues workflow is merged-only, integration-only, least-privilege and never runs head code", async () => {
  const fs = await import("node:fs")
  const w = fs.readFileSync(new URL("../.github/workflows/bive-close-issues.yml", import.meta.url), "utf8")
  assert.match(w, /types: \[closed\]/)
  assert.match(w, /branches: \[bived, "milestone\/\*\*"\]/)
  assert.match(w, /merged == true/)
  assert.match(w, /issues: write/)
  assert.match(w, /contents: read/)
  assert.match(w, /timeout-minutes: 5/)
  assert.match(w, /runs-on: ubuntu-latest/)
  assert.match(w, /ref: \$\{\{ github\.event\.pull_request\.base\.ref \}\}/)
  assert.doesNotMatch(w, /head\.(ref|sha)/)
  assert.doesNotMatch(w, /pull_request_target|self-hosted/)
})
