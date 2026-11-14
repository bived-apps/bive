// node lib/peer-collect-cli.ts add <raw-file> <site> <model> [trial]
// Reads a raw capture, anonymises it, assigns a random unused letter, writes the anonymised package to
// <dir>/packages/<letter>/package.md and the private key (letter -> site, model, trial) to <dir>/key.json.
// <dir> is `.bive/state/peer` (git-ignored). Nothing is published by this tool; the key never goes into packages/.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { anonymise, leaks } from "./peer-anonymise.ts"

const DIR = process.env.PEER_DIR ?? path.join(".bive", "state", "peer")
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("") // no I or O: avoid look-alikes

export function addPackage(rawFile: string, site: string, model: string, trial: string | undefined, dir = DIR): { letter: string, removed: string[] } {
  const raw = fs.readFileSync(rawFile, "utf8")
  const { text, removed } = anonymise(raw)
  const bad = leaks(text)
  if (bad.length) throw new Error(`refusing to store: identity left in the text (${bad.join(", ")})`)
  const keyFile = path.join(dir, "key.json")
  const key: Record<string, { site: string, model: string, trial?: string }> = fs.existsSync(keyFile) ? JSON.parse(fs.readFileSync(keyFile, "utf8")) : {}
  const free = LETTERS.filter((l) => !(l in key))
  if (free.length === 0) throw new Error("no free letter left")
  const letter = free[crypto.randomInt(free.length)]
  fs.mkdirSync(path.join(dir, "packages", letter), { recursive: true })
  fs.writeFileSync(path.join(dir, "packages", letter, "package.md"), text)
  key[letter] = { site, model, ...(trial ? { trial } : {}) }
  fs.writeFileSync(keyFile, JSON.stringify(key, null, 2) + "\n", { mode: 0o600 })
  return { letter, removed }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const [cmd, file, site, model, trial] = process.argv.slice(2)
  if (cmd !== "add" || !file || !site || !model) {
    console.error("usage: node lib/peer-collect-cli.ts add <raw-file> <site> <model> [trial]")
    process.exit(2)
  }
  const r = addPackage(file, site, model, trial)
  console.log(`stored as package ${r.letter}; removed: ${r.removed.join("; ") || "nothing"}; key kept locally`)
}
