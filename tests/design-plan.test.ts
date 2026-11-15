import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

test("the design plan stays a plan: owner gates, safeguards, original characters, no paid call and no cap decided", () => {
  const d = fs.readFileSync(new URL("../docs/DESIGN-PLAN.md", import.meta.url), "utf8")
  for (const re of [/plan for the owner's approval/, /No image was generated/, /original only/, /no billing or provider change/,
    /Text first|\*\*text first\*\*/i, /No cap is set/, /Claude models cannot generate pictures/, /Still open/,
    /the owner approves each image set/, /one front door/i, /Owner answers/, /archive all eight/, /simple glyphs/]) assert.match(d, re)
})
