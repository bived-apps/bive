import { test } from "node:test"
import assert from "node:assert/strict"
import {
  parseModel,
  loadAliases,
  resolveModel,
  buildCreateRequest,
  buildMoveRequest,
  isInWorktree,
  buildPromptRequest,
  authHeader,
  gitIdentity,
} from "../lib/delegate-session.ts"

test("parseModel splits at the first slash", () => {
  assert.deepEqual(parseModel("anthropic/claude-sonnet-5-5"), { providerID: "anthropic", id: "claude-sonnet-5-5" })
  assert.deepEqual(parseModel("openrouter/anthropic/claude"), { providerID: "openrouter", id: "anthropic/claude" })
})

test("parseModel throws on no slash or an empty side", () => {
  assert.throws(() => parseModel("nomodel"), /provider\/model/)
  assert.throws(() => parseModel("/model"), /empty provider/)
  assert.throws(() => parseModel("provider/"), /empty model id/)
})

test("loadAliases reads a valid file", () => {
  const r = loadAliases('{"aliases": {"a/b": "c/d"}}')
  assert.deepEqual(r, { aliases: { "a/b": "c/d" } })
})

test("loadAliases is fail-safe", () => {
  assert.deepEqual(loadAliases(undefined), { aliases: {} })
  const bad = loadAliases("{not json")
  assert.deepEqual(bad.aliases, {})
  assert.match(bad.warning ?? "", /not valid JSON/)
  for (const t of ["[]", "null", '{"aliases": []}', '{"aliases": null}', '{"x": 1}', '{"aliases": {"a": 1}}']) {
    const r = loadAliases(t)
    assert.deepEqual(r.aliases, {}, t)
    assert.ok(r.warning, t)
  }
})

test("resolveModel uses the alias when present, else the canonical", () => {
  const a = resolveModel("anthropic/sonnet", { "anthropic/sonnet": "bedrock/us.sonnet" })
  assert.deepEqual(a, {
    canonical: "anthropic/sonnet",
    resolved: "bedrock/us.sonnet",
    ref: { providerID: "bedrock", id: "us.sonnet" },
  })
  const b = resolveModel("anthropic/sonnet", {})
  assert.equal(b.resolved, "anthropic/sonnet")
  assert.deepEqual(b.ref, { providerID: "anthropic", id: "sonnet" })
  assert.throws(() => resolveModel("bad", {}))
})

test("buildCreateRequest body", () => {
  const model = { providerID: "p", id: "m" }
  const r = buildCreateRequest({ worktree: "/tmp/wt", model })
  assert.equal(r.method, "POST")
  assert.equal(r.path, "/api/session")
  assert.deepEqual(r.body, { agent: "delegate", model, location: { directory: "/tmp/wt" } })
  assert.ok(!("parentID" in r.body))
  assert.ok(!("title" in r.body))
  const r2 = buildCreateRequest({ worktree: "/tmp/wt", model, agent: "x", title: "T" })
  assert.ok(!("parentID" in r2.body))
  assert.equal(r2.body.title, "T")
  assert.equal(r2.body.agent, "x")
})

test("buildCreateRequest with parentID has parentID and no location (#256)", () => {
  const model = { providerID: "p", id: "m" }
  const r = buildCreateRequest({ worktree: "/tmp/wt", model, parentID: "ses_1" })
  assert.deepEqual(r.body, { agent: "delegate", model, parentID: "ses_1" })
  assert.ok(!("location" in r.body))
  assert.throws(() => buildCreateRequest({ worktree: "/tmp/wt", model, parentID: "abc" }), /ses/)
  assert.throws(() => buildCreateRequest({ worktree: "rel", model, parentID: "ses_1" }), /absolute/)
})

test("buildMoveRequest", () => {
  assert.deepEqual(buildMoveRequest({ sessionID: "ses_a", worktree: "/x/issue-2" }), {
    method: "POST",
    path: "/api/session/ses_a/move",
    body: { directory: "/x/issue-2" },
  })
  assert.throws(() => buildMoveRequest({ sessionID: "abc", worktree: "/x" }), /ses/)
  assert.throws(() => buildMoveRequest({ sessionID: "ses_a", worktree: "x/y" }), /absolute/)
})

test("isInWorktree is exact and fail-safe", () => {
  const at = (directory: unknown) => ({ data: { location: { directory } } })
  assert.equal(isInWorktree(at("/x/issue-2"), "/x/issue-2"), true)
  assert.equal(isInWorktree({ location: { directory: "/x/issue-2" } }, "/x/issue-2"), true)
  assert.equal(isInWorktree(at("/x"), "/x/issue-2"), false)
  assert.equal(isInWorktree(at("/x/issue-2"), "/x/issue-24"), false)
  assert.equal(isInWorktree(at("/x/issue-24"), "/x/issue-2"), false)
  assert.equal(isInWorktree(at("/x/issue-2/"), "/x/issue-2"), false)
  for (const bad of [null, undefined, 1, "s", {}, { data: null }, { data: {} }, at(5), at(""), { location: null }]) {
    assert.equal(isInWorktree(bad, "/x/issue-2"), false)
  }
})

test("buildCreateRequest records the coordinator in metadata", () => {
  const model = { providerID: "p", id: "m" }
  const r = buildCreateRequest({ worktree: "/tmp/wt", model, coordinator: { session: "ses_c", issue: 256 } })
  assert.deepEqual(r.body.metadata, { bive: { coordinator: "ses_c", issue: 256 } })
  assert.ok(!("parentID" in r.body))
  assert.deepEqual(r.body.location, { directory: "/tmp/wt" })
  assert.throws(() => buildCreateRequest({ worktree: "/tmp/wt", model, coordinator: { session: "abc", issue: 1 } }), /ses/)
  for (const issue of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => buildCreateRequest({ worktree: "/tmp/wt", model, coordinator: { session: "ses_c", issue } }), /positive integer/)
  }
})

test("buildCreateRequest rejects a relative worktree", () => {
  assert.throws(() => buildCreateRequest({ worktree: "rel/wt", model: { providerID: "p", id: "m" } }), /absolute/)
})

test("buildPromptRequest", () => {
  const r = buildPromptRequest({ sessionID: "ses_abc", brief: "do it" })
  assert.deepEqual(r, { method: "POST", path: "/api/session/ses_abc/prompt", body: { text: "do it", delivery: "queue" } })
  assert.equal(buildPromptRequest({ sessionID: "ses_abc", brief: "x", delivery: "now" }).body.delivery, "now")
  assert.throws(() => buildPromptRequest({ sessionID: "ses_abc", brief: "  " }), /empty/)
  assert.throws(() => buildPromptRequest({ sessionID: "abc", brief: "x" }), /ses/)
})

test("authHeader", () => {
  assert.equal(authHeader("secret"), "Basic b3BlbmNvZGU6c2VjcmV0")
  assert.throws(() => authHeader(""), /empty/)
})

test("gitIdentity uses the canonical name even when an alias applies", () => {
  const m = resolveModel("anthropic/claude-sonnet-5-5", { "anthropic/claude-sonnet-5-5": "bedrock/x" })
  assert.deepEqual(gitIdentity(m.canonical), { name: "delegate anthropic/claude-sonnet-5-5", email: "delegate@bive.invalid" })
})
