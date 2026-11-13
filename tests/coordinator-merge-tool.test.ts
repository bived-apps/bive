import assert from "node:assert/strict"
import test from "node:test"
import { registerCoordinatorMerge } from "../.opencode/plugins/worktree-guard/merge-tool.ts"

const PARENT = "ses_parent"
const CHILD = "ses_child"
const ROOT = "/repo/root"
const CHILD_DIR = "/repo/child"
const SHA = "a".repeat(40)
const OTHER_SHA = "b".repeat(40)

function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}

function createEnv(overrides: any = {}) {
  const today = todayUtc()
  const authLabel = `bive-merge-authorized-until-${today}`
  const S: any = {
    root: ROOT,
    childDir: CHILD_DIR,
    parentSession: PARENT,
    childSession: CHILD,
    today,
    sha: SHA,
    repository: "owner/repo",
    gateConfig: { owner: "human", coordinatorMerges: true, skippable: [] },
    pr: {
      number: 123,
      state: "OPEN",
      headRefOid: SHA,
      baseRefName: "bived",
      headRefName: "issue/264-test",
      headRepository: { name: "repo" },
      headRepositoryOwner: { login: "owner" },
      isCrossRepository: false,
      commits: [{ authors: [{ name: "coordinator model [session=ses_child]" }] }],
    },
    childBranch: "issue/264-test",
    childHead: SHA,
    rootBranch: "main",
    authorName: "coordinator model [session=ses_parent]",
    executorAgent: "coordinator",
    executorDir: ROOT,
    childAgent: "coordinator",
    childParentID: PARENT,
    gatePr: {
      baseRefName: "bived",
      headRefOid: SHA,
      labels: ["coordinator", authLabel],
    },
    checks: [
      { workflow: "bive-tests", name: "tests", bucket: "pass", state: "SUCCESS" },
      { workflow: "bive-inviolable", name: "check", bucket: "pass", state: "SUCCESS" },
      { workflow: "bive-merge-gate", name: "merge-gate", bucket: "pass", state: "SUCCESS" },
    ],
    labelEvents: [
      {
        event: "labeled",
        label: { name: authLabel },
        actor: { login: "human", type: "User" },
        performed_via_github_app: null,
        created_at: `${today}T12:00:00.000Z`,
      },
    ],
    permissionDeny: false,
    mutateOnApprove: null,
    mergeCalls: [] as any[],
    ...overrides,
  }

  const execute = async (command: string, args: string[], cwd?: string, signal?: any) => {
    if (command === "gh") {
      if (args[0] === "repo" && args[1] === "view") return S.repository
      if (args[0] === "pr" && args[1] === "view") {
        if (args.includes("baseRefName,headRefOid,labels")) {
          return JSON.stringify({
            baseRefName: S.gatePr.baseRefName,
            headRefOid: S.gatePr.headRefOid,
            labels: S.gatePr.labels.map((n: string) => ({ name: n })),
          })
        }
        return JSON.stringify(S.pr)
      }
      if (args[0] === "pr" && args[1] === "checks") {
        return JSON.stringify(S.checks)
      }
      if (args[0] === "pr" && args[1] === "merge") {
        S.mergeCalls.push({ command, args: [...args], cwd })
        return "Merged #123"
      }
      if (args[0] === "api") {
        const p = args[1]
        if (p.includes("/contents/.bive/gate.json")) {
          if (S.gateConfig === null) throw new Error("not found")
          if (typeof S.gateConfig === "string") return S.gateConfig
          return Buffer.from(JSON.stringify(S.gateConfig)).toString("base64")
        }
        if (p.includes("/events")) {
          return JSON.stringify(S.labelEvents)
        }
        return "owner"
      }
      throw new Error(`unknown gh args: ${args.join(" ")}`)
    }
    if (command === "git") {
      if (args[0] === "rev-parse") {
        if (args[1] === "--abbrev-ref" && args[2] === "HEAD") {
          return cwd === S.childDir ? S.childBranch : S.rootBranch
        }
        if (args[1] === "HEAD") {
          return cwd === S.childDir ? S.childHead : S.sha
        }
      }
      if (args[0] === "config" && args[1] === "--get" && args[2] === "user.name") {
        return S.authorName
      }
      throw new Error(`unknown git args: ${args.join(" ")}`)
    }
    throw new Error(`unknown command: ${command}`)
  }

  const captured: any = {
    permissionHook: null,
    permissionHookName: null,
    tool: null,
    permissionAssert: null,
    permissionAssertCalls: 0,
  }
  const ctx: any = {
    permission: {
      hook: async (name: string, cb: any) => {
        captured.permissionHookName = name
        captured.permissionHook = cb
      },
      assert: async (payload: any) => {
        captured.permissionAssert = payload
        captured.permissionAssertCalls++
        if (typeof S.mutateOnApprove === "function") S.mutateOnApprove(S)
        if (S.permissionDeny) throw new Error("permission denied by owner")
      },
    },
    tool: {
      transform: async (cb: any) => {
        const editor = { add: (t: any) => { captured.tool = t } }
        cb(editor)
      },
    },
    session: {
      get: async ({ sessionID }: any) => {
        if (sessionID === S.parentSession) {
          return { data: { id: S.parentSession, agent: S.executorAgent, location: { directory: S.executorDir } } }
        }
        if (sessionID === S.childSession) {
          return { data: { id: S.childSession, agent: S.childAgent, parentID: S.childParentID, location: { directory: S.childDir } } }
        }
        return { data: null }
      },
    },
  }

  return { S, root: ROOT, childDir: CHILD_DIR, parentSession: PARENT, childSession: CHILD, today, sha: SHA, execute, ctx, captured }
}

