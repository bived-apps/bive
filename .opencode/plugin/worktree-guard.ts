// Bive's guard: refuse any file write outside this session's git worktree (the bug that sank Delege: a delegate
// wrote into the main checkout instead of its worktree). Start each delegate as its own OpenCode session in its
// worktree (SDK or `opencode run` with that directory, and BIVE_ROLE=delegate), so that `worktree` below is the
// delegate's own. A delegate also never changes Bive's inviolable files (below).
import type { Plugin } from "@opencode-ai/plugin"
import path from "node:path"

const WRITE_TOOLS = new Set(["write", "edit", "multiedit"])
// Bive's inviolable files: a delegate (BIVE_ROLE=delegate) never changes them. The coordinator and the supervisor
// complete the role prompts in .bive/prompts/project/ (never the core ones) (AGENTS.md › Inviolable prompts).
const PROTECTED = [/^\.bive\/registry-id$/, /^\.bive\/prompts\//, /^\.bive\/templates\//, /^\.opencode\/plugin\//,
                   /^\.github\/workflows\/bive-/, /^opencode\.jsonc$/, /^AGENTS\.md$/]
const PROTECTED_WORDS = [".bive/registry-id", ".bive/prompts/", ".bive/templates", ".opencode/plugin", ".github/workflows/bive-",
                         "opencode.jsonc", "AGENTS.md"]
const SHELL_WRITE = /(\btee\b|\bsed\s+-i|\bperl\s+-[a-z]*i|\bmv\b|\bcp\b|\brm\b|\btruncate\b|\bgit\s+(rm|mv|checkout|restore|apply))/

// Each refusal is a violation: counted in this process for token-ratio.ts, which reports the count to the registry.
const g = globalThis as { __biveViolations?: number }
const violation = (message: string): never => {
  g.__biveViolations = (g.__biveViolations ?? 0) + 1
  throw new Error(message)
}

export const WorktreeGuard: Plugin = async ({ directory, worktree }) => {
  const root = path.resolve(worktree || directory)
  const inside = (p: string) => {
    const full = path.resolve(directory, p)
    return full === root || full.startsWith(root + path.sep)
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
        if (delegate) {
          const redirected = [...cmd.matchAll(/>{1,2}\s*["']?([^\s"';&|]+)/g)].map((m) => m[1])
          const hit = PROTECTED_WORDS.find((w) => redirected.some((t) => t.includes(w))
                                                  || (SHELL_WRITE.test(cmd) && cmd.includes(w)))
          if (hit) violation(`worktree-guard: this command may change ${hit}, one of Bive's inviolable files; `
            + "a delegate never changes it. Say in your report what should change and why.")
        }
      }
    },
  }
}
