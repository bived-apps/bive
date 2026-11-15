import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

// The Mermaid block of the README is the source of truth; docs/design/flow.svg is its drawn twin (issue #383).
const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8")
const svg = fs.readFileSync(new URL("../docs/design/flow.svg", import.meta.url), "utf8")

const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
const mermaid = /```mermaid\n([\s\S]*?)\n```/.exec(readme)?.[1] ?? ""
const svgTexts = [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((m) => unescape(m[1]).trim())
const count = (label: string) => svgTexts.filter((t) => t === label).length

// A node: `ID["<b>Name</b><br/>second line"]`, with or without the round brackets of a stadium shape.
const nodes = [...mermaid.matchAll(/^\s*(\w+)\(?\["<b>([^<]+)<\/b><br\/>([^"]+)"\]/gm)].map((m) => ({ id: m[1], name: m[2], line: m[3] }))
// An edge: `FROM & FROM -- "label" --> TO & TO`, with `-.` for a dashed line and `==` for a thick one.
const edges = [...mermaid.matchAll(/^\s*([\w &]+?)\s+(--|-\.|==)\s+"([^"]+)"\s+(?:-->|\.->|==>)\s+([\w &]+?)\s*$/gm)].map((m) => ({
  label: m[3],
  lines: m[1].split("&").length * m[4].split("&").length,
}))

test("the README has a Mermaid flow with its five nodes and seven labelled edge statements", () => {
  assert.ok(mermaid.startsWith("flowchart"), "a ```mermaid flowchart block in README.md")
  assert.equal(nodes.length, 5, "five nodes")
  assert.equal(edges.length, 7, "seven edge statements")
})

test("every node of the Mermaid is in the picture: its name and its second line", () => {
  for (const n of nodes) {
    assert.ok(count(n.name) >= nodes.filter((o) => o.name === n.name).length, `node name "${n.name}"`)
    assert.ok(count(n.line) >= 1, `node line "${n.line}"`)
  }
})

test("every edge label of the Mermaid is in the picture, once per line it labels", () => {
  for (const e of edges) assert.ok(count(e.label) >= e.lines, `"${e.label}" at least ${e.lines} time(s), found ${count(e.label)}`)
  assert.ok(count("brief") >= 2, "brief, to each delegate")
  assert.ok(count("push + report") >= 2, "push + report, from each delegate")
})

test("the picture draws one arrow per line of the Mermaid, and its description names every edge label", () => {
  const group = (re: RegExp) => [...svg.matchAll(re)].reduce((n, m) => n + [...m[1].matchAll(/<path /g)].length, 0)
  const inGroups = group(/<g stroke="#1F2430" stroke-width="2" fill="none"[^>]*marker-end="url\(#a\)">([\s\S]*?)<\/g>/g)
  const thick = [...svg.matchAll(/<path [^>]*stroke-width="5"[^>]*marker-end="url\(#a\)"\/>/g)].length
  const wanted = edges.reduce((n, e) => n + e.lines, 0)
  assert.equal(inGroups + thick, wanted, `${wanted} arrows (found ${inGroups} thin and ${thick} thick)`)
  assert.equal(thick, edges.filter((e) => e.label.startsWith("gate 3")).length, "only the owner's gate is thick")
  const desc = unescape(/<desc id="d">([^<]+)<\/desc>/.exec(svg)?.[1] ?? "")
  for (const e of edges) assert.ok(desc.includes(e.label), `desc names "${e.label}"`)
})
