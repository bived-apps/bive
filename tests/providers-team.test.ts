import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const docPath = path.join(import.meta.dirname, "..", "docs", "PROVIDERS.md");
const doc = fs.readFileSync(docPath, "utf8");

function section(text) {
  const marker = "## Proposing a team (issue #223)";
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, "missing section '## Proposing a team (issue #223)'");
  const rest = text.slice(start + marker.length);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

test("proposing a team section exists after Least-cost capable order", () => {
  const order = doc.indexOf("## Least-cost capable order");
  const team = doc.indexOf("## Proposing a team (issue #223)");
  assert.notEqual(order, -1, "missing '## Least-cost capable order'");
  assert.notEqual(team, -1, "missing '## Proposing a team (issue #223)'");
  assert.ok(team > order, "team section must appear after Least-cost capable order");
});

test("defines listed, available, free, suitable, approved", () => {
  const s = section(doc);
  for (const term of ["listed", "available", "free", "suitable", "approved"]) {
    const re = new RegExp(`\\*\\*${term}\\*\\*\\s*:`);
    assert.match(s, re, `term '${term}' is not defined`);
  }
});

test("treats country refusal as unavailable and states probe is not qualification", () => {
  const s = section(doc);
  assert.match(s, /"not available in your country"/);
  assert.match(s, /means not available/);
  assert.match(s, /a probe is not a qualification/);
});

test("states roles, coordinator errors, and delegate fallback", () => {
  const s = section(doc);
  assert.match(s, /retired supervisor role proposes nothing/);
  assert.match(s, /coordinator error \(unreachable, 429, quota\)\s+never silently changes the assigned model/i);
  assert.match(s, /Delegate fallback \(the next model in the delegate list\) is unchanged\./);
});
