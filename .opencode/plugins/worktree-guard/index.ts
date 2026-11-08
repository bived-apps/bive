// Bive's guard, the OpenCode 2 plugin: before any tool runs, check.ts decides (README › Files, AGENTS.md › Rules).
// `ctx.location.directory` is this session's directory: the delegate's worktree when the delegate is started in it
// with BIVE_ROLE=delegate. A refusal is a thrown error, which the model reads and must work around inside its worktree.
// `@opencode/plugin` is supplied by OpenCode itself: nothing to install.
import { Plugin } from "@opencode/plugin"
import { makeGuard } from "./check.ts"

export default Plugin.define({
  id: "bive.worktree-guard",
  async setup(ctx) {
    const check = makeGuard({ root: ctx.location.directory, delegate: process.env.BIVE_ROLE === "delegate" })
    await ctx.tool.hook("execute.before", (event) => {
      const input = (event.input ?? {}) as Record<string, unknown>
      check(event.tool, input)
    })
  },
})
