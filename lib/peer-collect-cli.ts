// node lib/peer-collect-cli.ts add <raw-file> <site> <model> [trial] [--image <file>]... [--note <text>]
// Reads a raw capture, anonymises it, assigns a random unused letter, writes the anonymised package to
// <dir>/packages/<letter>/package.md and the private key (letter -> site, model, trial) to <dir>/key.json.
// <dir> is `.bive/state/peer` (git-ignored). Nothing is published by this tool; the key never goes into packages/.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { anonymise, leaks } from "./peer-anonymise.ts"

const DIR = process.env.PEER_DIR ?? path.join(".bive", "state", "peer")
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("") // no I or O: avoid look-alikes

export type Extras = { images?: string[], note?: string }

export function addPackage(rawFile: string, site: string, model: string, trial: string | undefined, dir = DIR, extras: Extras = {}): { letter: string, removed: string[] } {
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
  // Images are copied as they are: a picture cannot be leak-checked, and its style or an invisible mark may still betray its
  // author, so the owner looks at each one before anything is published.
  const images = (extras.images ?? []).map((src, i) => {
    const ext = path.extname(src).toLowerCase()
    if (![".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) throw new Error(`not an image: ${src}`)
    // An SVG is code: refuse one that could run or fetch anything when opened.
    if (ext === ".svg" && /<script|<foreignObject|\bon[a-z]+\s*=|javascript:|href\s*=\s*["']?https?:/i.test(fs.readFileSync(src, "utf8"))) {
      throw new Error(`refusing an SVG with script, event handler or external link: ${src}`)
    }
    fs.mkdirSync(path.join(dir, "packages", letter, "images"), { recursive: true })
    const name = `image-${i + 1}${ext}`
    fs.copyFileSync(src, path.join(dir, "packages", letter, "images", name))
    return name
  })
  key[letter] = { site, model, ...(trial ? { trial } : {}), ...(images.length ? { images } : {}), ...(extras.note ? { note: extras.note } : {}) }
  fs.writeFileSync(keyFile, JSON.stringify(key, null, 2) + "\n", { mode: 0o600 })
  return { letter, removed }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const args = process.argv.slice(2)
  const images: string[] = []
  let note: string | undefined
  const pos: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--image") images.push(args[++i])
    else if (args[i] === "--note") note = args[++i]
    else pos.push(args[i])
  }
  const [cmd, file, site, model, trial] = pos
  if (cmd !== "add" || !file || !site || !model) {
    console.error("usage: node lib/peer-collect-cli.ts add <raw-file> <site> <model> [trial] [--image <file>]... [--note <text>]")
    process.exit(2)
  }
  const r = addPackage(file, site, model, trial, DIR, { images, note })
  console.log(`stored as package ${r.letter}; removed: ${r.removed.join("; ") || "nothing"}; key kept locally`)
}
