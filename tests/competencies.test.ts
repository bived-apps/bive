import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const d = fs.readFileSync(new URL("../docs/COMPETENCIES.md", import.meta.url), "utf8")

test("the competency framework keeps its loop, its keep-only-if-it-improves rule and its limits on authority", () => {
  for (const re of [/draft framework/, /a skill\s+adds\s+none/, /kept only if the score rises/, /never the corrected answer/,
    /held-out case/, /never authorization\s+and never a qualification/, /only bench promotes/, /bad control/,
    /does not qualify a model for a role/, /touch bench or\s+university/, /No crowns, stars, medals or ranks/]) assert.match(d, re)
})

test("every design competency names evidence, a held-out test and a pass rule; the rubric weights sum to 100", () => {
  const rows = d.split("\n").filter((l) => /^\| (Palette fidelity|Honest imagery|Stable silhouette|Variety without authority|Provenance|Identity under pressure) \|/.test(l))
  assert.equal(rows.length, 6)
  for (const r of rows) assert.equal(r.split("|").filter((c) => c.trim()).length, 4, r)
  const weights = [...d.matchAll(/(\d+) %/g)].map((m) => Number(m[1]))
  assert.equal(weights.slice(0, 5).reduce((a, b) => a + b, 0), 100)
})
