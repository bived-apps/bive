// node --test tests/*.test.ts — token-ratio's pure helpers (docs/TOKENS.md); no OpenCode needed.
import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { ownSession, registryFailureMessage, totals, twoDigits } from "../.opencode/plugins/token-ratio/lib.ts"

describe("totals", () => {
  test("sums human and agent tokens and rounds the ratio", () => {
    const log = [
      JSON.stringify({ t: 1, kind: "human", tokens: 10, session: "s" }),
      JSON.stringify({ t: 2, kind: "agent", tokens: 120, session: "s", model: "opencode/beam-free" }),
      JSON.stringify({ t: 3, kind: "agent", tokens: 35, session: "s", model: "opencode/beam-free" }),
      JSON.stringify({ t: 4, kind: "violation", count: 2 }),
    ].join("\n") + "\n"
    assert.deepEqual(totals(log), { human: 10, agent: 155, ratio: 16 })
  })
  test("skips a cut or corrupt line and a line without a numeric count", () => {
    const log = '{"kind":"human","tokens":4}\n{"kind":"agent","tok\nnot json\n{"kind":"agent","tokens":"9"}\n{"kind":"agent","tokens":8}\n'
    assert.deepEqual(totals(log), { human: 4, agent: 8, ratio: 2 })
  })
  test("no human token yet: ratio is null", () => {
    assert.deepEqual(totals('{"kind":"agent","tokens":8}\n'), { human: 0, agent: 8, ratio: null })
    assert.deepEqual(totals(""), { human: 0, agent: 0, ratio: null })
  })
})

// #14: every instance receives every session's events; only the sessions of its own location are counted.
describe("ownSession", () => {
  test("the instance's own directory, written either way", () => {
    assert.equal(ownSession("/w/bive", "/w/bive"), true)
    assert.equal(ownSession("/w/bive/", "/w/bive"), true)
    assert.equal(ownSession("/w/bive/sub/..", "/w/bive"), true)
  })
  test("another repository, a worktree, a sub-folder, a parent: not ours (they have their own instance)", () => {
    assert.equal(ownSession("/w/other", "/w/bive"), false)
    assert.equal(ownSession("/w/bive-15", "/w/bive"), false)
    assert.equal(ownSession("/w/bive/.bive/state/fresh", "/w/bive"), false)
    assert.equal(ownSession("/w", "/w/bive"), false)
  })
  test("an unknown directory is not ours", () => {
    assert.equal(ownSession(undefined, "/w/bive"), false)
    assert.equal(ownSession("", "/w/bive"), false)
  })
})

describe("twoDigits", () => {
  test("keeps two significant figures above 100, the number itself below", () => {
    assert.equal(twoDigits(48213), 48000)
    assert.equal(twoDigits(1050), 1100)
    assert.equal(twoDigits(999), 1000)
    assert.equal(twoDigits(100), 100)
    assert.equal(twoDigits(99), 99)
    assert.equal(twoDigits(0), 0)
  })
})

describe("registryFailureMessage (#261)", () => {
  test("names the registry report, not the model, and says when it retries", () => {
    const m = registryFailureMessage("HTTP 500")
    assert.match(m, /^Bive registry report \(token counter, not the model\) not sent: HTTP 500;/)
    assert.match(m, /retried at the next session end/)
    assert.doesNotMatch(m, /wrangler/)
  })
  test("points a 401, a 403 or a Cloudflare page to wrangler", () => {
    for (const d of ["HTTP 403", "HTTP 401", "403 Attention Required! | Cloudflare", "Failed to authenticate"])
      assert.match(registryFailureMessage(d), /wrangler whoami.*wrangler login/, d)
  })
})

test("the plugin warns once with that message and the docs carry the troubleshooting line", () => {
  const src = readFileSync(new URL("../.opencode/plugins/token-ratio/index.ts", import.meta.url), "utf8")
  assert.match(src, /if \(!warned\) console\.error\(registryFailureMessage\(/)
  const doc = readFileSync(new URL("../docs/REGISTRY.md", import.meta.url), "utf8")
  assert.match(doc, /\*\*Troubleshooting\*\*: a `403 Attention Required \| Cloudflare`/)
  assert.match(doc, /Do not switch models for it/)
})
