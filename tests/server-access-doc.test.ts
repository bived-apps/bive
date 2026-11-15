import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

// The research report of issue #222: does direct OpenCode server access from an external chat harness give a Bive
// project a reusable capability beyond Bive's own API and skill flows? The doc is the deliverable; these tests keep
// its shape (five sections, marked items, one of the two allowed recommendations) and its size budget.

const ROOT = path.resolve(import.meta.dirname, "..")
const DOC = "docs/SERVER-ACCESS.md"

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")

const section = (doc: string, title: string): string => {
  const start = doc.indexOf(`## ${title}`)
  assert.ok(start >= 0, `the doc has the section "${title}"`)
  const rest = doc.slice(start + `## ${title}`.length)
  const next = rest.search(/\n## /)
  return next < 0 ? rest : rest.slice(0, next)
}

const lines = (doc: string): string[] => {
  const raw = read(DOC)
  return (raw.endsWith("\n") ? raw.slice(0, -1) : raw).split("\n")
}

test("the report answers the question of #222 with its five sections", () => {
  const doc = read(DOC)
  for (const title of ["Question", "What Bive already does", "What direct server access adds", "Gaps and risks",
                       "Recommendation"]) assert.ok(doc.includes(`## ${title}`), title)
  assert.match(section(doc, "Question"), /capability/)
  assert.ok(section(doc, "What Bive already does").includes("lib/delegate-session.ts"))
  assert.ok(section(doc, "What Bive already does").includes(".bive/skills.json"))
  assert.ok(section(doc, "Gaps and risks").length > 100, "the risks are described")
})

test("the recommendation is one of the two forms the issue allows", () => {
  const rec = section(read(DOC), "Recommendation").split("\n").map((l) => l.trim()).filter((l) => l !== "")[0]
  const harness = "leave it as a harness capability"
  const feature = /^propose a later Bive feature: (.+)$/.exec(rec)
  assert.ok(rec === harness || feature !== null, `the recommendation line is one of the two forms: ${rec}`)
  if (feature !== null) {
    assert.ok(feature[1].endsWith("."), "the proposed feature ends its sentence")
    assert.equal(feature[1].split(".").length, 2, "the proposed feature is one sentence")
  }
})

test("every item that direct server access adds is marked observed or hypothesis", () => {
  const items = section(read(DOC), "What direct server access adds").split("\n").filter((l) => l.startsWith("- "))
  assert.ok(items.length >= 3, "the section lists items")
  for (const item of items) assert.match(item, /^- \*\*(observed|hypothesis)\*\* /, item)
})

test("the report stays within its size budget", () => {
  const all = lines(read(DOC))
  assert.ok(all.length <= 70, `the doc has ${all.length} lines`)
  all.forEach((l, i) => assert.ok(l.length <= 120, `line ${i + 1} is ${l.length} characters`))
})
