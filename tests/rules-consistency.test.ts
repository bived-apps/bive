import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function runningIt(): string {
  const text = read("HANDOFF.md")
  const start = text.indexOf("## Running it")
  if (start === -1) return ""
  const rest = text.slice(start + "## Running it".length)
  const next = rest.indexOf("\n## ")
  return next === -1 ? rest : rest.slice(0, next)
}

const CONTRADICTIONS: Array<{ phrase: RegExp; rule: string; files: string[] }> = [
  { phrase: /\bsquash\b/i, rule: "AGENTS.md › Project rules: GitHub PR merge methods `merge` only", files: ["README.md", "HANDOFF.md:running-it"] },
  { phrase: /splits,\s*reviews,\s*merges/i, rule: "AGENTS.md › Roles: the coordinator never merges", files: ["README.md"] },
  { phrase: /reviews\s+and\s+merges\s+into\s+the\s+integration\s+branch/i, rule: "AGENTS.md › Roles: the coordinator never merges", files: ["README.md"] },
  { phrase: /merge\s+only\s+baseline-fix\s+PRs/i, rule: "AGENTS.md › Roles: the coordinator never merges", files: [".bive/prompts/COORDINATOR.md"] },
  { phrase: /delegate\b[^.\n]*\b(?:creates?|opens?)\b[^.\n]*\bpull request\b/i, rule: "AGENTS.md › Rules: a delegate never creates a pull request", files: ["README.md", "HANDOFF.md:running-it", ".bive/prompts/COORDINATOR.md", ".bive/prompts/DELEGATE.md", ".bive/prompts/SUPERVISOR.md"] },
]

test("no rule-contradicting phrase appears in the launch prompts and handoff", () => {
  for (const { phrase, rule, files } of CONTRADICTIONS) {
    for (const f of files) {
      const text = f === "HANDOFF.md:running-it" ? runningIt() : read(f)
      const m = text.match(phrase)
      assert.equal(m, null, `${f} contradicts "${rule}" via "${m?.[0]}"`)
    }
  }
})

test("the launch prompt names the launch template", () => {
  const text = read("HANDOFF.md")
  assert.match(text, /\.bive\/templates\/launch\.md/, "HANDOFF.md must name the launch template")
})