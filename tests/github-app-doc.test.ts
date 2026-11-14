import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

test("the App checklist keeps the owner in charge, least privilege and no key for agents", () => {
  const d = fs.readFileSync(new URL("../docs/GITHUB-APP.md", import.meta.url), "utf8")
  for (const re of [/one App for all agents/i, /no agent creates or installs the App/, /\*\*Not\*\*: administration, workflows/,
    /never handed\s+to an agent/, /Do not give the App any bypass/, /refused by the gate/, /cannot tell them apart/]) assert.match(d, re)
})
