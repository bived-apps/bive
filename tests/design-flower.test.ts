import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const DIR = new URL("../docs/design/", import.meta.url)
const svg = fs.readFileSync(new URL("flower.svg", DIR), "utf8")
const hexes = (s: string) => new Set([...s.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()))
const CAST = hexes(fs.readFileSync(new URL("cast/cast-sheet.svg", DIR), "utf8"))
const uses = (id: string) => [...svg.matchAll(new RegExp(`<use href="#${id}"([^>]*)/>`, "g"))].map((m) => m[1])
// Where a transform "translate(x,y) scale(k)" puts the centre (48,48) of a 96 x 96 companion, inside the flower's
// group, whose origin is the centre of the picture.
const centre = (attrs: string) => {
  const m = attrs.match(/transform="translate\((-?[\d.]+),(-?[\d.]+)\) scale\(([\d.]+)\)"/)
  assert.ok(m, `unexpected transform: ${attrs}`)
  const [x, y, k] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return { r: Math.hypot(x + 48 * k, y + 48 * k), k }
}

test("the flower exists as an SVG and as a 1024 px PNG", () => {
  const png = fs.readFileSync(new URL("flower.png", DIR))
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "the PNG signature")
  assert.equal(png.subarray(12, 16).toString("latin1"), "IHDR")
  assert.equal(png.readUInt32BE(16), 1024, "1024 px wide")
  assert.equal(png.readUInt32BE(20), 1024, "square")
})

test("flower.svg: accessible, no text, nothing executable or external, cast colours only", () => {
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.match(svg, /role="img"/)
  assert.match(svg, /<title[^>]*>[^<]+<\/title>/)
  assert.match(svg, /<desc[^>]*>[^<]{10,}<\/desc>/)
  assert.doesNotMatch(svg, /<text|<script|<image|<foreignObject|javascript:/i)
  assert.doesNotMatch(svg, /\son[a-z]+\s*=/i, "no event handler")
  for (const m of svg.matchAll(/href="([^"]*)"/g)) assert.ok(m[1].startsWith("#"), `external reference ${m[1]}`)
  for (const m of svg.matchAll(/url\(([^)]*)\)/g)) assert.ok(m[1].startsWith("#"), `external reference ${m[1]}`)
  for (const c of hexes(svg)) assert.ok(CAST.has(c), `colour ${c} is not on the cast sheet`)
  for (const m of svg.matchAll(/href="#([^"]+)"/g)) assert.ok(svg.includes(`id="${m[1]}"`), `#${m[1]} is not defined`)
})

test("a square viewBox on a full-bleed cream ground", () => {
  assert.match(svg, /viewBox="0 0 512 512"/)
  assert.match(svg, /<rect width="512" height="512" fill="#F7F5F0"\/>/)
  assert.match(svg, /<g transform="translate\(256,256\)">/, "the flower is drawn around the centre")
})

test("Maren is used once, at the centre, larger than the others, in the owner's gold", () => {
  const maren = uses("maren")
  assert.equal(maren.length, 1)
  const m = centre(maren[0])
  assert.ok(m.r < 0.01, "Maren sits at the centre")
  for (const n of ["sill", "brae", "pim", "odet", "fenn"]) for (const u of uses(n)) assert.ok(centre(u).k < m.k, `${n} is smaller than Maren`)
  assert.match(svg, /<circle r="[\d.]+" fill="#B8860B"\/>/, "a gold ring round the centre")
})

test("each other role is a petal: used at least once, away from the centre, inside the round crop", () => {
  const petals = [...svg.matchAll(/<use href="#petal" transform="rotate\((\d+)\)" fill="(#[0-9A-F]{6})"/g)]
  const turns = petals.map((p) => Number(p[1]))
  assert.deepEqual(turns, turns.map((_, i) => (i * 360) / turns.length), "evenly spaced petals")
  let n = 0
  for (const [name, colour] of [["sill", "#0F766E"], ["brae", "#B45309"], ["pim", "#6D28D9"], ["odet", "#6D28D9"], ["fenn", "#6D28D9"]]) {
    const u = uses(name)
    assert.ok(u.length >= 1, `${name} is missing`)
    for (const attrs of u) {
      const c = centre(attrs)
      assert.ok(c.r > 100, `${name} is a petal, not the centre`)
      assert.ok(c.r + 46 * c.k <= 0.4 * 512, `${name} stays inside the circle of radius 0.4 of the side`)
      n++
    }
    assert.ok(petals.some((p) => p[2] === colour), `no petal in the role colour ${colour} of ${name}`)
  }
  assert.equal(petals.length, n, "one petal per companion")
  // The petal's outline itself stays inside the same circle (its farthest point is its tip, on the axis).
  const d = svg.match(/<path id="petal" d="([^"]+)"/)
  assert.ok(d)
  for (const p of d[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) assert.ok(Math.hypot(Number(p[1]), Number(p[2])) <= 0.4 * 512 + 20, "a control point far outside the crop")
  assert.ok(d[1].includes("0,-204 "), "the tip of the petal is at 204 of 204.8")
})

test("the design README has the flower's row, with provenance and unverified rights", () => {
  const r = fs.readFileSync(new URL("README.md", DIR), "utf8")
  const row = r.split("\n").find((l) => l.startsWith("| `flower.svg`"))
  assert.ok(row, "no row for flower.svg")
  for (const re of [/flower\.png/, /Maren/, /claude-fable-5-2/, /[Nn]o image generator/, /Not verified/, /usage rights/]) assert.match(row, re)
})
