import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const DIR = new URL("../docs/design/social/", import.meta.url)
const read = (f: string) => fs.readFileSync(new URL(f, DIR), "utf8")
const PALETTE = new Set(["#1F2430", "#5B6270", "#0F766E", "#B45309", "#6D28D9", "#B8860B", "#F7F5F0", "#FFFFFF", "NONE", "#2E2152", "#2F1063", "#3B1578", "#3B2A6B", "#4A1AA0", "#4A3A7A", "#4C1D95", "#5727A6", "#5A1FBF", "#5B33C9", "#5B5548", "#6A3BBE", "#7446E0", "#7C3AED", "#8B5CF6", "#9CA3AF", "#9D78F9", "#A98BF5", "#B79CFB", "#C9523C", "#C9A56A", "#E0A82E", "#E4674F", "#EDE9FE"])
const hexes = (s: string) => new Set([...s.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()))
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

test("the social folder holds the card and its guide", () => {
  const all = fs.readdirSync(DIR).sort()
  assert.deepEqual(all, ["README.md", "social-card.png", "social-card.svg"])
})

test("the guide names the card, says who uploads, and records regeneration", () => {
  const r = read("README.md")
  assert.match(r, /social-card\.svg/)
  assert.match(r, /social-card\.png/)
  assert.match(r, /the owner/)
  assert.match(r, /rsvg-convert/)
  const index = fs.readFileSync(new URL("../README.md", DIR), "utf8")
  assert.match(index, /\| `social\/` \|[^\n]*\(social\/README\.md\)/)
})

test("social-card.svg: viewBox, accessibility, no script/image/external reference", () => {
  const s = read("social-card.svg")
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.match(s, /viewBox="0 0 1280 640"/)
  assert.match(s, /role="img"/)
  assert.match(s, /aria-labelledby="t d"/)
  assert.match(s, /<title id="t">[^<]+<\/title>/)
  assert.match(s, /<desc id="d">[^<]{10,}<\/desc>/)
  assert.doesNotMatch(s, /<script|<image|javascript:|onload=|<foreignObject/i)
  for (const m of s.matchAll(/href="([^"]*)"/g)) assert.ok(m[1].startsWith("#"), `external reference ${m[1]}`)
  for (const m of s.matchAll(/url\(([^)]*)\)/g)) assert.ok(m[1].startsWith("#"), `external reference ${m[1]}`)
})

test("social-card.svg: only the brief's colours", () => {
  const s = read("social-card.svg")
  for (const c of hexes(s)) assert.ok(PALETTE.has(c), `colour ${c} is not in the brief's palette`)
})

test("social-card.svg: the name Bive and the tagline, no text smaller than 40 px", () => {
  const s = read("social-card.svg")
  assert.ok(s.includes("Bive"), "missing the name Bive")
  assert.ok(s.includes("Agents write, you decide."), "missing the tagline")
  for (const m of s.matchAll(/font-size="(\d+)"/g)) assert.ok(Number(m[1]) >= 40, `text smaller than 40 px: ${m[1]}`)
})

test("social-card.png: a PNG under 1 MB", () => {
  const b = fs.readFileSync(new URL("social-card.png", DIR))
  assert.ok(b.subarray(0, 8).equals(PNG_SIGNATURE), "social-card.png does not start with the PNG signature")
  assert.ok(b.length < 1_000_000, `social-card.png is ${b.length} bytes`)
})