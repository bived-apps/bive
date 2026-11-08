// Bive's guard: refuse any file write outside this session's git worktree (the bug that sank Delege: a delegate
// wrote into the main checkout instead of its worktree). Start each delegate as its own OpenCode session in its
// worktree (SDK or `opencode run` with that directory, and BIVE_ROLE=delegate), so that `worktree` below is the
// delegate's own. A delegate also never changes Bive's inviolable files (below).
import type { Plugin } from "@opencode-ai/plugin"
import os from "node:os"
import path from "node:path"

const WRITE_TOOLS = new Set(["write", "edit", "multiedit"])
// Bive's inviolable files: a delegate (BIVE_ROLE=delegate) never changes them. The coordinator and the supervisor
// complete the role prompts in .bive/prompts/project/ (never the core ones) (AGENTS.md › Inviolable prompts).
const PROTECTED = [/^\.bive\/registry-id$/, /^\.bive\/prompts\//, /^\.bive\/templates\//, /^\.opencode\/plugin\//,
                   /^\.github\/workflows\/bive-/, /^opencode\.jsonc$/, /^AGENTS\.md$/]
const PROTECTED_WORDS = [".bive/registry-id", ".bive/prompts/", ".bive/templates", ".opencode/plugin", ".github/workflows/bive-",
                         "opencode.jsonc", "AGENTS.md"]
const SHELL_WRITE = /(\btee\b|\bsed\s+-i|\bperl\s+-[a-z]*i|\bmv\b|\bcp\b|\brm\b|\btruncate\b|\bgit\s+(rm|mv|checkout|restore|apply))/
// Shell paths: a command may name a file outside the worktree through an absolute path, `~`, `$HOME` or `..`
// (`echo x > /Users/jj/FiFoo/f.py`, `cd ../FiFoo && …`: the exact scenario of FiFoo's issue #101). A redirection
// target outside the worktree is refused for every role; for a delegate, any such path is, apart from the system
// prefixes below, which commands read but never write (interpreters, tools, /tmp for scratch).
const SYSTEM_PREFIXES = ["/usr", "/bin", "/sbin", "/lib", "/lib64", "/opt", "/etc", "/dev", "/proc", "/sys", "/tmp",
                         "/var", "/private/tmp", "/private/var", "/Library", "/System", "/Applications", "/nix"]
const REDIRECT = /(?:^|[^<>])>{1,2}\s*["']?([^\s"';&|)]+)/g
const WORD = /(?:[^\s"'=;&|()<>]|\\ )+/g              // a shell word; `=` splits `--out=/x` into its value

// Each refusal is a violation: counted in this process for token-ratio.ts, which reports the count to the registry.
const g = globalThis as { __biveViolations?: number }
const violation = (message: string): never => {
  g.__biveViolations = (g.__biveViolations ?? 0) + 1
  throw new Error(message)
}

export const WorktreeGuard: Plugin = async ({ directory, worktree }) => {
  const root = path.resolve(worktree || directory)
  const home = os.homedir()
  const expand = (p: string) => p.replace(/^~(?=\/|$)/, home).replace(/^\$\{?HOME\}?(?=\/|$)/, home)
  const inside = (p: string) => {
    const full = path.resolve(directory, expand(p))
    return full === root || full.startsWith(root + path.sep)
  }
  const system = (p: string) => {
    const full = path.resolve(directory, expand(p))
    return SYSTEM_PREFIXES.some((s) => full === s || full.startsWith(s + "/"))
  }
  // The words of a command that name a path: absolute, home-relative, or climbing with `..`. Flags, URLs and
  // option names are not paths (`--force`, `https://…`, `-o`); a relative name without `..` stays inside.
  const pathWords = (cmd: string): string[] => {
    const out: string[] = []
    for (const m of cmd.matchAll(WORD)) {
      const w = m[0].replace(/\\ /g, " ")
      if (w.startsWith("-") || /^[a-z][a-z0-9+.-]*:\/\//i.test(w)) continue
      if (w.startsWith("/") || w.startsWith("~") || w.startsWith("$HOME") || w.startsWith("${HOME}")
          || w === ".." || w.startsWith("../") || w.includes("/../") || w.endsWith("/..")) out.push(w)
    }
    return out
  }
  const delegate = process.env.BIVE_ROLE === "delegate"
  const rel = (p: string) => path.relative(root, path.resolve(directory, p)).split(path.sep).join("/")
  const isProtected = (p: string) => PROTECTED.some((re) => re.test(rel(p)))
  const guard = (p: string) => {
    if (!inside(p)) refuse(p)
    if (delegate && isProtected(p)) {
      violation(`worktree-guard: ${rel(p)} is one of Bive's inviolable files; a delegate never changes it. `
        + "Say in your report what should change and why.")
    }
  }
  const refuse = (p: string) => {
    violation(`worktree-guard: ${p} is outside this session's worktree (${root}); work only inside it.`)
  }
  return {
    "tool.execute.before": async (input, output) => {
      const args = output.args ?? {}
      if (WRITE_TOOLS.has(input.tool)) {
        const p = args.filePath ?? args.file_path ?? args.path
        if (typeof p === "string") guard(p)
      } else if (input.tool === "patch" || input.tool === "apply_patch") {
        const text: string = args.patchText ?? args.patch ?? ""
        for (const m of text.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)) {
          const p = (m[1] ?? m[2]).trim()
          guard(p)
        }
      } else if (input.tool === "bash") {
        if (typeof args.workdir === "string" && !inside(args.workdir)) refuse(args.workdir)
        const cmd: string = args.command ?? ""
        // Every role: a redirection never lands outside the worktree (/dev/null and the system prefixes excepted).
        const redirected = [...cmd.matchAll(REDIRECT)].map((m) => m[1])
        for (const t of redirected) if (!inside(t) && !system(t)) refuse(t)
        // A delegate: no path outside its worktree at all, read or write, but the system prefixes.
        if (delegate) for (const w of pathWords(cmd)) if (!inside(w) && !system(w)) refuse(w)
        if (delegate) {
          const hit = PROTECTED_WORDS.find((w) => redirected.some((t) => t.includes(w))
                                                  || (SHELL_WRITE.test(cmd) && cmd.includes(w)))
          if (hit) violation(`worktree-guard: this command may change ${hit}, one of Bive's inviolable files; `
            + "a delegate never changes it. Say in your report what should change and why.")
        }
      }
    },
  }
}
