// Cross review of anonymised design packages (docs/COMPETENCIES.md): build one review bundle per reviewer, then tally.
// Private data (which package is which, which reviewer got which label) stays in the git-ignored .bive/state/peer/.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

export const CRITERIA = ["rules", "honesty", "originality", "variety", "provenance"] as const
export type Criterion = typeof CRITERIA[number]
export const WEIGHTS: Record<Criterion, number> = { rules: 0.25, honesty: 0.25, originality: 0.2, variety: 0.15, provenance: 0.15 }

export type Key = Record<string, { site?: string, model?: string, trial?: string, images?: string[], note?: string }>
export type Control = { id: "control-bad" | "control-good", text: string }
export type Bundle = { reviewer: string, labels: Record<string, string> } // label -> letter or control id

// Deterministic shuffle so a bundle can be rebuilt; each reviewer gets a different order.
export function shuffle<T>(items: T[], seed: string): T[] {
  const out = [...items]
  let h = crypto.createHash("sha256").update(seed).digest()
  let n = 0
  for (let i = out.length - 1; i > 0; i--) {
    if (n + 4 > h.length) { h = crypto.createHash("sha256").update(h).digest(); n = 0 }
    const j = h.readUInt32BE(n) % (i + 1)
    n += 4
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function lotOf(trial: string | undefined): 1 | 2 {
  return trial && /^lot 2/i.test(trial) ? 2 : 1
}

// A reviewer never reviews a package its own model wrote.
export function reviewable(key: Key, letters: string[], reviewer: string): string[] {
  const r = reviewer.toLowerCase()
  return letters.filter((l) => {
    const who = `${key[l]?.site ?? ""} ${key[l]?.model ?? ""}`.toLowerCase()
    return !who.includes(r)
  })
}

export const REVIEW_PROMPT = (n: number) => `You are a peer reviewer. Below are ${n} anonymous design packages (labelled P1 to P${n}, in random order) for Bive: an open-source template where LLM agents work in separate roles and a human owner decides. You do not know who wrote them; do not try to guess, and do not favour a style because it resembles yours.

RULES the packages were asked to follow: no text inside images, no logos, no real person, nothing resembling an existing show, game, film or brand; nothing implying a sandbox, shield, lock or agents merging into the main branch; skills add no authority and no rank; the four roles are owner, advisor, coordinator, delegate.

For EACH package, give a score from 0 to 5 for each criterion, with one sentence of evidence:
1. rules: respect of the rules above;
2. honesty: nothing overpromises what Bive does, and the package admits what it did not deliver;
3. originality: memorable and readable at small size, not generic or childish;
4. variety: companions differ by skill without implying rank or authority;
5. provenance: truthful about its own limits and its rights ("unknown" is acceptable).
Quote the exact line that justifies any score of 0 or 1. Do not reward length or polish. A truthful "not delivered" is better than a false completion.

Then rank the packages, name the single strongest and the single weakest idea across all of them, and say which one you would ship and what you would fix first. List anything suspicious (a copied character, a false claim). If you recognise your own work, say so and skip it.

FINISH with exactly one JSON code block, nothing after it:
{"scores": {"P1": {"rules": 0, "honesty": 0, "originality": 0, "variety": 0, "provenance": 0}, "...": {}}, "ranking": ["P?", "P?"]}
`

export function buildBundle(opts: {
  dir: string, reviewer: string, name?: string, letters: string[], key: Key, controls: Control[], seed?: string,
}): Bundle {
  const { dir, reviewer, key, controls } = opts
  const pool = [...reviewable(key, opts.letters, reviewer), ...controls.map((c) => c.id)]
  const order = shuffle(pool, `${opts.seed ?? "bundle"}:${opts.name ?? reviewer}`)
  const labels: Record<string, string> = {}
  const parts: string[] = []
  const outDir = path.join(dir, "review", opts.name ?? reviewer)
  fs.mkdirSync(path.join(outDir, "images"), { recursive: true })
  order.forEach((id, i) => {
    const label = `P${i + 1}`
    labels[label] = id
    const control = controls.find((c) => c.id === id)
    const text = control ? control.text : fs.readFileSync(path.join(dir, "packages", id, "package.md"), "utf8")
    const imgs = control ? [] : (key[id]?.images ?? [])
    imgs.forEach((name, k) => {
      const ext = path.extname(name)
      fs.copyFileSync(path.join(dir, "packages", id, "images", name), path.join(outDir, "images", `${label}-${k + 1}${ext}`))
    })
    const note = imgs.length ? `\n[This package has ${imgs.length} image file(s), named ${label}-1 and so on, attached separately.]\n` : "\n[This package has no image attached.]\n"
    parts.push(`===== ${label} =====\n${text.trim()}\n${note}`)
  })
  fs.writeFileSync(path.join(outDir, "bundle.md"), `${REVIEW_PROMPT(order.length)}\n${parts.join("\n")}`)
  fs.writeFileSync(path.join(outDir, "map.json"), JSON.stringify({ reviewer, name: opts.name ?? reviewer, labels }, null, 2) + "\n", { mode: 0o600 })
  return { reviewer, labels }
}

export function extractJson(answer: string): { scores: Record<string, Partial<Record<Criterion, number>>>, ranking?: string[] } | null {
  const blocks = [...answer.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1])
  const candidate = blocks.length ? blocks[blocks.length - 1] : answer.slice(answer.lastIndexOf('{"scores"'))
  try {
    const j = JSON.parse(candidate)
    return j && typeof j.scores === "object" ? j : null
  } catch { return null }
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const weighted = (s: Partial<Record<Criterion, number>>) =>
  CRITERIA.reduce((n, c) => n + (typeof s[c] === "number" ? s[c]! : 0) * WEIGHTS[c], 0)

export type Row = { id: string, reviews: number, median: number, spread: number, perCriterion: Record<Criterion, number> }

// reviews: reviewer -> { bundle map, parsed answer }. A reviewer is discarded when the bad control outscores the good one.
export function tally(reviews: Array<{ reviewer: string, labels: Record<string, string>, scores: Record<string, Partial<Record<Criterion, number>>> }>) {
  const kept: typeof reviews = []
  const discarded: string[] = []
  for (const r of reviews) {
    const byId: Record<string, number> = {}
    for (const [label, id] of Object.entries(r.labels)) if (r.scores[label]) byId[id] = weighted(r.scores[label])
    if ("control-bad" in byId && "control-good" in byId && byId["control-bad"] >= byId["control-good"]) discarded.push(r.reviewer)
    else kept.push(r)
  }
  const per: Record<string, Array<{ total: number, c: Partial<Record<Criterion, number>> }>> = {}
  for (const r of kept) for (const [label, id] of Object.entries(r.labels)) {
    const s = r.scores[label]
    if (s) (per[id] ??= []).push({ total: weighted(s), c: s })
  }
  const rows: Row[] = Object.entries(per).map(([id, list]) => ({
    id, reviews: list.length,
    median: median(list.map((x) => x.total)),
    spread: Math.max(...list.map((x) => x.total)) - Math.min(...list.map((x) => x.total)),
    perCriterion: Object.fromEntries(CRITERIA.map((c) => [c, median(list.map((x) => x.c[c] ?? 0))])) as Record<Criterion, number>,
  })).sort((a, b) => b.median - a.median)
  return { rows, discarded }
}
