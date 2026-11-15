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
  const r = read("README.md")
  assert.ok(r.includes("`wordmark.svg`"), "the guide does not name wordmark.svg")
  assert.match(r, /<img src="wordmark\.svg" width="\d+" alt="[^"]{20,}">/)
})

test("wordmark.svg: the B of the mark; i, v and e by every working role; Maren only the dot of the i", () => {
  const s = read("wordmark.svg")
  const uses = (t: string) =>
    [...t.matchAll(/<use href="#(\w+)" transform="translate\(([\d.]+),([\d.]+)\) scale\(0\.68\)"\/>/g)]
      .map((m) => ({ who: m[1], x: Number(m[2]), y: Number(m[3]), tag: m[0] }))
  const mine = uses(s)
  assert.equal(mine.length, [...s.matchAll(/<use /g)].length, "every figure is placed the same way")
  for (const n of new Set(mine.map((u) => u.who))) assert.ok(s.includes(`<g id="${n}">`), `${n} is not defined`)
  // four letter shapes under the figures; the B's is icon-d's
  const letters = [...s.matchAll(/<path d="(M[^"]*)"\/>/g)].map((m) => m[1])
  assert.equal(letters.length, 4, "four letter shapes")
  assert.ok(read("icon-d.svg").includes(`<path d="${letters[0]}"`), "the B's shape is icon-d's")
  // the figures of each letter, told apart by where they stand (the letters do not overlap in x)
  const DELEGATES = ["pim", "odet", "fenn"]
  const B = mine.filter((u) => u.x < 400), i = mine.filter((u) => u.x >= 400 && u.x < 500)
  const v = mine.filter((u) => u.x >= 500 && u.x < 740), e = mine.filter((u) => u.x >= 740)
  // the B: icon-d's delegates, each one at its place, and nobody else
  assert.deepEqual(B.map((u) => u.tag).sort(), uses(read("icon-d.svg")).map((u) => u.tag).sort(), "the B is icon-d's")
  assert.equal(B.length, 23)
  for (const u of B) assert.ok(DELEGATES.includes(u.who), `${u.who} stands on the B`)
  // Maren: once, above the stem of the i
  const marens = mine.filter((u) => u.who === "maren")
  assert.equal(marens.length, 1, "Maren appears once")
  assert.ok(i.includes(marens[0]), "Maren stands on the i")
  for (const u of i) if (u !== marens[0]) assert.ok(u.y > marens[0].y + 40, "Maren is the dot, above the stem")
  // i, v, e: Sill, Brae and the delegates on each; the delegates the most numerous
  for (const [name, letter] of [["i", i], ["v", v], ["e", e]] as const) {
    const count = (...names: string[]) => letter.filter((u) => names.includes(u.who)).length
    assert.ok(count("sill") >= 1, `no Sill on the ${name}`)
    assert.ok(count("brae") >= 1, `no Brae on the ${name}`)
    assert.ok(count(...DELEGATES) > count("sill", "brae"), `the delegates are not the most numerous on the ${name}`)
    for (const u of letter) assert.ok([...DELEGATES, "sill", "brae", "maren"].includes(u.who), `${u.who} on the ${name}`)
  }
  for (const n of DELEGATES) assert.ok([...i, ...v, ...e].some((u) => u.who === n), `${n} is missing from i, v, e`)
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