async function register(env: any, role = "coordinator", roleFile?: string) {
  await registerCoordinatorMerge(env.ctx, env.root, role, roleFile, env.execute)
  if (!env.captured.tool) throw new Error("tool was not registered")
  return env.captured.tool
}

function contextFor(env: any, agent = "coordinator") {
  return { agent, sessionID: env.parentSession, messageID: "msg", id: "toolcall", signal: undefined }
}

test("permission hook forces ask and records evaluate hook", async () => {
  const env = createEnv()
  await register(env)
  assert.equal(env.captured.permissionHookName, "evaluate")
  assert.equal(typeof env.captured.permissionHook, "function")
  const ev = { action: "bive.coordinator.merge", effect: "allow" }
  env.captured.permissionHook(ev)
  assert.equal(ev.effect, "ask")
  assert.equal(ev.message, "Human owner only: one named sub-coordinator PR, exact head/base/session, expires in two minutes. No standing merge right.")
  const other = { action: "other", effect: "allow" }
  env.captured.permissionHook(other)
  assert.equal(other.effect, "allow")
})

test("success: merges pinned head after two reads and owner permission", async () => {
  const env = createEnv()
  const tool = await register(env)
  const callsBefore = env.S.mergeCalls.length
  const res = await tool.execute({ number: 123, childSession: CHILD }, contextFor(env))
  assert.deepEqual(res, { content: "Merged #123" })
  assert.equal(env.captured.permissionAssertCalls, 1)
  assert.equal(env.S.mergeCalls.length - callsBefore, 1)
  const mergeCall = env.S.mergeCalls[env.S.mergeCalls.length - 1]
  assert.equal(mergeCall.command, "gh")
  assert.deepEqual(mergeCall.args, ["pr", "merge", "123", "--repo", "owner/repo", "--merge", "--match-head-commit", SHA])
  assert.equal(mergeCall.cwd, ROOT)

  const assertPayload = env.captured.permissionAssert
  assert.equal(assertPayload.sessionID, PARENT)
  assert.equal(assertPayload.agent, "coordinator")
  assert.deepEqual(assertPayload.source, { type: "tool", messageID: "msg", id: "toolcall" })
  assert.equal(assertPayload.action, "bive.coordinator.merge")
  assert.deepEqual(assertPayload.save, [])
  assert.equal(assertPayload.metadata.owner, "human")
  const scope = JSON.parse(assertPayload.resources[0])
  assert.deepEqual(scope, {
    repository: "owner/repo",
    number: 123,
    head: SHA,
    base: "bived",
    executor: PARENT,
    childSession: CHILD,
    expiresAt: scope.expiresAt,
  })
  assert.equal(typeof scope.expiresAt, "number")
  assert.equal(assertPayload.metadata.warning, "One-call owner opt-in, not supervisory authority. Reject if you are not the owner.")
  assert.deepEqual(assertPayload.metadata.scope, scope)
})

