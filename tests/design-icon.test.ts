import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const DIR = new URL("../docs/design/icon/", import.meta.url)
const NAMES = ["icon-a", "icon-b", "icon-c", "icon-d"]
const all = fs.readdirSync(DIR).sort()
const read = (f: string) => fs.readFileSync(new URL(f, DIR), "utf8")
const hexes = (s: string) => new Set([...s.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()))
const CAST = hexes(fs.readFileSync(new URL("../docs/design/cast/cast-sheet.svg", import.meta.url), "utf8"))
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

test("the icon folder holds exactly the four candidates, each as SVG and PNG", () => {
  assert.deepEqual(all.filter((f) => f.endsWith(".svg")), [...NAMES.map((n) => `${n}.svg`), "wordmark.svg"])
  assert.deepEqual(all.filter((f) => f.endsWith(".png")), NAMES.map((n) => `${n}.png`))
})

test("the guide shows the four candidates, says who chooses and records unverified rights", () => {
  const r = read("README.md")
  for (const n of NAMES) {
    assert.ok(r.includes(`\`${n}.svg\``), `the guide does not name ${n}.svg`)
    const img = r.match(new RegExp(`<img src="${n}\\.png" width="96" alt="([^"]*)">`))
    assert.ok(img && img[1].trim().length >= 20, `the guide must show ${n}.png with real alt text`)
  }
  for (const re of [/Not verified/, /the owner/, /candidates until the owner chooses/, /claude-fable-5-2/, /usage rights/,
    /no agent can set them/]) assert.match(r, re)
  const index = fs.readFileSync(new URL("../README.md", DIR), "utf8")
  assert.match(index, /\| `icon\/` \|[^\n]*\(icon\/README\.md\)/)
  assert.match(r, /Chosen.*icon-d/)
})

test("wordmark.svg: the word Bive, not a candidate; the icons' rules, a tight viewBox, no background", () => {
  const s = read("wordmark.svg")
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.match(s, /role="img"/)
  assert.match(s, /<title[^>]*>[^<]*Bive[^<]*<\/title>/)
  assert.match(s, /<desc[^>]*>[^<]{10,}<\/desc>/)
  assert.doesNotMatch(s, /<text|<script|<image|<foreignObject|javascript:/i)
  assert.doesNotMatch(s, /\son[a-z]+\s*=/i, "no event handler")
  for (const m of s.matchAll(/href="([^"]*)"/g)) assert.ok(m[1].startsWith("#"), `external reference ${m[1]}`)
  for (const m of s.matchAll(/url\(([^)]*)\)/g)) assert.ok(m[1].startsWith("#"), `external reference ${m[1]}`)
  for (const c of hexes(s)) assert.ok(CAST.has(c), `colour ${c} is not on the cast sheet`)
  assert.doesNotMatch(s, /<rect width="\d+" height="\d+" fill=/, "no background: it sits on any page")
  const box = s.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/)
  assert.ok(box, "a viewBox")
  assert.ok(Number(box[3]) > 2 * Number(box[4]), "a word is wider than tall")
  // the B is icon-d's, delegate for delegate; the i, v and e add their own
  const uses = (t: string) => [...t.matchAll(/<use href="#(?:pim|odet|fenn)" transform="[^"]*"\/>/g)].map((m) => m[0])
  const mine = new Set(uses(s))
  for (const u of uses(read("icon-d.svg"))) assert.ok(mine.has(u), `the B lost a delegate of icon-d: ${u}`)
  assert.ok(mine.size > 40, `only ${mine.size} delegates for four letters`)
  for (const who of ["pim", "odet", "fenn"]) assert.ok(s.includes(`href="#${who}"`), `${who} is missing`)
  const r = read("README.md")
  assert.ok(r.includes("`wordmark.svg`"), "the guide does not name wordmark.svg")
  assert.match(r, /<img src="wordmark\.svg" width="\d+" alt="[^"]{20,}">/)
})

for (const n of NAMES) {
  test(`${n}.svg: accessible, no text, nothing executable or external, cast colours only`, () => {
    const s = read(`${n}.svg`)
    assert.match(s, /role="img"/)
    assert.match(s, /<title[^>]*>[^<]+<\/title>/)
    assert.match(s, /<desc[^>]*>[^<]{10,}<\/desc>/)
    assert.match(s, /viewBox="0 0 512 512"/)
    assert.doesNotMatch(s, /<text|<script|<image|<foreignObject|javascript:/i)
    assert.doesNotMatch(s, /\son[a-z]+\s*=/i, "no event handler")
    for (const m of s.matchAll(/href="([^"]*)"/g)) assert.ok(m[1].startsWith("#"), `${n}: external reference ${m[1]}`)
    for (const m of s.matchAll(/url\(([^)]*)\)/g)) assert.ok(m[1].startsWith("#"), `${n}: external reference ${m[1]}`)
    for (const c of hexes(s)) assert.ok(CAST.has(c), `${n}: colour ${c} is not on the cast sheet`)
    assert.match(s, /<rect width="512" height="512" fill="#[0-9A-Fa-f]{6}"\/>/, "a full-bleed background")
  })

  test(`${n}.png: a PNG under 200 kB`, () => {
    const b = fs.readFileSync(new URL(`${n}.png`, DIR))
    assert.ok(b.subarray(0, 8).equals(PNG_SIGNATURE), `${n}.png does not start with the PNG signature`)
    assert.ok(b.length < 200_000, `${n}.png is ${b.length} bytes`)
  })
}
