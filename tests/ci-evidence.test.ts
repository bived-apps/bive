import { test } from "node:test";
import assert from "node:assert/strict";
import { canReuse, type CiRun, type Review } from "../lib/ci-evidence.ts";

const review: Review = {
  reviewedHead: "head-1",
  currentBase: "base-1",
  expectedCommand: "node --test tests/*.test.ts",
};

const matchingRun: CiRun = {
  url: "https://ci.example/run/42",
  checkName: "tests",
  headSha: "head-1",
  testedSha: "head-1",
  workflowFromBase: true,
  conclusion: "success",
  totalTests: 326,
  passedTests: 326,
  skippedTests: 0,
  requiredMarkersSkipped: [],
  command: review.expectedCommand,
};

test("reuses a matching complete run with the exact evidence line", () => {
  assert.deepEqual(canReuse(matchingRun, review), {
    reuse: true,
    line: "CI https://ci.example/run/42 head head-1 base base-1: tests 326/326, no skips",
  });
});

test("rejects a stale SHA", () => {
  const result = canReuse({ ...matchingRun, headSha: "old-head" }, review);
  assert.equal(result.reuse, false);
  if (!result.reuse) assert.ok(result.reasons.includes("run head is stale"));
});

test("reuses a synthetic merge on the reviewed head and current base", () => {
  const result = canReuse({
    ...matchingRun,
    headSha: "merge-sha",
    testedSha: "merge-sha",
    baseSha: "base-1",
    mergeOf: { head: "head-1", base: "base-1" },
  }, review);
  assert.equal(result.reuse, true);
});

test("rejects a synthetic merge on another base", () => {
  const result = canReuse({
    ...matchingRun,
    headSha: "merge-sha",
    mergeOf: { head: "head-1", base: "base-2" },
  }, review);
  assert.equal(result.reuse, false);
  if (!result.reuse) assert.ok(result.reasons.includes("run head is stale"));
});

test("rejects a partial successful run", () => {
  const result = canReuse({ ...matchingRun, totalTests: 326, passedTests: 325 }, review);
  assert.equal(result.reuse, false);
  if (!result.reuse) assert.ok(result.reasons.includes("run does not cover the whole suite"));
});

test("rejects a successful run reporting zero tests", () => {
  const result = canReuse({ ...matchingRun, totalTests: 0, passedTests: 0 }, review);
  assert.equal(result.reuse, false);
  if (!result.reuse) assert.ok(result.reasons.includes("run reports no tests"));
});

test("rejects skipped tests and required markers", () => {
  for (const run of [
    { ...matchingRun, skippedTests: 1 },
    { ...matchingRun, requiredMarkersSkipped: ["gpu"] },
  ]) {
    const result = canReuse(run, review);
    assert.equal(result.reuse, false);
  }
});

test("rejects absent and pending runs", () => {
  assert.deepEqual(canReuse(undefined, review), { reuse: false, reasons: ["run absent"] });
  const pending = canReuse({ ...matchingRun, conclusion: "pending" }, review);
  assert.equal(pending.reuse, false);
  if (!pending.reuse) assert.ok(pending.reasons.includes("run is still running"));
});

test("rejects an untrusted workflow", () => {
  const result = canReuse({ ...matchingRun, workflowFromBase: false }, review);
  assert.equal(result.reuse, false);
  if (!result.reuse) assert.ok(result.reasons.includes("workflow is not trusted from the base"));
});

test("rejects a different command", () => {
  const result = canReuse({ ...matchingRun, command: "node --test tests/unit.test.ts" }, review);
  assert.equal(result.reuse, false);
  if (!result.reuse) assert.ok(result.reasons.includes("command differs from expected command"));
});

test("rejects changed inputs and local-only coverage", () => {
  const result = canReuse(matchingRun, {
    ...review,
    changedInputsSinceRun: true,
    localOnly: true,
  });
  assert.equal(result.reuse, false);
  if (!result.reuse) {
    assert.ok(result.reasons.includes("inputs changed since the run"));
    assert.ok(result.reasons.includes("check is local-only"));
  }
});

test("collects every applicable reason", () => {
  const result = canReuse({
    ...matchingRun,
    headSha: "old-head",
    workflowFromBase: false,
    totalTests: 10,
    passedTests: 9,
    skippedTests: 1,
    requiredMarkersSkipped: ["gpu"],
    command: "other command",
  }, {
    ...review,
    changedInputsSinceRun: true,
    localOnly: true,
  });
  assert.deepEqual(result, {
    reuse: false,
    reasons: [
      "run head is stale",
      "workflow is not trusted from the base",
      "run does not cover the whole suite",
      "run skipped tests",
      "run skipped required markers",
      "command differs from expected command",
      "inputs changed since the run",
      "check is local-only",
    ],
  });
});
