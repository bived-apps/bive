export type PullRequest = {
  number: number
  state: "OPEN" | "CLOSED" | "MERGED"
  mergedAt: string | null
  url: string
  title: string
}

export type WaitResult = {
  status: "merged" | "closed" | "timed_out"
  pullRequest: PullRequest
}

export function parsePullRequest(text: string): PullRequest {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new Error("gh returned invalid JSON for the current pull request", { cause: error })
  }
  if (!value || typeof value !== "object") throw new Error("gh returned no pull request object")
  const pr = value as Record<string, unknown>
  if (!Number.isSafeInteger(pr.number) || (pr.number as number) < 1) throw new Error("gh returned an invalid pull request number")
  if (pr.state !== "OPEN" && pr.state !== "CLOSED" && pr.state !== "MERGED") {
    throw new Error("gh returned an invalid pull request state")
  }
  if (pr.mergedAt !== null && typeof pr.mergedAt !== "string") throw new Error("gh returned an invalid mergedAt value")
  if (typeof pr.url !== "string" || !pr.url.startsWith("https://github.com/jcherfils/bive/pull/")) {
    throw new Error("The current branch PR is not a pull request in jcherfils/bive")
  }
  if (typeof pr.title !== "string") throw new Error("gh returned an invalid pull request title")
  return {
    number: pr.number as number,
    state: pr.state,
    mergedAt: pr.mergedAt as string | null,
    url: pr.url,
    title: pr.title,
  }
}

export async function waitForMerge(
  read: () => Promise<PullRequest>,
  options: {
    pollIntervalMs: number
    maxWaitMs: number
    now?: () => number
    sleep?: (ms: number) => Promise<void>
  },
): Promise<WaitResult> {
  if (!Number.isFinite(options.pollIntervalMs) || options.pollIntervalMs <= 0) {
    throw new Error("pollIntervalMs must be a positive finite number")
  }
  if (!Number.isFinite(options.maxWaitMs) || options.maxWaitMs <= 0) {
    throw new Error("maxWaitMs must be a positive finite number")
  }
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const deadline = now() + options.maxWaitMs

  while (true) {
    const pullRequest = await read()
    if (pullRequest.state === "MERGED" || pullRequest.mergedAt) return { status: "merged", pullRequest }
    if (pullRequest.state === "CLOSED") return { status: "closed", pullRequest }

    const remaining = deadline - now()
    if (remaining <= 0) return { status: "timed_out", pullRequest }
    await sleep(Math.min(options.pollIntervalMs, remaining))
  }
}
