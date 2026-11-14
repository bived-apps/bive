// node lib/peer-review-cli.ts build <lot: 1|2> <reviewer>...     one bundle per reviewer under .bive/state/peer/review/<reviewer>/
// node lib/peer-review-cli.ts tally [--reveal]                    reads review/<reviewer>/answer.txt (the reviewer's answer, pasted)
// Never publishes anything; every output stays in the git-ignored .bive/state/peer/.
import fs from "node:fs"
import path from "node:path"
import { buildBundle, extractJson, lotOf, tally, type Control, type Key } from "./peer-review.ts"

const DIR = process.env.PEER_DIR ?? path.join(".bive", "state", "peer")
const key: Key = JSON.parse(fs.readFileSync(path.join(DIR, "key.json"), "utf8"))
const letters = Object.keys(key).filter((l) => /^[A-Z]$/.test(l) && fs.existsSync(path.join(DIR, "packages", l, "package.md")))

function controls(): Control[] {
  const read = (f: string) => fs.readFileSync(path.join(DIR, "controls", f), "utf8")
  return [{ id: "control-bad", text: read("bad.md") }, { id: "control-good", text: read("good.md") }]
}

const [cmd, ...rest] = process.argv.slice(2)
if (cmd === "build") {
  const lot = Number(rest[0])
  const reviewers = rest.slice(1)
  if (![1, 2].includes(lot) || reviewers.length === 0) { console.error("usage: build <1|2> <reviewer>..."); process.exit(2) }
  // image-only packages (no written cast) cannot be reviewed on their text: kept out of the bundles
  const pool = letters.filter((l) => lotOf(key[l].trial) === lot && !/image only/i.test(key[l].trial ?? ""))
  for (const r of reviewers) {
    const name = `${r}-lot${lot}`
    const b = buildBundle({ dir: DIR, reviewer: r, name, letters: pool, key, controls: controls() })
    console.log(`bundle for ${r} (lot ${lot}): ${Object.keys(b.labels).length} packages (own work excluded, 2 controls) -> ${path.join(DIR, "review", name, "bundle.md")}`)
  }
} else if (cmd === "tally") {
  const reveal = rest.includes("--reveal")
  const reviews: Parameters<typeof tally>[0] = []
  const problems: string[] = []
  for (const r of fs.existsSync(path.join(DIR, "review")) ? fs.readdirSync(path.join(DIR, "review")) : []) {
    const map = path.join(DIR, "review", r, "map.json"), ans = path.join(DIR, "review", r, "answer.txt")
    if (!fs.existsSync(map) || !fs.existsSync(ans)) continue
    const parsed = extractJson(fs.readFileSync(ans, "utf8"))
    if (!parsed) { problems.push(`${r}: no readable JSON block at the end of the answer`); continue }
    reviews.push({ reviewer: r, labels: JSON.parse(fs.readFileSync(map, "utf8")).labels, scores: parsed.scores })
  }
  const { rows, discarded } = tally(reviews)
  console.log("| package | reviews | median | spread | rules | honesty | originality | variety | provenance |")
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |")
  for (const x of rows) {
    const who = reveal && key[x.id] ? ` (${key[x.id].site} / ${key[x.id].model})` : ""
    console.log(`| ${x.id}${who} | ${x.reviews} | ${x.median.toFixed(2)} | ${x.spread.toFixed(2)} | ${Object.values(x.perCriterion).join(" | ")} |`)
  }
  if (discarded.length) console.log(`\nDiscarded reviewers (bad control scored at least as high as the good one): ${discarded.join(", ")}`)
  for (const p of problems) console.log(`\nProblem: ${p}`)
} else {
  console.error("usage: peer-review-cli.ts build <1|2> <reviewer>... | tally [--reveal]")
  process.exit(2)
}
