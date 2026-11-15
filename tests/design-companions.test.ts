import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const DIR = new URL("../docs/design/companions/", import.meta.url)
const ROLES: Record<string, string> = { brae: "coordinator", fenn: "delegate", maren: "owner", odet: "delegate", pim: "delegate", sill: "advisor" }
const NAMES = Object.keys(ROLES)
const all = fs.readdirSync(DIR).sort()
const read = (f: string) => fs.readFileSync(new URL(f, DIR), "utf8")
const hexes = (s: string) => new Set([...s.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()))
const CAST = hexes(fs.readFileSync(new URL("../docs/design/cast/cast-sheet.svg", import.meta.url), "utf8"))

test("the companions folder holds exactly the six icons and their guide", () => {
  assert.deepEqual(all, ["README.md", ...NAMES.map((n) => `${n}.svg`)])
})

test("the guide names the six files with their roles and records unverified rights", () => {
  const r = read("README.md")
  for (const n of NAMES) {
    const name = n[0].toUpperCase() + n.slice(1)
    assert.match(r, new RegExp(`\\| \`${n}\\.svg\` \\| ${name} \\| ${ROLES[n]} \\| [^|\\n]{20,} \\|`), `the guide's table lacks ${n}.svg`)
  }
  for (const re of [/Not verified/, /claude-fable-5-2/, /No image generator/, /usage rights/, /24 px/]) assert.match(r, re)
  const index = fs.readFileSync(new URL("../README.md", DIR), "utf8")
  assert.match(index, /\| `companions\/` \|[^\n]*\(companions\/README\.md\)/)
})

for (const n of NAMES) {
  test(`${n}.svg: accessible, no text, nothing executable or external, cast colours only`, () => {
    const s = read(`${n}.svg`)
    assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    assert.match(s, /role="img"/)
    assert.match(s, /<title[^>]*>[^<]+<\/title>/)
    assert.match(s, /<desc[^>]*>[^<]{10,}<\/desc>/)
    assert.match(s, /viewBox="0 0 96 96"/)
    assert.doesNotMatch(s, /<text|<script|<image|<foreignObject|javascript:/i)
    assert.doesNotMatch(s, /\son[a-z]+\s*=/i, "no event handler")
    for (const m of s.matchAll(/href="([^"]*)"/g)) assert.ok(m[1].startsWith("#"), `${n}: external reference ${m[1]}`)
    for (const m of s.matchAll(/url\(([^)]*)\)/g)) assert.ok(m[1].startsWith("#"), `${n}: external reference ${m[1]}`)
    for (const c of hexes(s)) assert.ok(CAST.has(c), `${n}: colour ${c} is not on the cast sheet`)
    assert.match(s, /<circle cx="48" cy="48" r="46" fill="#[0-9A-Fa-f]{6}"\/>/, "a soft round ground")
    const title = s.match(/<title[^>]*>([^<]+)<\/title>/)
    assert.ok(title && title[1].toLowerCase().includes(n) && title[1].includes(ROLES[n]), `${n}: the title names the companion and its role`)
  })
}
