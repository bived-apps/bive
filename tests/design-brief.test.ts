import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const doc = fs.readFileSync(new URL("../docs/DESIGN-BRIEF.md", import.meta.url), "utf8")

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test("every text colour in the brief reaches 4.5:1 on both bases (computed, not claimed)", () => {
  for (const name of ["ink", "muted", "advisor (teal)", "coordinator (amber)", "delegate (violet)"]) {
    const row = doc.split("\n").find((l) => l.startsWith(`| ${name} |`))
    assert.ok(row, `no row for ${name}`)
    const hex = /`(#[0-9A-Fa-f]{6})`/.exec(row!)![1]
    assert.ok(contrast(hex, "#FFFFFF") >= 4.5, `${name} ${hex} on white`)
    assert.ok(contrast(hex, "#F7F5F0") >= 4.5, `${name} ${hex} on the soft base`)
  }
})

test("the brief keeps the tagline, the fixed role words, the safeguards and the approval gate", () => {
  for (const re of [/Agents write, you decide\./, /owner\*\*, \*\*advisor\*\*, \*\*coordinator\*\*, \*\*delegate\*\*/, /No "supervisor"/,
    /no existing show, game or franchise/, /no billing or provider change/, /Text only/i, /What the owner approves now/,
    /colour never carries meaning alone/i]) assert.match(doc, re)
  assert.doesNotMatch(doc, /^## .*supervisor/im)
})
