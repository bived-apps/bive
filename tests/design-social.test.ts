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
  assert.deepEqual(all, ["README.md", "social-card-roles.png", "social-card-roles.svg", "social-card.png", "social-card.svg"])
})

test("the guide names the card, says who uploads, and records regeneration", () => {
  const r = read("README.md")
  assert.match(r, /social-card\.svg/)
  assert.match(r, /social-card\.png/)
  assert.match(r, /`social-card-roles\.svg`/)
  assert.match(r, /`social-card-roles\.png`/)
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

test("social-card.svg: the wordmark carries the name, the tagline is typed, no text smaller than 40 px", () => {
  const s = read("social-card.svg")
  assert.match(s, /<title id="t">Bive<\/title>/, "the title says the name")
  const texts = [...s.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])
  assert.deepEqual(texts, ["Agents write, you decide."], "the only typed text is the tagline: the name is drawn")
  // the wordmark: a copy of ../icon/wordmark.svg under a scaled group, ids prefixed w-
  const w = fs.readFileSync(new URL("../icon/wordmark.svg", DIR), "utf8")
  const uses = (t: string, p: string) =>
    [...t.matchAll(new RegExp(`<use href="#${p}(pim|odet|fenn)" transform="([^"]*)"/>`, "g"))].map((m) => `${m[1]} ${m[2]}`)
  assert.ok(uses(w, "").length > 40, "the wordmark has its delegates")
  assert.deepEqual(uses(s, "w-"), uses(w, ""), "the card's delegates are the wordmark's")
  for (const id of ["w-sh", "w-pim", "w-odet", "w-fenn"]) assert.ok(s.includes(`id="${id}"`), `missing id ${id}`)
  const ids = [...s.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1])
  assert.equal(new Set(ids).size, ids.length, "no id twice")
  for (const m of s.matchAll(/font-size="(\d+)"/g)) assert.ok(Number(m[1]) >= 40, `text smaller than 40 px: ${m[1]}`)
})

// The second variant (issue #364): the same card, the word drawn by every role. It may use the cast sheet's colours:
// exactly these, on top of the palette above (Maren, Sill and Brae).
const ROLES_MORE = ["#14857C", "#2B2126", "#2B3142", "#343B4D", "#5FB3AA", "#6B7280", "#9A4507", "#B87B54", "#C68B62", "#C8691F", "#DE9448", "#FFFDF8"]

test("social-card-roles.svg: the card's rules, with the role companions' colours and no other", () => {
  const s = read("social-card-roles.svg")
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.match(s, /viewBox="0 0 1280 640"/)
  assert.match(s, /role="img"/)
  assert.match(s, /aria-labelledby="t d"/)
  assert.match(s, /<title id="t">Bive<\/title>/)
  assert.match(s, /<desc id="d">[^<]{10,}<\/desc>/)
  assert.doesNotMatch(s, /<script|<image|javascript:|onload=|<foreignObject/i)
  for (const m of s.matchAll(/href="([^"]*)"/g)) assert.ok(m[1].startsWith("#"), `external reference ${m[1]}`)
  for (const m of s.matchAll(/url\(([^)]*)\)/g)) assert.ok(m[1].startsWith("#"), `external reference ${m[1]}`)
  const used = hexes(s)
  for (const c of used) assert.ok(PALETTE.has(c) || ROLES_MORE.includes(c), `colour ${c} is not allowed on the roles card`)
  for (const c of ROLES_MORE) assert.ok(used.has(c), `colour ${c} is allowed but not used`)
  const cast = hexes(fs.readFileSync(new URL("../cast/cast-sheet.svg", DIR), "utf8"))
  for (const c of ROLES_MORE) assert.ok(cast.has(c), `colour ${c} is not on the cast sheet`)
})

test("social-card-roles.svg: the first card with wordmark-roles in the wordmark's place, same geometry", () => {
  const s = read("social-card-roles.svg")
  const first = read("social-card.svg")
  const texts = [...s.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1])
  assert.deepEqual(texts, ["Agents write, you decide."], "the only typed text is the tagline: the name is drawn")
  for (const m of s.matchAll(/font-size="(\d+)"/g)) assert.ok(Number(m[1]) >= 40, `text smaller than 40 px: ${m[1]}`)
  const w = fs.readFileSync(new URL("../icon/wordmark-roles.svg", DIR), "utf8")
  const uses = (t: string, p: string) =>
    [...t.matchAll(new RegExp(`<use href="#${p}(\\w+)" transform="([^"]*)"/>`, "g"))].map((m) => `${m[1]} ${m[2]}`)
  assert.ok(uses(w, "").length > 40, "wordmark-roles has its companions")
  assert.deepEqual(uses(s, "w-"), uses(w, ""), "the card's companions are those of wordmark-roles")
  const ids = [...s.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1])
  assert.equal(new Set(ids).size, ids.length, "no id twice")
  for (const id of ids) assert.ok(id === "t" || id === "d" || id.startsWith("w-"), `id ${id} is not prefixed w-`)
  // same geometry: the wordmark's group, the tagline and the glyph row are those of the first card
  const group = (t: string) => t.match(/<g transform="(translate\([^"]*scale\([\d.]+\))">\s*<defs>/)?.[1]
  assert.ok(group(first), "the first card has its scaled wordmark group")
  assert.equal(group(s), group(first), "the wordmark's group is placed and scaled the same")
  const after = (t: string) => t.slice(t.indexOf("<text"))
  assert.equal(after(s), after(first), "the tagline and the glyph row are the same")
})

test("social-card-roles.png: a PNG under 1 MB", () => {
  const b = fs.readFileSync(new URL("social-card-roles.png", DIR))
  assert.ok(b.subarray(0, 8).equals(PNG_SIGNATURE), "social-card-roles.png does not start with the PNG signature")
  assert.ok(b.length < 1_000_000, `social-card-roles.png is ${b.length} bytes`)
})

test("social-card.png: a PNG under 1 MB", () => {
  const b = fs.readFileSync(new URL("social-card.png", DIR))
  assert.ok(b.subarray(0, 8).equals(PNG_SIGNATURE), "social-card.png does not start with the PNG signature")
  assert.ok(b.length < 1_000_000, `social-card.png is ${b.length} bytes`)
})