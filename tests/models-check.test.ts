import { test } from "node:test"
import assert from "node:assert/strict"
import { checkModels, classifyModelError, closestMatch, formatReport, parseModelList, probeModels } from "../lib/models-check.ts"

test("parseModelList drops blanks, junk and duplicates, keeps order", () => {
  assert.deepEqual(parseModelList("a/b\n\n  c/d  \njunk\na/b\ne/f/g\n"), ["a/b", "c/d", "e/f/g"])
})

test("closestMatch", () => {
  assert.equal(closestMatch("x/beam", ["y/other", "z/beam"]), "z/beam")
  assert.equal(closestMatch("opencode/big-pickl", ["opencode/big-pickle", "a/zzzzzzzz"]), "opencode/big-pickle")
  assert.equal(closestMatch("x/abcdefgh", ["y/zzzzzzzz"]), undefined)
})

test("checkModels: found, alias, missing with closest", () => {
  const r = checkModels(
    { delegate: ["a/one", "b/two", "c/three"] },
    ["a/one", "q/alt", "d/three"],
    { "b/two": "q/alt" },
  )
  assert.deepEqual(r.roles.delegate, [
    { canonical: "a/one", resolved: "a/one", status: "found" },
    { canonical: "b/two", resolved: "q/alt", status: "alias" },
    { canonical: "c/three", resolved: "c/three", status: "missing", closest: "d/three" },
  ])
  assert.equal(r.ok, true)
})

test("checkModels: role without usable model is not ok; non-array role ignored", () => {
  const r = checkModels({ coordinator: ["x/y"], bad: "oops" as unknown as string[] }, ["a/b"], {})
  assert.equal(r.ok, false)
  assert.equal("bad" in r.roles, false)
})

test("classifyModelError", () => {
  assert.equal(classifyModelError("Free usage limit reached. Connect a provider or subscribe to OpenCode Go"), "limit")
  assert.equal(classifyModelError("HTTP 429 Too Many Requests"), "limit")
  assert.equal(classifyModelError("Your credit balance is too low to access the Anthropic API"), "credit")
  assert.equal(classifyModelError("Add usage credits or subscribe"), "credit")
  assert.equal(classifyModelError("Model not found: x"), "unavailable")
  assert.equal(classifyModelError("connect ECONNREFUSED 127.0.0.1"), "unavailable")
  assert.equal(classifyModelError("OK"), "other")
})

test("probeModels", async () => {
  const send = async (model: string): Promise<string> => {
    if (model === "a/ok") return "OK"
    if (model === "a/throw") throw new Error("boom")
    if (model === "a/err") return "Rate limit exceeded"
    return new Promise<string>(() => {})
  }
  const r = await probeModels(["a/ok", "a/throw", "a/err", "a/hang"], send, 20)
  assert.deepEqual(r[0], { model: "a/ok", ok: true })
  assert.deepEqual(r[1], { model: "a/throw", ok: false, reason: "boom" })
  assert.equal(r[2].ok, false)
  assert.match(r[2].reason ?? "", /^limit/)
  assert.equal(r[3].ok, false)
  assert.match(r[3].reason ?? "", /timed out/)
})

test("formatReport", () => {
  const good = checkModels({ r: ["a/one", "b/two", "c/three"] }, ["a/one", "q/alt", "d/three"], { "b/two": "q/alt" })
  assert.equal(formatReport(good), "r: a/one: found\nr: b/two: alias q/alt\nr: c/three: found\nok".replace("c/three: found", "c/three: MISSING (closest d/three)"))
  const bad = checkModels({ r: ["x/y"] }, [], {})
  assert.equal(formatReport(bad), "r: x/y: MISSING\nNO USABLE MODEL FOR r")
})
