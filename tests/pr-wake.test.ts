import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const section = () => read("docs/COORDINATING.md").split("## Be woken when a pull request is merged")[1].split("\n## ")[0]

test("schedules are on in the project config", () => {
  const cfg = JSON.parse(read("opencode.jsonc").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"))
  assert.equal(cfg.experimental?.schedules, true)
})

test("the wake recipe is one bounded schedule whose payload has only the API's fields", () => {
  const s = section()
  const body = s.split("<<EOF\n")[1].split("\nEOF")[0]
    .replaceAll("$OPENCODE_SESSION_ID", "ses_x").replaceAll("$name", "bive-pr-o-r-1").replaceAll("$repo", "o/r").replaceAll("$pr", "1")
  const p = JSON.parse(body)
  // Schedule.CreatePayload of OpenCode 2.2.5's /openapi.json
  for (const k of Object.keys(p)) assert.ok(["sessionID", "name", "when", "if", "until", "ends", "prompt"].includes(k), k)
  assert.deepEqual(p.ends, { after: "8 hours", times: 1 })
  assert.equal(p.when.every, "2 minutes")
  assert.equal(p.if.matches, "^(MERGED|CLOSED)")
  assert.match(p.if.run, /^gh pr view 1 --repo o\/r --json state,mergeCommit,baseRefName --jq '\[\.state,\.mergeCommit\.oid,\.baseRefName\]\|@tsv'$/)
  assert.match(p.prompt, /not authorization/)
  assert.match(p.prompt, /reachable from the base/)
  assert.match(p.prompt, /CLOSED without a merge commit is not done/)
  assert.match(s, /never by pattern/)
  assert.match(s, /a delegate never registers a schedule/)
})

test("the old shell polling loop is gone", () => {
  assert.doesNotMatch(read("docs/COORDINATING.md"), /until \[ "\$\(gh pr view/)
})
