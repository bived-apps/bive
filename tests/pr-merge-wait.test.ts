import assert from "node:assert/strict"
import test from "node:test"
import { parsePullRequest, waitForMerge, type PullRequest } from "../.opencode/plugins/pr-merge-wait/lib.ts"

const open: PullRequest = {
  number: 58,
  state: "OPEN",
  mergedAt: null,
  url: "https://github.com/jcherfils/bive/pull/58",
  title: "Wait for merge",
}

test("parses a Bive pull request and rejects malformed or foreign results", () => {
  assert.deepEqual(parsePullRequest(JSON.stringify(open)), open)
  assert.throws(() => parsePullRequest("{"), /invalid JSON/)
  assert.throws(() => parsePullRequest(JSON.stringify({ ...open, url: "https://github.com/other/repo/pull/58" })), /not a pull request in jcherfils\/bive/)
})

test("returns when the PR is merged, closed, or still open at the deadline", async () => {
  let time = 0
  let reads = 0
  const options = {
    pollIntervalMs: 10,
    maxWaitMs: 25,
    now: () => time,
    sleep: async (ms: number) => { time += ms },
  }
  const merged = { ...open, state: "MERGED" as const, mergedAt: "2026-11-09T00:00:00Z" }
  assert.equal((await waitForMerge(async () => merged, options)).status, "merged")
  assert.equal((await waitForMerge(async () => ({ ...open, state: "CLOSED" }), options)).status, "closed")
  const timedOut = await waitForMerge(async () => { reads++; return open }, options)
  assert.equal(timedOut.status, "timed_out")
  assert.equal(reads, 4)
})

test("does not hide a failed GitHub read", async () => {
  await assert.rejects(
    waitForMerge(async () => { throw new Error("gh unavailable") }, { pollIntervalMs: 10, maxWaitMs: 20 }),
    /gh unavailable/,
  )
})
