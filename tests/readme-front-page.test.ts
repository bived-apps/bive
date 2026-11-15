import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

test("the README front page uses the design assets", () => {
  const readmePath = new URL("../README.md", import.meta.url)
  const r = fs.readFileSync(readmePath, "utf8")
  const repoRoot = path.resolve(path.dirname(fileURLToPath(readmePath)))
  // tagline
  // acronym
  assert.match(r, /^\*\*BIVE\*\*: Bive Is Verifiably Endorsed$/m)
  // flow picture with alt >= 40 chars
  const flowAlt = r.match(/!\[([^\]]{40,})\]\(docs\/design\/flow\.svg\)/)
  assert.ok(flowAlt, "flow.svg with alt of 40+ characters")
  // mermaid block still present and inside <details>
  assert.match(r, /<details>/)
  assert.match(r, /<summary>The same flow as text<\/summary>/)
  assert.match(r, /```mermaid/)
  const detailsStart = r.indexOf("<details>")
  const mermaidIdx = r.indexOf("```mermaid")
  assert.ok(detailsStart >= 0 && mermaidIdx > detailsStart, "mermaid inside <details>")
  // four role glyphs at width 40, each with a non-empty alt naming its role
  assert.match(r, /<img[^>]+src="docs\/design\/role-owner\.svg"[^>]*width="40"[^>]*alt="Owner glyph:[^"]+"/)
  assert.match(r, /<img[^>]+src="docs\/design\/role-advisor\.svg"[^>]*width="40"[^>]*alt="Advisor glyph:[^"]+"/)
  assert.match(r, /<img[^>]+src="docs\/design\/role-coordinator\.svg"[^>]*width="40"[^>]*alt="Coordinator glyph:[^"]+"/)
  assert.match(r, /<img[^>]+src="docs\/design\/role-delegate\.svg"[^>]*width="40"[^>]*alt="Delegate glyph:[^"]+"/)
  // each row also shows its companion at width 40, with an alt of 10+ characters naming it
  assert.match(r, /<img[^>]+src="docs\/design\/companions\/maren\.svg"[^>]*width="40"[^>]*alt="Maren,[^"]{10,}"/)
  assert.match(r, /<img[^>]+src="docs\/design\/companions\/sill\.svg"[^>]*width="40"[^>]*alt="Sill,[^"]{10,}"/)
  assert.match(r, /<img[^>]+src="docs\/design\/companions\/brae\.svg"[^>]*width="40"[^>]*alt="Brae,[^"]{10,}"/)
  assert.match(r, /<img[^>]+src="docs\/design\/companions\/pim\.svg"[^>]*width="40"[^>]*alt="Pim,[^"]{10,}"/)
  // two scenes each with an alt of 40+ characters
  const handoverAlt = r.match(/!\[([^\]]{40,})\]\(docs\/design\/cast\/scene-handover\.svg\)/)
  assert.ok(handoverAlt, "scene-handover.svg with alt of 40+ characters")
  const refusalAlt = r.match(/!\[([^\]]{40,})\]\(docs\/design\/cast\/scene-refusal\.svg\)/)
  assert.ok(refusalAlt, "scene-refusal.svg with alt of 40+ characters")
  // every docs/design/...svg path the README references exists on disk
  for (const m of r.matchAll(/!\[[^\]]*\]\((docs\/design\/[^)]+\.svg)\)/g)) {
    const p = path.join(repoRoot, m[1])
    assert.ok(fs.existsSync(p), `missing referenced file: ${m[1]}`)
  }
  for (const m of r.matchAll(/<img[^>]+src="(docs\/design\/[^"]+\.svg)"/g)) {
    const p = path.join(repoRoot, m[1])
    assert.ok(fs.existsSync(p), `missing referenced file: ${m[1]}`)
  }
  // Bive's mark sits directly above the title
  assert.match(r, /^<img src="docs\/design\/icon\/icon-d\.svg" width="96" alt="Bive's mark: a capital B drawn by small delegates">\n\n# Bive/m)
  // one line of badges right after the BIVE line; tests badge points at bive-tests.yml, which exists
  const badgesLine = "[![tests](https://github.com/bived-apps/bive/actions/workflows/bive-tests.yml/badge.svg?branch=bived)](https://github.com/bived-apps/bive/actions/workflows/bive-tests.yml) [![release](https://img.shields.io/github/v/release/bived-apps/bive?color=6D28D9)](https://github.com/bived-apps/bive/releases/latest) [![licence: MIT](https://img.shields.io/badge/licence-MIT-0F766E)](LICENSE) [![site](https://img.shields.io/badge/site-bived--apps.github.io-B45309)](https://bived-apps.github.io/bive/)"
  assert.ok(r.includes("**BIVE**: Bive Is Verifiably Endorsed\n\n" + badgesLine + "\n") && fs.existsSync(path.join(repoRoot, ".github", "workflows", "bive-tests.yml")), "badges line after BIVE line and tests badge workflow exists")
})