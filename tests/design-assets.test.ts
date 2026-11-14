import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const DIR = new URL("../docs/design/", import.meta.url)
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".svg")).sort()
const read = (f: string) => fs.readFileSync(new URL(f, DIR), "utf8")
const PALETTE = new Set(["#1F2430", "#5B6270", "#0F766E", "#B45309", "#6D28D9", "#B8860B", "#F7F5F0", "#FFFFFF", "NONE"])

test("the asset list of the brief exists: flow, four roles, five page icons", () => {
  assert.deepEqual(files, ["flow.svg", "icon-bench.svg", "icon-registry.svg", "icon-template.svg", "icon-university.svg",
    "icon-workspace.svg", "role-advisor.svg", "role-coordinator.svg", "role-delegate.svg", "role-owner.svg"])
})

for (const f of files) {
  test(`${f}: accessible, token colours only, nothing external or executable`, () => {
    const s = read(f)
    assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    assert.match(s, /role="img"/)
    assert.match(s, /aria-labelledby="t d"/)
    assert.match(s, /<title id="t">[^<]+<\/title>/)
    assert.match(s, /<desc id="d">[^<]{10,}<\/desc>/)
    assert.doesNotMatch(s, /<script|<image|href=|javascript:|onload=|<foreignObject/i)
    for (const m of s.matchAll(/(?:stroke|fill)="(#[0-9A-Fa-f]{6}|none|currentColor)"/g)) {
      assert.ok(PALETTE.has(m[1].toUpperCase()), `${f}: colour ${m[1]} is not in the brief's palette`)
    }
    if (f !== "flow.svg") {
      assert.match(s, /viewBox="0 0 24 24"/)
      assert.match(s, /stroke-width="2"/)
      assert.match(s, /stroke-linecap="round"/)
      assert.doesNotMatch(s, /<text/)
    }
  })
}

test("each role glyph uses its role colour", () => {
  const colour: Record<string, string> = { "role-advisor.svg": "#0F766E", "role-coordinator.svg": "#B45309", "role-delegate.svg": "#6D28D9", "role-owner.svg": "#1F2430" }
  for (const [f, c] of Object.entries(colour)) assert.ok(read(f).includes(`stroke="${c}"`), `${f} lacks ${c}`)
  assert.ok(read("role-owner.svg").includes("#B8860B"), "the owner's ring is gold")
})

test("the flow names every role and both gates, and its text has real contrast", () => {
  const s = read("flow.svg")
  for (const w of ["Owner", "Advisor", "Coordinator", "Delegate", "gate 1", "gate 3", "only the owner merges"]) assert.ok(s.includes(w), w)
  assert.doesNotMatch(s, /[Ss]upervisor/)
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  for (const [text, bg] of [["#1F2430", "#FFFFFF"], ["#5B6270", "#FFFFFF"], ["#1F2430", "#F7F5F0"]]) {
    const [hi, lo] = [luminance(text), luminance(bg)].sort((a, b) => b - a)
    assert.ok((hi + 0.05) / (lo + 0.05) >= 4.5, `${text} on ${bg}`)
  }
})
