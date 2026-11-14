import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const DIR = new URL("../docs/design/cast/", import.meta.url)
const svgs = fs.readdirSync(DIR).filter((f) => f.endsWith(".svg")).sort()
const read = (f: string) => fs.readFileSync(new URL(f, DIR), "utf8")

test("the cast has its sheet and six pictures", () => {
  assert.deepEqual(svgs, ["cast-sheet.svg", "poses-odet.svg", "scene-advisor.svg", "scene-handover.svg", "scene-learning.svg",
    "scene-peer-review.svg", "scene-refusal.svg"])
})

for (const f of svgs) {
  test(`${f}: accessible, no text, nothing executable or external`, () => {
    const s = read(f)
    assert.match(s, /role="img"/)
    assert.match(s, /<title[^>]*>[^<]+<\/title>/)
    assert.match(s, /<desc[^>]*>[^<]{10,}<\/desc>/)
    assert.match(s, /viewBox="0 0 1600 900"/)
    assert.doesNotMatch(s, /<text|<script|<image|<foreignObject|javascript:/i)
    assert.doesNotMatch(s, /\son[a-z]+\s*=/i, "no event handler")
    for (const m of s.matchAll(/href="([^"]*)"/g)) assert.ok(m[1].startsWith("#"), `${f}: external reference ${m[1]}`)
  })
}

test("the advisor has no arms and touches nothing, and the README records provenance and unverified rights", () => {
  assert.match(read("scene-advisor.svg"), /no arms/i)
  const r = fs.readFileSync(new URL("README.md", DIR), "utf8")
  for (const re of [/claude-fable-5-2/, /Not verified/, /usage rights/, /only Maren decides/, /Skill, not rank/]) assert.match(r, re)
})

test("the README shows the cast sheet with real alt text and links the cast guide", () => {
  const r = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8")
  assert.match(r, /!\[The Bive cast:[^\]]{40,}\]\(docs\/design\/cast\/cast-sheet\.svg\)/)
  assert.match(r, /\(docs\/design\/cast\/README\.md\)/)
})
