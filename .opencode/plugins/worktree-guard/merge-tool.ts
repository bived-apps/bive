// Narrow execution path; never relaxes the shell policy or creates owner authorization.
import { execFile } from "node:child_process"
import path from "node:path"
import { createGhReaders, runMergeGate } from "../../../.github/scripts/check-merge-gate.mjs"
import { AUTHORIZATION_LABEL_PREFIX, parseGateOwner } from "../../../.github/scripts/merge-gate-lib.mjs"
import { isAdvisor, isDelegate } from "./check.ts"
import { runCoordinatorMerge, type MergeRequest, type MergeScope, type MergeSnapshot } from "./coordinator-merge.ts"

const TIMEOUT = 15_000
const unwrap = (value: any) => value && typeof value === "object" && "data" in value ? value.data : value
function processOutput(command: string, args: string[], cwd: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, signal, timeout: TIMEOUT, maxBuffer: 2 * 1024 * 1024, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${command} failed: ${(stderr || error.message).trim()}`, { cause: error }))
        else resolve(stdout.trim())
      })
  })
}

// Uses the documented OpenCode 2 tool/permission APIs; ctx's runtime is supplied by OpenCode.
export async function registerCoordinatorMerge(ctx: any, root: string, role?: string, roleFile?: string,
  execute = processOutput): Promise<void> {
  // Saved approvals and inherited "allow" never replace the human's one-call decision. Explicit denies remain final.
  await ctx.permission.hook("evaluate", (event: any) => {
    if (event.action === "bive.coordinator.merge") {
      event.effect = "ask"
      event.message = "Human owner only: one named sub-coordinator PR, exact head/base/session, expires in two minutes. No standing merge right."
    }
  })
  await ctx.tool.transform((editor: any) => {
    editor.add({
      name: "bive_coordinator_merge",
      description: "Owner opt-in only: merge one direct sub-coordinator PR after a fresh, exact-scope human permission prompt. Default off on the base.",
      input: {
        type: "object", additionalProperties: false,
        properties: { number: { type: "integer", minimum: 1 }, childSession: { type: "string", minLength: 1 } },
        required: ["number", "childSession"],
      },
      execute: async (input: MergeRequest, context: any) => {
        if (context.agent !== "coordinator" || isAdvisor(role, roleFile, context.agent)
            || isDelegate(root, role, roleFile, context.agent)) {
          throw new Error("coordinator merge refused: only a coordinator may request owner opt-in")
        }
        const run = (command: string, args: string[], cwd = root) => execute(command, args, cwd, context.signal)
        const repository = await run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("invalid repository identity")
        const readers = createGhReaders(async (args: string[]) => ({ stdout: await run("gh", args), exitCode: 0 }))
        const read = async (): Promise<MergeSnapshot> => {
          const pr = JSON.parse(await run("gh", ["pr", "view", String(input.number), "--repo", repository,
            "--json", "number,state,headRefOid,baseRefName,headRefName,headRepository,headRepositoryOwner,isCrossRepository,commits"]))
          const configText = await readers.readGateConfig({ repository, ref: pr.baseRefName })
          const config = configText === null ? null : JSON.parse(configText)
          const owner = parseGateOwner(configText)
          // Opt-in requires an explicitly named human owner even in a personally owned repository.
          if (config?.coordinatorMerges !== true || !owner) throw new Error("coordinator merge refused: base owner opt-in is off or invalid")
          const executor = unwrap(await ctx.session.get({ sessionID: context.sessionID }))
          const child = unwrap(await ctx.session.get({ sessionID: input.childSession }))
          const childDirectory = child?.location?.directory
          if (typeof childDirectory !== "string" || !path.isAbsolute(childDirectory)) throw new Error("sub-coordinator directory unavailable")
          // Verify the actual server-assigned child, not a role/session string supplied in PR text.
          if (executor?.agent !== "coordinator" || executor?.location?.directory !== root || child?.agent !== "coordinator"
              || child?.parentID !== context.sessionID) throw new Error("not a direct sub-coordinator session")
          const branch = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"], childDirectory)
          const childHead = await run("git", ["rev-parse", "HEAD"], childDirectory)
          const currentBranch = await run("git", ["rev-parse", "--abbrev-ref", "HEAD"])
          const authorName = await run("git", ["config", "--get", "user.name"])
          if (!authorName.startsWith("coordinator ") || !authorName.includes(`[session=${context.sessionID}]`)) {
            throw new Error("coordinator merge refused: executor needs its session-bound coordinator Git identity")
          }
          const authors = Array.isArray(pr.commits) ? pr.commits.flatMap((c: any) => Array.isArray(c.authors) ? c.authors : []) : []
          const selfAuthored = currentBranch === pr.headRefName || authors.length === 0
            || authors.some((a: any) => typeof a.name !== "string" || a.name === authorName
              || a.name.includes(`[session=${context.sessionID}]`)
              || (a.name.startsWith("coordinator ") && !/\[session=ses_[A-Za-z0-9]+\]$/.test(a.name)))
          const gatePr = await readers.readPullRequest({ repository, number: input.number })
          const labels = gatePr.labels.filter((label: string) => label.startsWith(AUTHORIZATION_LABEL_PREFIX))
          if (labels.length !== 1) throw new Error("current owner authorization missing")
          const events = await readers.readLabelEvents({ repository, number: input.number, label: labels[0] })
          const latest = events.sort((a: any, b: any) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
          if (!latest || latest.actor !== owner || latest.actorType !== "User" || latest.performedViaApp) {
            throw new Error("authorization provenance is not the configured human owner")
          }
          await runMergeGate({
            repository, ...readers,
            event: { pull_request: { number: input.number, head: { sha: pr.headRefOid }, base: { ref: pr.baseRefName } } },
          })
          return {
            repository, number: pr.number, state: pr.state, head: pr.headRefOid, base: pr.baseRefName,
            headBranch: pr.headRefName, sameRepository: pr.isCrossRepository === false
              && `${pr.headRepositoryOwner?.login}/${pr.headRepository?.name}`.toLowerCase() === repository.toLowerCase(),
            coordinatorPR: gatePr.labels.includes("coordinator"),
            enabled: true, owner, checks: await readers.readChecks({ repository, number: input.number }),
            authorizationValid: true, selfAuthored,
            executor: { id: executor.id, agent: executor.agent },
            child: { id: child.id, agent: child.agent, parentID: child.parentID, branch, head: childHead },
          }
        }
        const result = await runCoordinatorMerge(input, context.sessionID, {
          read,
          approve: async (scope: MergeScope, owner: string) => {
            await ctx.permission.assert({
              sessionID: context.sessionID, agent: context.agent,
              source: { type: "tool", messageID: context.messageID, id: context.id },
              action: "bive.coordinator.merge", resources: [JSON.stringify(scope)], save: [],
              metadata: { owner, scope, warning: "One-call owner opt-in, not supervisory authority. Reject if you are not the owner." },
            })
          },
          merge: (scope: MergeScope) => run("gh", ["pr", "merge", String(scope.number), "--repo", scope.repository,
            "--merge", "--match-head-commit", scope.head]),
        })
        return { content: result || "Owner-opted-in sub-coordinator merge completed." }
      },
    })
  })
}
