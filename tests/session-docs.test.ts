import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8")

test("the session start is described, names every helper, keeps the process start as the fallback (#191)", () => {
  const d = read("docs/COORDINATING.md")
  const s = d.slice(d.indexOf("## Start a delegate as a session"), d.indexOf("## Open and review a pull request"))
  assert.ok(s.length > 1500, "the section exists before 'Open and review'")
  for (const k of ["opencode serve", "authHeader", "loadAliases", "resolveModel", "buildCreateRequest", "buildPromptRequest",
                   "buildWaitRequest", "isSessionDone", "readBranch", "needsFallback", "planFallback", "delivery: \"queue\"",
                   "Restart it after", "fallback", "pilot"]) assert.ok(s.includes(k), k)
  assert.match(read(".bive/prompts/COORDINATOR.md"), /Start a delegate as a session/)
})

test("every helper the page names is exported by the modules the page cites", () => {
  const names: Record<string, string[]> = {
    "lib/delegate-session.ts": ["authHeader", "loadAliases", "resolveModel", "buildCreateRequest", "buildPromptRequest"],
    "lib/delegate-run.ts": ["buildWaitRequest", "isSessionDone", "readBranch", "needsFallback", "planFallback"],
  }
  for (const [file, fns] of Object.entries(names)) {
    const src = read(file)
    for (const f of fns) assert.match(src, new RegExp(`export (async )?function ${f}\\b`), `${file} exports ${f}`)
  }
})