test("denies advisor role", async () => {
  const env = createEnv()
  const tool = await register(env, "advisor")
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /only a coordinator may request owner opt-in/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies legacy supervisor role", async () => {
  const env = createEnv()
  const tool = await register(env, "supervisor")
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /only a coordinator may request owner opt-in/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies delegate role", async () => {
  const env = createEnv()
  const tool = await register(env, "delegate")
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /only a coordinator may request owner opt-in/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies non-coordinator agent", async () => {
  const env = createEnv()
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env, "build")), /only a coordinator may request owner opt-in/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies when opt-in is false", async () => {
  const env = createEnv({ gateConfig: { owner: "human", coordinatorMerges: false } })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /base owner opt-in is off or invalid/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies when opt-in is missing", async () => {
  const env = createEnv({ gateConfig: { owner: "human" } })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /base owner opt-in is off or invalid/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies when opt-in config is corrupt", async () => {
  const env = createEnv({ gateConfig: "{bad json" })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)))
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies when human owner is missing", async () => {
  const env = createEnv({ gateConfig: { coordinatorMerges: true } })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /base owner opt-in is off or invalid/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies wrong executor location", async () => {
  const env = createEnv({ executorDir: "/elsewhere" })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /not a direct sub-coordinator session/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies wrong executor role/agent", async () => {
  const env = createEnv({ executorAgent: "delegate" })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /not a direct sub-coordinator session/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies wrong child parent", async () => {
  const env = createEnv({ childParentID: "someone-else" })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /not a direct sub-coordinator session/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies wrong child agent", async () => {
  const env = createEnv({ childAgent: "delegate" })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /not a direct sub-coordinator session/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies wrong child branch", async () => {
  const env = createEnv({ childBranch: "other-branch" })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /sub-coordinator branch or head changed/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies wrong child head", async () => {
  const env = createEnv({ childHead: OTHER_SHA })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /sub-coordinator branch or head changed/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies same own branch (self-authored)", async () => {
  const env = createEnv({ rootBranch: "issue/264-test" })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /executor authored work in this PR, or authorship is unknown/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies self-authored commit", async () => {
  const env = createEnv()
  env.S.pr.commits = [{ authors: [{ name: "coordinator model [session=ses_parent]" }] }]
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /executor authored work in this PR, or authorship is unknown/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies unknown authorship (no commits)", async () => {
  const env = createEnv()
  env.S.pr.commits = []
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /executor authored work in this PR, or authorship is unknown/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies ambiguous old coordinator author", async () => {
  const env = createEnv()
  env.S.pr.commits = [{ authors: [{ name: "coordinator legacy" }] }]
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /executor authored work in this PR, or authorship is unknown/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies wrong owner actor in label event", async () => {
  const env = createEnv()
  env.S.labelEvents = [
    {
      event: "labeled",
      label: { name: `bive-merge-authorized-until-${env.S.today}` },
      actor: { login: "someone-else", type: "User" },
      performed_via_github_app: null,
      created_at: `${env.S.today}T12:00:00.000Z`,
    },
  ]
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /authorization provenance is not the configured human owner|current owner authorization/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies bot actor in label event", async () => {
  const env = createEnv()
  env.S.labelEvents = [
    {
      event: "labeled",
      label: { name: `bive-merge-authorized-until-${env.S.today}` },
      actor: { login: "human", type: "Bot" },
      performed_via_github_app: null,
      created_at: `${env.S.today}T12:00:00.000Z`,
    },
  ]
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)))
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies app-performed label event", async () => {
  const env = createEnv()
  env.S.labelEvents = [
    {
      event: "labeled",
      label: { name: `bive-merge-authorized-until-${env.S.today}` },
      actor: { login: "human", type: "User" },
      performed_via_github_app: true,
      created_at: `${env.S.today}T12:00:00.000Z`,
    },
  ]
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)))
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies missing authorization label", async () => {
  const env = createEnv()
  env.S.gatePr.labels = ["coordinator"]
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /current owner authorization missing/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies pending checks", async () => {
  const env = createEnv()
  env.S.checks = [
    { workflow: "bive-tests", name: "tests", bucket: "pending", state: "IN_PROGRESS" },
    { workflow: "bive-inviolable", name: "check", bucket: "pass", state: "SUCCESS" },
    { workflow: "bive-merge-gate", name: "merge-gate", bucket: "pass", state: "SUCCESS" },
  ]
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)))
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies red checks", async () => {
  const env = createEnv()
  env.S.checks = [
    { workflow: "bive-tests", name: "tests", bucket: "fail", state: "FAILURE" },
    { workflow: "bive-inviolable", name: "check", bucket: "pass", state: "SUCCESS" },
    { workflow: "bive-merge-gate", name: "merge-gate", bucket: "pass", state: "SUCCESS" },
  ]
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)))
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies missing required checks", async () => {
  const env = createEnv()
  env.S.checks = [
    { workflow: "bive-inviolable", name: "check", bucket: "pass", state: "SUCCESS" },
    { workflow: "bive-merge-gate", name: "merge-gate", bucket: "pass", state: "SUCCESS" },
  ]
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)))
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies when owner rejects permission prompt", async () => {
  const env = createEnv({ permissionDeny: true })
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /permission denied by owner/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies when head changes during approval", async () => {
  const env = createEnv()
  env.S.mutateOnApprove = (S: any) => {
    S.pr.headRefOid = OTHER_SHA
    S.gatePr.headRefOid = OTHER_SHA
  }
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /scope changed or one-call grant expired|head changed/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies when base changes during approval", async () => {
  const env = createEnv()
  env.S.mutateOnApprove = (S: any) => {
    S.pr.baseRefName = "milestone/0.2"
    S.gatePr.baseRefName = "milestone/0.2"
  }
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /scope changed or one-call grant expired|base changed/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("denies when opt-in disabled during approval", async () => {
  const env = createEnv()
  env.S.mutateOnApprove = (S: any) => {
    S.gateConfig = { owner: "human", coordinatorMerges: false }
  }
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /base owner opt-in is off or invalid|scope changed/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("cross-repository PR is denied", async () => {
  const env = createEnv()
  env.S.pr.isCrossRepository = true
  env.S.pr.headRepositoryOwner = { login: "other" }
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /not an open same-repository head/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("closed PR is denied", async () => {
  const env = createEnv()
  env.S.pr.state = "CLOSED"
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /not an open same-repository head/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("non-coordinator labelled PR is denied", async () => {
  const env = createEnv()
  env.S.gatePr.labels = ["coordinator".replace("coordinator", "other"), `bive-merge-authorized-until-${env.S.today}`]
  // ensure no coordinator label
  env.S.gatePr.labels = [`bive-merge-authorized-until-${env.S.today}`]
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /PR is not labelled coordinator/)
  assert.equal(env.S.mergeCalls.length, 0)
})

test("unsupported base is denied", async () => {
  const env = createEnv()
  env.S.pr.baseRefName = "main"
  env.S.gatePr.baseRefName = "main"
  const tool = await register(env)
  await assert.rejects(tool.execute({ number: 123, childSession: CHILD }, contextFor(env)), /merge gate only runs for pull requests targeting bived or milestone/)
  assert.equal(env.S.mergeCalls.length, 0)
})
