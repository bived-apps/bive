import { test } from "node:test"
import assert from "node:assert/strict"
import { once } from "node:events"
import { readFileSync } from "node:fs"
import { spawn, spawnSync } from "node:child_process"
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

// --- Issue #226: the wait-recipe documented in docs/COORDINATING.md ---

const waitRecipe = readFileSync(new URL("../docs/COORDINATING.md", import.meta.url), "utf8").match(
  /```bash\n(# wait-recipe[\s\S]*?)```/,
  )?.[1]

test("the wait-recipe block exists, avoids pattern kills, and sh -n accepts it", () => {
  assert.ok(waitRecipe, "docs/COORDINATING.md has no fenced bash block starting with '# wait-recipe'")
  const code = waitRecipe.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n")
  // command lines only: the echo lines quote the recipe's own advice, not commands
  const commands = code
    .split("\n")
    .filter((l) => {
      const t = l.trim()
      return t && !t.startsWith("echo")
    })
    .join("\n")
  assert.doesNotMatch(commands, /pkill|killall/)
  assert.doesNotMatch(commands.replace(/kill -0/g, ""), /kill/, "only the harmless signal-0 kill is allowed")
  const r = spawnSync("sh", ["-n", "-c", waitRecipe])
  assert.equal(r.status, 0, `sh -n rejected the wait-recipe: ${r.stderr}`)
})

test("the wait-recipe reports a successful child with exit 0", () => {
  const r = spawnSync("sh", ["-c", waitRecipe], { env: { ...process.env, DEADLINE: "5", POLL: "1", LAUNCH: "true" } })
  assert.equal(r.status, 0, `the recipe failed: ${r.stderr}`)
  assert.match(r.stdout.toString(), /pid \d+: exit 0 \(success: read its report, then review it\)/)
})

test("the wait-recipe reports a failing child with its non-zero exit code", () => {
  const r = spawnSync("sh", ["-c", waitRecipe], { env: { ...process.env, DEADLINE: "5", POLL: "1", LAUNCH: "false" } })
  assert.equal(r.status, 0, `the recipe failed: ${r.stderr}`)
  assert.match(r.stdout.toString(), /pid \d+: exit 1 \(delegate failure: record it, apply Refusal and resume \/ gate 2\)/)
})

test("the wait-recipe waits on several PIDs, own children and foreign ones", async () => {
  // The foreign children are started by a wrapper shell that exits at once, so the system reaps
  // them and no PID stays a zombie (a zombie would keep answering kill -0 until the deadline).
  const foreign = [0, 1].map(() => Number(spawnSync("sh", ["-c", "sleep 0.3 & echo $!"]).stdout.toString().trim()))
  const waitGone = async (pid: number) => {
    for (let i = 0; i < 100; i++) {
      try {
        process.kill(pid, 0)
      } catch {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    assert.fail(`pid ${pid} still running 5 s after its wrapper exited`)
  }
  for (const pid of foreign) await waitGone(pid)
  const r = spawnSync("sh", ["-c", waitRecipe], {
    env: { ...process.env, DEADLINE: "10", POLL: "1", PIDS: foreign.join(" "), LAUNCH: "true false" },
  })
  assert.equal(r.status, 0, `the recipe failed: ${r.stderr}`)
  const out = r.stdout.toString()
  for (const pid of foreign) assert.match(out, new RegExp(`pid ${pid}: finished`))
  assert.match(out, /pid \d+: exit 0 \(success/)
  assert.match(out, /pid \d+: exit 1 \(delegate failure/)
})

test("the wait-recipe times out at the deadline and leaves the child running", async () => {
  const child = spawn("sleep", ["5"])
  try {
    assert.ok(child.pid)
    const r = spawnSync("sh", ["-c", waitRecipe], {
      env: { ...process.env, DEADLINE: "1", POLL: "1", PIDS: String(child.pid) },
    })
    assert.equal(r.status, 0, `the recipe failed: ${r.stderr}`)
    const out = r.stdout.toString()
    assert.match(out, new RegExp(`pid ${child.pid}: timed out after 1s`))
    assert.match(out, /still running at the deadline/)
    // the recipe never kills: only this test targets the recorded PID, after checking it is alive
    process.kill(child.pid, 0)
    process.kill(child.pid, "SIGTERM")
    const [code, signal] = await once(child, "exit")
    assert.equal(code, null)
    assert.equal(signal, "SIGTERM")
  } finally {
    try {
      process.kill(child.pid, "SIGTERM")
    } catch {
      // already exited: nothing to clean up
    }
  }
})
