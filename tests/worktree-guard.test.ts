// node --test tests/*.test.ts — the guard's decisions (README › Files) on fake tool calls; no OpenCode needed.
import { describe, test } from "node:test"
import assert from "node:assert/strict"
import os from "node:os"
import path from "node:path"
import { isDelegate, makeGuard, violations, type Check } from "../.opencode/plugins/worktree-guard/check.ts"

// Fake paths under the home folder, never created: /tmp is a system prefix the guard lets through.
const base = path.join(os.homedir(), ".bive-guard-test")
const main = path.join(base, "repo")
const wt = path.join(base, "repo-3")
const delegate = makeGuard({ root: wt, delegate: true })
const coordinator = makeGuard({ root: wt, delegate: false })

const shell = (check: Check, command: string, workdir?: string) => () => check("shell", { command, workdir })
const write = (check: Check, p: string) => () => check("write", { path: p })
const passes = (fn: () => void) => assert.doesNotThrow(fn)
const refused = (fn: () => void, re: RegExp) => assert.throws(fn, re)

describe("write tools", () => {
  test("inside the worktree passes", () => {
    passes(write(delegate, "src/a.py"))
    passes(() => delegate("edit", { path: "src/a.py", oldString: "a", newString: "b" }))
  })
  test("outside the worktree is refused for every role", () => {
    refused(write(delegate, path.join(main, "a.py")), /outside this session's worktree/)
    refused(write(coordinator, "../repo/a.py"), /outside/)
  })
  test("a delegate never touches an inviolable file", () => {
    refused(write(delegate, "AGENTS.md"), /inviolable/)
    refused(write(delegate, ".opencode/plugins/worktree-guard/check.ts"), /inviolable/)
    refused(write(delegate, ".opencode/plugin/token-ratio.ts"), /inviolable/)
    passes(write(coordinator, "AGENTS.md"))
  })
  test("the V1 names still work (filePath, bash)", () => {
    refused(() => delegate("write", { filePath: path.join(main, "a.py") }), /outside/)
    refused(() => delegate("bash", { command: `echo x > ${main}/f.py` }), /outside/)
  })
})

describe("patch", () => {
  test("every file of a patch is checked", () => {
    const patch = `*** Begin Patch\n*** Update File: src/a.py\n-a\n+b\n*** Add File: ${main}/b.py\n+x\n*** End Patch`
    refused(() => coordinator("patch", { patchText: patch }), /outside/)
    passes(() => coordinator("patch", { patchText: "*** Begin Patch\n*** Update File: src/a.py\n-a\n+b\n*** End Patch" }))
    refused(() => delegate("patch", { patchText: "*** Begin Patch\n*** Update File: opencode.jsonc\n-a\n+b\n*** End Patch" }),
            /inviolable/)
  })
})

describe("shell, every role", () => {
  test("a redirection outside the worktree is refused", () => {
    refused(shell(coordinator, `echo x > ${main}/f.py`), /outside/)
    refused(shell(coordinator, "echo x >> ../repo/f.py"), /outside/)
  })
  test("redirections to /dev/null, stderr and inside pass", () => {
    passes(shell(coordinator, "pytest -q > out.txt 2>&1"))
    passes(shell(coordinator, "cmd >/dev/null 2>&1; echo >&2 oops"))
    passes(shell(coordinator, "cat <<EOF > notes.md\nhi\nEOF"))
  })
  test("a working directory outside the worktree is refused", () => {
    refused(shell(coordinator, "ls", main), /outside/)
    passes(shell(coordinator, "ls", path.join(wt, "src")))
  })
  test("a coordinator may name paths outside (it creates worktrees)", () => {
    passes(shell(coordinator, "git worktree add ../repo-4 -b issue/4-x dev"))
  })
})

describe("shell, delegate", () => {
  test("an absolute, ~, $HOME or .. path outside the worktree is refused", () => {
    refused(shell(delegate, `cd ${main} && git status`), /outside/)
    refused(shell(delegate, "cd ../repo && ls"), /outside/)
    refused(shell(delegate, "cat ~/.app/agent.json"), /outside/)
    refused(shell(delegate, "ls $HOME/other"), /outside/)
    refused(shell(delegate, "cp a.py src/../../repo/a.py"), /outside/)
  })
  test("system prefixes, flags, URLs and relative names pass", () => {
    passes(shell(delegate, "/usr/bin/python3 -m pytest tests/test_a.py -q --tb=short"))
    passes(shell(delegate, "curl -sS https://example.com/x.json -o /tmp/x.json"))
    passes(shell(delegate, `ls ${wt}/src && git add -A && git commit -m 'x (#3)'`))
    passes(shell(delegate, "ruff check src tests"))
  })
  test("an inviolable file is still refused through the shell", () => {
    refused(shell(delegate, "sed -i 's/a/b/' opencode.jsonc"), /inviolable/)
    refused(shell(delegate, "cp x.ts .opencode/plugins/worktree-guard/index.ts"), /inviolable/)
  })
})

describe("nested worktree (.worktrees/issue-<n>, AGENTS.md › Rules)", () => {
  const nested = path.join(main, ".worktrees", "issue-5")
  const d = makeGuard({ root: nested, delegate: true })
  const c = makeGuard({ root: main, delegate: false })
  test("a delegate there cannot write into the parent checkout", () => {
    refused(write(d, "../../a.py"), /outside/)
    refused(write(d, path.join(main, "a.py")), /outside/)
    refused(shell(d, "cd ../.. && git status"), /outside/)
    passes(write(d, "src/a.py"))
  })
  test("the coordinator creates it from its own checkout", () => {
    passes(shell(c, "git worktree add .worktrees/issue-5 -b issue/5-x bived", main))
  })
})

describe("delegate detection (child sessions inherit the coordinator's environment, #36)", () => {
  test("BIVE_ROLE, a .worktrees/issue-<n> root or the role file make a delegate", () => {
    assert.equal(isDelegate(main, "delegate", undefined), true)
    assert.equal(isDelegate(path.join(main, ".worktrees", "issue-12"), undefined, undefined), true)
    assert.equal(isDelegate(wt, undefined, "delegate\n"), true)
    assert.equal(isDelegate(main, undefined, undefined), false)
    assert.equal(isDelegate(path.join(main, ".worktrees", "issue-12x"), "coordinator", "coordinator"), false)
  })
  test("a coordinator's session checks what lands in .worktrees/issue-<n>/ as that delegate's", () => {
    const c = makeGuard({ root: main, delegate: false })
    const nested = path.join(main, ".worktrees", "issue-12")
    // a subagent's write into its worktree's inviolable file, through the coordinator's plugin instance
    refused(write(c, ".worktrees/issue-12/AGENTS.md"), /inviolable/)
    refused(write(c, path.join(nested, ".bive/prompts/DELEGATE.md")), /inviolable/)
    refused(() => c("patch", { patchText: "*** Begin Patch\n*** Update File: .worktrees/issue-12/opencode.jsonc\n*** End Patch" }),
            /inviolable/)
    // a shell command run there gets the delegate's checks: no path outside that worktree, no inviolable file
    refused(shell(c, "cat ../../a.py", nested), /outside/)
    refused(shell(c, "sed -i 's/a/b/' AGENTS.md", nested), /inviolable/)
    passes(shell(c, "git status && node --test tests/a.test.ts", nested))
    passes(write(c, ".worktrees/issue-12/src/a.py"))
    passes(write(c, ".worktrees/issue-12/.bive/state/role"))   // the coordinator writes the role file
    passes(write(c, "AGENTS.md"))                                // its own checkout stays its own
  })
})

describe("violations", () => {
  test("every refusal above was counted", () => {
    assert.equal(violations(), 27)      // the `refused(...)` calls above, one violation each
  })
})
