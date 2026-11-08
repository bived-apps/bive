// Bive's only code: refuse any file write outside this session's git worktree (the bug that sank Delege: a delegate
// wrote into the main checkout instead of its worktree). Start each delegate as its own OpenCode session in its
// worktree (SDK or `opencode run` with that directory), so that `worktree` below is the delegate's own.
import type { Plugin } from "@opencode-ai/plugin"
import path from "node:path"

const WRITE_TOOLS = new Set(["write", "edit", "multiedit"])

export const WorktreeGuard: Plugin = async ({ directory, worktree }) => {
  const root = path.resolve(worktree || directory)
  const inside = (p: string) => {
    const full = path.resolve(directory, p)
    return full === root || full.startsWith(root + path.sep)
  }
  const refuse = (p: string) => {
    throw new Error(`worktree-guard: ${p} is outside this session's worktree (${root}); work only inside it.`)
  }
  return {
    "tool.execute.before": async (input, output) => {
      const args = output.args ?? {}
      if (WRITE_TOOLS.has(input.tool)) {
        const p = args.filePath ?? args.file_path ?? args.path
        if (typeof p === "string" && !inside(p)) refuse(p)
      } else if (input.tool === "patch" || input.tool === "apply_patch") {
        const text: string = args.patchText ?? args.patch ?? ""
        for (const m of text.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$|^\*\*\* Move to: (.+)$/gm)) {
          const p = (m[1] ?? m[2]).trim()
          if (!inside(p)) refuse(p)
        }
      } else if (input.tool === "bash" && typeof args.workdir === "string" && !inside(args.workdir)) {
        refuse(args.workdir)
      }
    },
  }
}
