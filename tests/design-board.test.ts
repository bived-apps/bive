import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const DESIGN = path.join(ROOT, "docs", "design")
const BOARD_MD = path.join(DESIGN, "role-column-board.md")
const BOARD_SVG = path.join(DESIGN, "role-column-board.svg")
const BOARD_PNG = path.join(DESIGN, "role-column-board.png")

test("the board page has options A to E, each with four rows", () => {
  const md = fs.readFileSync(BOARD_MD, "utf8")
  for (const letter of ["A", "B", "C", "D", "E"]) {
    const re = new RegExp(`^##\\s*(?:Option\\s+)?${letter}\\b`, "m")
    assert.match(md, re, `missing section ${letter}`)
  }
  // split into sections by ## headings
  const sections = md.split(/^##\s+/m).slice(1)
  const optionSections = sections.filter((s) => /^[A-E]\b/.test(s))
  assert.equal(optionSections.length, 5, "expected five option sections")
  for (const s of optionSections) {
    const rows = s.split(/\n/).filter((l) => /^\|/.test(l) && !/^\|\s*[-: ]+\|/.test(l) && !/^\|\s*\|\s*Role/.test(l))
    // exclude header row containing "Role"
    const dataRows = rows.filter((l) => !/\|\s*\*\*?Role\*\*?\s*\|/.test(l) && !/^\|\s*\|\s*Role/.test(l))
    // simpler: count rows that contain an <img
    const imgRows = s.split(/\n/).filter((l) => /<img/.test(l))
    assert.equal(imgRows.length, 4, `section does not have four rows: ${s.slice(0, 40)}`)
  }
})

test("every src in the board resolves to a file", () => {
  const md = fs.readFileSync(BOARD_MD, "utf8")
  for (const m of md.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)) {
    const src = m[1]
    assert.ok(fs.existsSync(path.join(DESIGN, src)), `broken src ${src}`)
  }
})

test("every image in the board has an alt of 10+ characters", () => {
  const md = fs.readFileSync(BOARD_MD, "utf8")
  for (const m of md.matchAll(/<img[^>]*>/g)) {
    const tag = m[0]
    const alt = tag.match(/\balt="([^"]*)"/)
    assert.ok(alt, `missing alt in ${tag}`)
    assert.ok(alt[1].trim().length >= 10, `alt too short: ${alt[1]}`)
  }
})

test("the board SVG is accessible and has no image, script or external reference", () => {
  const s = fs.readFileSync(BOARD_SVG, "utf8")
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  assert.match(s, /role="img"/)
  assert.match(s, /<title[^>]*>[^<]+<\/title>/)
  assert.match(s, /<desc[^>]*>[^<]{10,}<\/desc>/)
  assert.doesNotMatch(s, /<image\b/i)
  assert.doesNotMatch(s, /<script\b/i)
  for (const m of s.matchAll(/href="([^"]*)"/g)) assert.ok(m[1].startsWith("#"), `external reference ${m[1]}`)
  for (const m of s.matchAll(/url\(([^)]*)\)/g)) assert.ok(m[1].trim().startsWith("#"), `external reference ${m[1]}`)
})

test("the board PNG starts with the PNG signature and is under 1 MB", () => {
  const buf = fs.readFileSync(BOARD_PNG)
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  assert.ok(buf.subarray(0, 8).equals(sig), "not a PNG")
  assert.ok(buf.length < 1024 * 1024, `PNG too large: ${buf.length}`)
})
