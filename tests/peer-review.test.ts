import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { buildBundle, extractJson, lotOf, median, reviewable, shuffle, tally, weighted, type Key } from "../lib/peer-review.ts"

const key: Key = {
  A: { site: "gemini.google.com", model: "Gemini", trial: "lot 2, a", images: ["image-1.jpg"] },
  B: { site: "chatgpt.com", model: "GPT", trial: "lot 2, b" },
  C: { site: "gemini.google.com", model: "Gemini", trial: "1" },
}
const controls = [{ id: "control-bad" as const, text: "bad text" }, { id: "control-good" as const, text: "good text" }]

test("lot of a trial, and a reviewer never reviews its own model's packages", () => {
  assert.equal(lotOf("lot 2, x"), 2)
  assert.equal(lotOf("3"), 1)
  assert.deepEqual(reviewable(key, ["A", "B", "C"], "gemini"), ["B"])
  assert.deepEqual(reviewable(key, ["A", "B", "C"], "chatgpt"), ["A", "C"])
})

test("the shuffle is deterministic per reviewer and differs between reviewers", () => {
  const xs = ["a", "b", "c", "d", "e", "f", "g", "h"]
  assert.deepEqual(shuffle(xs, "s:one"), shuffle(xs, "s:one"))
  assert.notDeepEqual(shuffle(xs, "s:one"), shuffle(xs, "s:two"))
  assert.deepEqual([...shuffle(xs, "s:one")].sort(), xs)
})

test("a bundle hides identities, includes both controls, copies images under neutral names and keeps the map private", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "peerrev-"))
  try {
    for (const l of ["A", "B", "C"]) { fs.mkdirSync(path.join(dir, "packages", l, "images"), { recursive: true }); fs.writeFileSync(path.join(dir, "packages", l, "package.md"), `package ${l} text`) }
    fs.writeFileSync(path.join(dir, "packages", "A", "images", "image-1.jpg"), "jpg")
    const b = buildBundle({ dir, reviewer: "chatgpt", letters: ["A", "B", "C"], key, controls })
    assert.deepEqual(Object.values(b.labels).sort(), ["A", "C", "control-bad", "control-good"])
    const bundle = fs.readFileSync(path.join(dir, "review", "chatgpt", "bundle.md"), "utf8")
    assert.match(bundle, /===== P1 =====/)
    assert.doesNotMatch(bundle, /gemini|Gemini|chatgpt|GPT|control-/)
    const a = Object.entries(b.labels).find(([, v]) => v === "A")![0]
    assert.ok(fs.existsSync(path.join(dir, "review", "chatgpt", "images", `${a}-1.jpg`)))
    assert.ok(fs.existsSync(path.join(dir, "review", "chatgpt", "map.json")))
    assert.match(bundle, /FINISH with exactly one JSON code block/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test("the JSON block is read from the end of an answer, and a bad answer returns null", () => {
  const ans = "Review text.\n```json\n{\"scores\": {\"P1\": {\"rules\": 4}}, \"ranking\": [\"P1\"]}\n```\n"
  assert.deepEqual(extractJson(ans)?.scores.P1, { rules: 4 })
  assert.equal(extractJson("no block here"), null)
  assert.equal(extractJson("```json\n{broken\n```"), null)
})

test("weights sum to 1, the median is right, and a reviewer who ranks the bad control above the good one is discarded", () => {
  assert.equal(weighted({ rules: 5, honesty: 5, originality: 5, variety: 5, provenance: 5 }), 5)
  assert.equal(median([1, 3, 2]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  const s = (n: number) => ({ rules: n, honesty: n, originality: n, variety: n, provenance: n })
  const honest = { reviewer: "r1", labels: { P1: "A", P2: "control-bad", P3: "control-good" }, scores: { P1: s(4), P2: s(1), P3: s(5) } }
  const fooled = { reviewer: "r2", labels: { P1: "A", P2: "control-bad", P3: "control-good" }, scores: { P1: s(5), P2: s(5), P3: s(3) } }
  const { rows, discarded } = tally([honest, fooled])
  assert.deepEqual(discarded, ["r2"])
  const a = rows.find((r) => r.id === "A")!
  assert.equal(a.reviews, 1)
  assert.equal(a.median, 4)
})
