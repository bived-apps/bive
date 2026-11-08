# Roadmap

The plan, in enough detail that another agent can take any item. Kept strictly in sync with the code: every change
here is committed with the code it describes (an item started → `doing`, finished → `done in <commit>`).

## Principles

- Bive is a template and two small plugins, nothing else: no delegation tools (OpenCode 2's subagents), no provider
  probe (a fallback rule on error), no package. The flow worked by hand on the owner's first project before Bive wrote it down.
- Nothing enters the template that a role or a human does not read during a task. Anything else lives in its own
  repository.
- Bive develops itself with its own flow: coordinator and delegates on the integration branch `bived`, pull requests
  only, the owner merges `bived` into `main`.

## Epics

### 0.1 — Bive installs itself

Done when the owner's first project runs with Bive installed and one of its issues has gone through the whole flow (brief, worktree,
delegate, report, merge) with no manual step but the three gates.

1. **Loading verified** (S) — doing. Verified 2026-11-08 on the owner's machine (OpenCode v2.2.5): both folders are
   discovered, but both plugins were refused as V1 plugins ("Plugin must export a default definition with an id and
   an effect or setup function"). Port each to `Plugin.define` under `.opencode/plugins/<name>/` with its decision
   logic in a pure module, tests on `node --test` (#4 guard, #5 token-ratio; coordinator work, the files are
   inviolable). The repository is already a GitHub template. #4 and #5 merged; `opencode plugin list` shows both
   IDs. Left: in a fresh clone, a write to `../outside.txt` is refused and `.bive/state/tokens.jsonl` fills (the
   owner, or the first delegate of 0.1 › 4). Done when that check passed.
2. **Install tested** (S) — todo. The one-line prompt on an empty repository and on a clone of an existing project; the diff shown
   before any write; nothing overwritten. Done when two install pull requests have been reviewed, one per case.
3. **Guard hardened** (S) — todo. `external_directory: deny` against a worktree of the same repository; the `patch`
   tool and here-docs; the coordinator's own commands checked for false positives. Done when `bun test` covers them
   and the commands of `.bive/prompts/COORDINATOR.md` all pass.
4. **First full flow on Bive itself** (M) — todo. One `delegate` issue, one brief, one worktree, one `delegate`
   subagent, one pull request against `bived` with `report.md`. Bive joins its own registry (`BIVE_REGISTRY=on` once,
   `.bive/registry-id` committed): project #1 (owner, 2026-11-08). Done when HANDOFF.md tells the session and every
   gap became an issue.
5. **Satellites out** (S) — todo. `help/` (WebLLM page) and the registry page move to a repository `bive-registry`;
   the template keeps only the client (`token-ratio.ts`). Done when every file of the template is read by a role or a
   human during a task.
6. **First project installed** (M) — todo. The owner's first project: its `opencode.jsonc` replaced, its private paths declared, its role additions
   in `.bive/prompts/project/`, its first issue through the flow. Done when 0.1's criterion holds.

### Waiting

- Signed registry ids (a challenge, a proof of work, an HMAC token; patch kept in the owner's Claude project): only if noise
  appears on the public page.
- Deploy the filtered Worker (`npx wrangler deploy`): the owner.

## Done

- **0.0 — the template** (2026-11-08, one commit, tag `v0.0`): roles, transmission contract, tight `opencode.jsonc`,
  worktree guard, MCP over SSH, token ratio, inviolable prompts, opt-in registry, Bive's own handoff and roadmap,
  generic coding rules.
