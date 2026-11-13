import { test } from "node:test"
import assert from "node:assert/strict"
import {
  buildWaitRequest,
  isSessionDone,
  readBranch,
  needsFallback,
  nextModel,
  planFallback,
} from "../lib/delegate-run.ts"

test("buildWaitRequest builds the wait path and rejects a bad id", () => {
  assert.deepEqual(buildWaitRequest("ses_1"), { method: "POST", path: "/api/experimental/session/ses_1/wait" })
  assert.throws(() => buildWaitRequest("abc"), /ses/)
})

test("isSessionDone reads the three payload shapes", () => {
  const type = "session.execution.succeeded"
  assert.equal(isSessionDone({ type, sessionID: "ses_1" }, "ses_1"), true)
  assert.equal(isSessionDone({ type, properties: { sessionID: "ses_1" } }, "ses_1"), true)
  assert.equal(isSessionDone({ type, data: { sessionID: "ses_1" } }, "ses_1"), true)
})

test("isSessionDone is false for other sessions, types and odd input", () => {
  const type = "session.execution.succeeded"
  assert.equal(isSessionDone({ type, sessionID: "ses_2" }, "ses_1"), false)
  assert.equal(isSessionDone({ type: "session.execution.failed", sessionID: "ses_1" }, "ses_1"), false)
  assert.equal(isSessionDone(null, "ses_1"), false)
  assert.equal(isSessionDone("session.execution.succeeded", "ses_1"), false)
  assert.equal(isSessionDone({ type }, "ses_1"), false)
  assert.equal(isSessionDone({ type, properties: null }, "ses_1"), false)
})

test("readBranch reads commits and the report", async () => {
  const calls: string[][] = []
  const git = async (args: string[]) => {
    calls.push(args)
    if (args[0] === "ls-remote") return "abc\trefs/heads/issue/190-x\n"
    if (args[1] === "-1") return "Closes #190\n\nreport body\n"
    return "s1\x1fann\x1ffirst\ns2\x1fbob\x1fsecond: with colon\n"
  }
  const r = await readBranch({ branch: "issue/190-x", base: "bived", git })
  assert.equal(r.pushed, true)
  assert.deepEqual(r.commits, [
    { sha: "s1", author: "ann", subject: "first" },
    { sha: "s2", author: "bob", subject: "second: with colon" },
  ])
  assert.equal(r.report, "Closes #190\n\nreport body")
  assert.deepEqual(calls[1], ["log", "--format=%H%x1f%an%x1f%s", "origin/bived..origin/issue/190-x"])
})

test("readBranch has no report when the body does not start with Closes or Part of", async () => {
  const git = async (args: string[]) => {
    if (args[0] === "ls-remote") return "abc\trefs/heads/b\n"
    if (args[1] === "-1") return "just a message\n"
    return "s1\x1fann\x1ffirst\n"
  }
  const r = await readBranch({ branch: "b", base: "bived", git })
  assert.equal(r.pushed, true)
  assert.equal(r.report, undefined)
})

test("readBranch: not pushed calls nothing else", async () => {
  const calls: string[][] = []
  const git = async (args: string[]) => {
    calls.push(args)
    return ""
  }
  const r = await readBranch({ branch: "b", base: "bived", git })
  assert.deepEqual(r, { pushed: false, commits: [], report: undefined })
  assert.equal(calls.length, 1)
})

test("readBranch names the failing git command", async () => {
  const git = async (_args: string[]) => {
    throw new Error("network down")
  }
  await assert.rejects(readBranch({ branch: "b", base: "bived", git }), /git ls-remote --heads origin b failed: network down/)
})

test("needsFallback", () => {
  assert.equal(
    needsFallback({
      text: "Free usage limit reached. Connect a provider or subscribe to OpenCode Go to keep going, or switch models.",
    }),
    true,
  )
  assert.equal(needsFallback({ text: "Your credit balance is too low to access the Anthropic API." }), true)
  assert.equal(needsFallback({ status: 429 }), true)
  assert.equal(needsFallback({ status: 402 }), true)
  assert.equal(needsFallback({ status: 503 }), true)
  assert.equal(needsFallback({ text: "TypeError: x is not a function", status: 500 }), false)
  assert.equal(needsFallback({}), false)
})

test("nextModel skips failed models", () => {
  assert.equal(nextModel(["a/1", "b/2", "c/3"], ["a/1"]), "b/2")
  assert.equal(nextModel(["a/1"], ["a/1"]), undefined)
})

test("planFallback picks the next model, resolves the alias, keeps the canonical identity", () => {
  const p = planFallback({
    models: ["a/1", "b/2"],
    failed: ["a/1"],
    aliases: { "b/2": "route/b-2" },
    worktree: "/tmp/wt",
    issue: 190,
    committed: ["add lib", "add tests"],
    left: "run the checks",
  })
  assert.ok(p)
  assert.equal(p.canonical, "b/2")
  assert.equal(p.resolved, "route/b-2")
  assert.deepEqual(p.identity, { name: "delegate b/2", email: "delegate@bive.invalid" })
  assert.deepEqual(p.create.body.model, { providerID: "route", id: "b-2" })
  assert.deepEqual(p.create.body.location, { directory: "/tmp/wt" })
  assert.ok(p.resume.split("\n").length <= 6)
  for (const s of ["b/2", "#190", "add lib", "add tests", "run the checks", "as it is"]) {
    assert.ok(p.resume.includes(s), s)
  }
})

test("planFallback: none left gives undefined; nothing committed is said", () => {
  const base = { aliases: {}, worktree: "/tmp/wt", issue: 1, committed: [], left: "all" }
  assert.equal(planFallback({ ...base, models: ["a/1"], failed: ["a/1"] }), undefined)
  const p = planFallback({ ...base, models: ["a/1"], failed: [] })
  assert.ok(p?.resume.includes("Nothing committed"))
})
