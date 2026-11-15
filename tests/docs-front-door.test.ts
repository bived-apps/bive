import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const DOCS = path.join(ROOT, "docs")
const FRONT = path.join(DOCS, "README.md")
const front = fs.readFileSync(FRONT, "utf8")
const pages = fs.readdirSync(DOCS).filter((f) => f.endsWith(".md") && f !== "README.md").sort()

test("every other page of docs/ is linked exactly once", () => {
  for (const page of pages) {
    const link = new RegExp(`\\]\\(${page.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g")
    const hits = front.match(link) ?? []
    assert.equal(hits.length, 1, `${page} must be linked exactly once, found ${hits.length}`)
  }
})

test("the five sections appear in order", () => {
  let from = 0
  for (const heading of ["## Owner", "## Advisor", "## Coordinator", "## Delegate", "## Reference and history"]) {
    const at = front.indexOf(`\n${heading}\n`, from)
    assert.ok(at !== -1, `${heading} is missing or out of order`)
    from = at + heading.length
  }
})

test("every relative link and every src resolves to a file that exists", () => {
  for (const m of front.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split("#")[0]
    if (!target || /^(?:[a-z]+:)?\/\//i.test(target) || target.startsWith("mailto:")) continue
    assert.ok(fs.existsSync(path.join(DOCS, target)), `broken link ${target}`)
  }
  for (const m of front.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(DOCS, m[1])), `broken src ${m[1]}`)
  }
})

test("the four role glyphs have a non-empty alt", () => {
  for (const role of ["owner", "advisor", "coordinator", "delegate"]) {
    const img = front.match(new RegExp(`<img[^>]*src="design/role-${role}\\.svg"[^>]*>`))
    assert.ok(img, `missing the ${role} glyph`)
    const alt = img[0].match(/\balt="([^"]*)"/)
    assert.ok(alt && alt[1].trim().length > 0, `the ${role} glyph needs a non-empty alt`)
  }
})

test("the root README links the docs front door", () => {
  const root = fs.readFileSync(path.join(ROOT, "README.md"), "utf8")
  assert.match(root, /\(docs\/README\.md\)/)
})

test("Bive's mark sits above the docs title", () => {
  assert.match(front, /^<img src="design\/icon\/icon-d\.svg" width="64" alt="Bive's mark: a capital B drawn by small delegates">\n\n# Bive's docs/m)
})
