import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const DOCS = path.join(ROOT, "docs")

const pages = [
  {
    file: "FOR-HUMANS.md",
    role: "owner",
    glyph: "design/role-owner.svg",
    scene: "design/cast/scene-refusal.svg",
  },
  {
    file: "COORDINATING.md",
    role: "coordinator",
    glyph: "design/role-coordinator.svg",
    scene: "design/cast/scene-handover.svg",
  },
  {
    file: "ADVISOR-INVITATIONS.md",
    role: "advisor",
    glyph: "design/role-advisor.svg",
    scene: "design/cast/scene-advisor.svg",
  },
] as const

for (const p of pages) {
  test(`${p.file}: glyph and scene in first 8 lines with non-empty alts and existing files`, () => {
    const text = fs.readFileSync(path.join(DOCS, p.file), "utf8")
    const first8 = text.split("\n").slice(0, 8).join("\n")

    const img = first8.match(new RegExp(`<img[^>]*src="${p.glyph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`))
    assert.ok(img, `missing ${p.role} glyph in first 8 lines`)
    const glyphAlt = img[0].match(/\balt="([^"]*)"/)
    assert.ok(glyphAlt && glyphAlt[1].trim().length > 0, `${p.role} glyph needs a non-empty alt`)

    const scene = first8.match(new RegExp(`!\\[([^\\]]+)\\]\\(${p.scene.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`))
    assert.ok(scene, `missing ${p.role} scene in first 8 lines`)
    assert.ok(scene[1].trim().length >= 40, `scene alt must be at least 40 characters`)

    assert.ok(fs.existsSync(path.join(DOCS, p.glyph)), `missing file ${p.glyph}`)
    assert.ok(fs.existsSync(path.join(DOCS, p.scene)), `missing file ${p.scene}`)
  })
}
