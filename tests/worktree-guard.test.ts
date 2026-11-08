// bun test — the guard's shell path checks (README › Files). Runs the plugin's hook on fake tool calls.
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { WorktreeGuard } from "../.opencode/plugin/worktree-guard"

type Hook = (input: { tool: string, sessionID: string, callID: string }, output: { args: Record<string, unknown> }) => Promise<void>

let base: string, wt: string, main: string, hooks: { delegate: Hook, coordinator: Hook }
const bash = async (h: Hook, command: string) => h({ tool: "bash", sessionID: "s", callID: "c" }, { args: { command } })
const write = async (h: Hook, filePath: string) => h({ tool: "write", sessionID: "s", callID: "c" }, { args: { filePath } })

beforeAll(async () => {
  // Not under /tmp: that is a system prefix the guard lets through.
  base = mkdtempSync(path.join(os.homedir(), ".bive-guard-test-"))
  main = path.join(base, "repo"); wt = path.join(base, "repo-3")
  mkdirSync(main); mkdirSync(wt)
  const make = async (role?: string) => {
    if (role) process.env.BIVE_ROLE = role; else delete process.env.BIVE_ROLE
    const p = await (WorktreeGuard as any)({ directory: wt, worktree: wt, client: {}, $: {} })
    return p["tool.execute.before"] as Hook
  }
  hooks = { delegate: await make("delegate"), coordinator: await make() }
})
afterAll(() => rmSync(base, { recursive: true, force: true }))

describe("write tools", () => {
  test("inside the worktree passes", async () => { await write(hooks.delegate, "src/a.py") })
  test("outside the worktree is refused for every role", async () => {
    await expect(write(hooks.delegate, path.join(main, "a.py"))).rejects.toThrow(/outside this session's worktree/)
    await expect(write(hooks.coordinator, "../repo/a.py")).rejects.toThrow(/outside/)
  })
  test("a delegate never touches an inviolable file", async () => {
    await expect(write(hooks.delegate, "AGENTS.md")).rejects.toThrow(/inviolable/)
    await write(hooks.coordinator, "AGENTS.md")
  })
})

describe("shell, every role", () => {
  test("a redirection outside the worktree is refused (issue #101)", async () => {
    await expect(bash(hooks.coordinator, `echo x > ${main}/f.py`)).rejects.toThrow(/outside/)
    await expect(bash(hooks.coordinator, "echo x >> ../repo/f.py")).rejects.toThrow(/outside/)
  })
  test("redirections to /dev/null, stderr and inside pass", async () => {
    await bash(hooks.coordinator, "pytest -q > out.txt 2>&1")
    await bash(hooks.coordinator, "cmd >/dev/null 2>&1; echo >&2 oops")
    await bash(hooks.coordinator, "cat <<EOF > notes.md\nhi\nEOF")
  })
  test("a coordinator may name paths outside (it creates worktrees)", async () => {
    await bash(hooks.coordinator, "git worktree add ../repo-4 -b issue/4-x dev")
  })
})

describe("shell, delegate", () => {
  test("an absolute, ~, $HOME or .. path outside the worktree is refused", async () => {
    await expect(bash(hooks.delegate, `cd ${main} && git status`)).rejects.toThrow(/outside/)
    await expect(bash(hooks.delegate, "cd ../repo && ls")).rejects.toThrow(/outside/)
    await expect(bash(hooks.delegate, "cat ~/.fifoo/agent.json")).rejects.toThrow(/outside/)
    await expect(bash(hooks.delegate, "ls $HOME/FiFoo")).rejects.toThrow(/outside/)
    await expect(bash(hooks.delegate, "cp a.py src/../../repo/a.py")).rejects.toThrow(/outside/)
  })
  test("system prefixes, flags, URLs and relative names pass", async () => {
    await bash(hooks.delegate, "/usr/bin/python3 -m pytest tests/test_a.py -q --tb=short")
    await bash(hooks.delegate, "curl -sS https://example.com/x.json -o /tmp/x.json")
    await bash(hooks.delegate, `ls ${wt}/src && git add -A && git commit -m 'x (#3)'`)
    await bash(hooks.delegate, "ruff check fifoo tests")
  })
  test("an inviolable file is still refused through the shell", async () => {
    await expect(bash(hooks.delegate, "sed -i 's/a/b/' opencode.jsonc")).rejects.toThrow(/inviolable/)
  })
})
