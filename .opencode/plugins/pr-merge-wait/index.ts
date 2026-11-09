import { Plugin } from "@opencode/plugin"
import { execFile } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { isDelegate } from "../worktree-guard/check.ts"
import { parsePullRequest, waitForMerge } from "./lib.ts"

const POLL_INTERVAL_MS = 30_000
const MAX_WAIT_MS = 8 * 60 * 60 * 1000
const GH_TIMEOUT_MS = 15_000
const watching = new Set<string>()

function roleFile(root: string): string | undefined {
  try {
    return readFileSync(path.join(root, ".bive", "state", "role"), "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw new Error("Cannot determine the Bive session role; refusing to register /wait-for-merge", { cause: error })
  }
}

function gh(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("gh", args, { cwd, timeout: GH_TIMEOUT_MS, maxBuffer: 64 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`gh ${args.join(" ")} failed: ${(stderr || error.message).trim()}`, { cause: error }))
        return
      }
      resolve(stdout)
    })
  })
}

export default Plugin.define({
  id: "bive.pr-merge-wait",
  async setup(ctx) {
    const root = path.resolve(ctx.location.directory)
    if (isDelegate(root, process.env.BIVE_ROLE, roleFile(root))) return

    await ctx.command.transform((editor) => {
      editor.add({
        name: "wait-for-merge",
        description: "Wait for this Bive branch's PR to merge, then resume this session",
        execute: async ({ sessionID, prompt, delivery }) => {
          if (watching.has(sessionID)) throw new Error("This session is already waiting for a pull request merge")
          watching.add(sessionID)
          try {
            const directory = root
            const repository = JSON.parse(await gh(["repo", "view", "--json", "nameWithOwner"], directory)) as {
              nameWithOwner?: unknown
            }
            if (repository.nameWithOwner !== "jcherfils/bive") {
              throw new Error("/wait-for-merge is available only in the jcherfils/bive repository")
            }

            const raw = await gh(["pr", "view", "--json", "number,state,mergedAt,url,title"], directory)
            const currentPullRequest = parsePullRequest(raw)
            const result = await waitForMerge(
              async () => {
                const pr = parsePullRequest(await gh([
                  "pr", "view", String(currentPullRequest.number), "--repo", "jcherfils/bive",
                  "--json", "number,state,mergedAt,url,title",
                ], directory))
                if (pr.number !== currentPullRequest.number) throw new Error("gh returned a different pull request while waiting")
                return pr
              },
              { pollIntervalMs: POLL_INTERVAL_MS, maxWaitMs: MAX_WAIT_MS },
            )
            const outcome = result.status === "merged"
              ? `PR #${result.pullRequest.number} was merged: ${result.pullRequest.url}`
              : result.status === "closed"
                ? `PR #${result.pullRequest.number} was closed without merging: ${result.pullRequest.url}`
                : `Stopped waiting after eight hours; PR #${result.pullRequest.number} is still open: ${result.pullRequest.url}`
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              text: [prompt.text, outcome, "Continue the coordinator's pending work only if the PR was merged."].filter(Boolean).join("\n\n"),
              delivery,
            })
          } finally {
            watching.delete(sessionID)
          }
        },
      })
    })
  },
})
