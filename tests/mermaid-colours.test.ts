import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const ROOT = path.resolve(import.meta.dirname, "..")

// The role tokens of docs/DESIGN-BRIEF.md. The owner's token is ink, as in docs/design/flow.svg; gold (#B8860B) is
// only the decorative ring of the owner's glyph, never a box's stroke (owner, issue #383).
const COLOURS: Record<string, string> = {
  owner: "#1F2430",
  advisor: "#0F766E",
  coordinator: "#B45309",
  delegate: "#6D28D9",
}

function trackedMarkdown(): string[] {
  const out = execFileSync("git", ["ls-files", "*.md"], { cwd: ROOT, encoding: "utf8", timeout: 30000 })
  return out.split("\n").filter((line) => line.trim() !== "")
}

function mermaidBlocks(content: string): string[] {
  const blocks: string[] = []
  const lines = content.split(/\r?\n/)
  let inBlock = false
  let isMermaid = false
  let current: string[] = []
  for (const line of lines) {
    const fence = line.trim().match(/^```(\w*)/)
    if (fence) {
      if (!inBlock) {
        inBlock = true
        isMermaid = fence[1].toLowerCase() === "mermaid"
        current = []
      } else {
        if (isMermaid) blocks.push(current.join("\n"))
        inBlock = false
        isMermaid = false
        current = []
      }
      continue
    }
    if (inBlock) current.push(line)
  }
  return blocks
}

test("at least one Mermaid block exists", () => {
  let count = 0
  for (const rel of trackedMarkdown()) {
    const content = fs.readFileSync(path.join(ROOT, rel), "utf8")
    count += mermaidBlocks(content).length
  }
  assert.ok(count >= 1, "expected at least one Mermaid block (the README's)")
})

test("every Mermaid classDef for a role uses that role's colour as its stroke", () => {
  for (const rel of trackedMarkdown()) {
    const content = fs.readFileSync(path.join(ROOT, rel), "utf8")
    for (const block of mermaidBlocks(content)) {
      for (const line of block.split(/\r?\n/)) {
        const roleMatch = line.match(/^\s*classDef\s+(owner|advisor|coordinator|delegate)\b/i)
        if (!roleMatch) continue
        const role = roleMatch[1].toLowerCase()
        const expected = COLOURS[role]
        const strokeMatch = line.match(/stroke\s*:\s*(#[0-9A-Fa-f]{6})/i)
        assert.ok(strokeMatch, `${rel}: classDef ${role} has no stroke colour`)
        assert.equal(
          strokeMatch[1].toLowerCase(),
          expected.toLowerCase(),
          `${rel}: classDef ${role} stroke ${strokeMatch[1]} is not ${expected}`
        )
      }
    }
  }
})