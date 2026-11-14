import { test } from "node:test";
import assert from "node:assert/strict";
import { afterAnswer, resolveRole, type Role, type Signals } from "../lib/role-start.ts";

const roleSignals: Array<[string, Partial<Signals>, Role]> = [
  ["agent", { agent: "advisor" }, "advisor"],
  ["environment role", { envRole: "coordinator" }, "coordinator"],
  ["role file", { roleFile: " delegate \n" }, "delegate"],
  ["worktree", { worktreePath: "/repo/.worktrees/issue-232" }, "delegate"],
  ["brief", { brief: "Role: coordinator" }, "coordinator"],
];

test("each role signal suppresses asking", () => {
  for (const [name, signal, role] of roleSignals) {
    assert.deepEqual(resolveRole({ interactive: true, ...signal }), {
      kind: "role", role, setIdentity: role !== "advisor",
    }, name);
  }
});

test("conflicting signals block and name the signals", () => {
  const result = resolveRole({ interactive: true, agent: "advisor", envRole: "delegate" });
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") {
    assert.match(result.reason, /agent=advisor/);
    assert.match(result.reason, /envRole \(BIVE_ROLE\)=delegate/);
  }
});

test("unknown values block", () => {
  const result = resolveRole({ interactive: true, agent: "supervisor" });
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") assert.match(result.reason, /supervisor/);
});

test("same role from multiple signals is fine", () => {
  assert.deepEqual(resolveRole({ interactive: true, agent: "delegate", envRole: "delegate" }), {
    kind: "role", role: "delegate", setIdentity: true,
  });
});

test("interactive session asks with the fixed choices", () => {
  assert.deepEqual(resolveRole({ interactive: true }), {
    kind: "ask", choices: ["advisor", "coordinator", "delegate", "none of these: just answer a question"],
  });
});

test("non-interactive session blocks without a role", () => {
  assert.deepEqual(resolveRole({ interactive: false }), { kind: "blocked", reason: "blocked: no role assigned" });
});

test("resumed role wins without re-asking", () => {
  assert.deepEqual(resolveRole({ interactive: true, resumedRole: "advisor", agent: "delegate" }), {
    kind: "role", role: "advisor", setIdentity: false,
  });
});

test("unlisted model blocks for the selected role", () => {
  const result = resolveRole({ interactive: true, agent: "delegate", model: "model-x", allowedModels: { delegate: ["model-y"] } });
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") assert.match(result.reason, /model-x.*delegate/);
});

test("listed model passes", () => {
  assert.deepEqual(resolveRole({ interactive: true, agent: "delegate", model: "model-x", allowedModels: { delegate: ["model-x"] } }), {
    kind: "role", role: "delegate", setIdentity: true,
  });
});

test("advisor does not set identity", () => {
  assert.deepEqual(resolveRole({ interactive: false, agent: "advisor" }), { kind: "role", role: "advisor", setIdentity: false });
});

test("afterAnswer resolves roles and treats none/cancel as answer-only", () => {
  for (const role of ["advisor", "coordinator", "delegate"] as Role[]) {
    assert.deepEqual(afterAnswer(role, { interactive: true }), { kind: "role", role, setIdentity: role !== "advisor" });
  }
  assert.deepEqual(afterAnswer("none of these: just answer a question", { interactive: true }), { kind: "answer-only" });
  assert.deepEqual(afterAnswer("", { interactive: true }), { kind: "answer-only" });
  assert.deepEqual(afterAnswer("cancel", { interactive: true }), { kind: "answer-only" });
});

test("default agent names are not role signals", () => {
  assert.equal(resolveRole({ interactive: true, agent: "build" }).kind, "ask");
  assert.deepEqual(resolveRole({ interactive: true, agent: "build", roleFile: "delegate" }), {
    kind: "role", role: "delegate", setIdentity: true,
  });
});

test("retired supervisor role is blocked", () => {
  for (const signal of [
    { agent: "supervisor" },
    { envRole: "supervisor" },
    { roleFile: "supervisor" },
  ]) {
    const result = resolveRole({ interactive: true, ...signal });
    assert.equal(result.kind, "blocked");
    if (result.kind === "blocked") assert.match(result.reason, /supervisor role is retired/);
  }
});

test("brief requires an explicit role line", () => {
  assert.equal(resolveRole({ interactive: true, brief: "The delegate will handle implementation." }).kind, "ask");
  assert.deepEqual(resolveRole({ interactive: true, brief: "Role: coordinator" }), {
    kind: "role", role: "coordinator", setIdentity: true,
  });
});

test("different explicit role lines in brief block", () => {
  const result = resolveRole({ interactive: true, brief: "Role: advisor\nRole: delegate" });
  assert.equal(result.kind, "blocked");
  if (result.kind === "blocked") assert.match(result.reason, /advisor.*delegate/);
});
