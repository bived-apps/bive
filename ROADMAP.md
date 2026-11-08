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
- **Versions tend to 1.0 and never reach it (owner, 2026-11-08)**: 1.0 is the dream, written down in *bivedream*
  below. Milestones count 0.1 … 0.9, then 0.91 … 0.99, then 0.991 …: when the last digit is 9, the next milestone
  appends a digit instead of carrying over. Each run of digits is an *order* with its own theme, and the number of
  leading 9s tells which order Bive is in. A bivedream epic gets its number when it starts, never before.
- **Existing first, Bive writes the glue (owner, 2026-11-08)**: OpenCode 2's sessions, agents, permissions,
  worktrees and server; GitHub's issues, sub-issues, dependencies, rulesets, merge queue and Actions; maintained
  third-party Actions. Every epic names the capability it relies on and where it was verified. No package, no CLI of
  Bive's own; the first principle above stands.
- **Modular, optional, light (owner, 2026-11-08)**: the core is `AGENTS.md`, the three role prompts, the two
  templates and the guard. Everything else is a module a project may delete by deleting its file: token-ratio, the
  registry client, MCP over SSH, the browser help, a worktree strategy. Installing is choosing modules.

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

### bivedream — the limit (GitHub milestone `bivedream`)

The owner's request (2026-11-08): a detailed plan for Bive that is modular, optional and light, built on what exists
and is compatible (OpenCode 2 and other tools), that fills Bive's gaps and defects, cares for the migration of the
projects that use it, and tracks parallel work without conflicts. Each epic below moves to a numbered milestone when
it starts (Principles › Versions). What was verified for this plan, on 2026-11-08: OpenCode v2.2.5's API
(`/openapi.json`), its documentation (agents, CLI, plugins, Console), the GitHub API on this repository (`gh`), and the
GitHub Marketplace. Research notes live in the issues, not here.

**The dream (1.0, never reached)**: a project owner describes an epic; Bive splits it, briefs delegates on whatever
models and machines are at hand, reviews, merges, measures and upgrades itself, and the owner answers three questions
per epic. Nothing of it is a Bive program: prompts, rules, and existing tools wired together.

**Order 1 — 0.1 … 0.9, "Bive works for its owner"** (0.1 is above; the rest, in suggested order):

- **Delegates as sessions, not processes** (M). The coordinator creates the delegate's session through OpenCode's API
  (`POST /api/session` takes `location.directory` = the worktree, `agent`, `model`, `parentID` and session-scoped
  `permissions`; verified in the 2.2.5 OpenAPI), prompts it with the brief, waits on it (`session.wait`) and reads the
  pull request; `tools.opencode.worktree_create` makes the worktree. Role detection moves from `BIVE_ROLE` to the
  session's agent (`Session.Info.agent`): an API-created session carries no environment variable. Adds the `delegate`
  and `coordinator` agents to `opencode.jsonc` (HANDOFF mentions them; the file has none) with their permissions,
  including `external_directory` for the coordinator's worktrees (today the global `deny` stops the coordinator at
  `cd ..`). Decision for the owner: move the role prompts into `.opencode/agents/<role>.md`, where OpenCode reads the
  permissions from the front matter and the body as the system prompt (recommended; the inviolable list follows).
  Done when a delegate issue runs end to end with no OpenCode process started by hand and no `cd` by the coordinator.
- **Guard shrinks onto OpenCode's permissions** (S). OpenCode's permission engine already infers directories from
  shell text and checks `external_directory`, `edit` and `read`; session-scoped rules deny the inviolable files to a
  delegate session. The guard keeps only what OpenCode lacks: the violation count and the inviolable-file message. The
  shell text filter goes (on 2026-11-08 it refused the coordinator's own `gh pr create` because the report quoted a
  redirect). Done when today's test cases pass through OpenCode's rules (kept as a fixture) and `check.ts` is under
  sixty lines.
- **GitHub as the task system** (S). An epic is an issue with sub-issues (verified: `subIssuesSummary` answers on this
  repository); order by issue dependencies (`blocked_by`, verified); every delegate issue lists its files, and a
  `bive-overlap` check fails a pull request whose files overlap another open `issue/*` pull request; a ruleset on
  `bived` requires `bive-inviolable` and turns on the merge queue, so pull requests land rebased one at a time (today
  `bived` is unprotected, `main` has a ruleset). The coordinator closes issues on merge into `bived` (GitHub closes on
  the default branch only; #4 stayed open). A Projects board is optional and needs the `project` token scope the owner
  has not granted. Done when two delegates work in parallel on Bive itself without a conflict.
- **Authorship kept through merges** (S). GitHub's squash button made the owner the author of #4's merge; the
  coordinator squashes locally so the delegate stays the author, the command goes into `COORDINATOR.md`, and a test
  reads `git log` for an author that is not a role. Done when every commit on `bived` since 0.1 names its agent.
- **Measured flow** (M). Per model: output tokens, speed, violations, pull requests rejected, retries; from
  token-ratio (`session.usage.recorded` events, present in the 2.2.5 event list) and the registry, with
  `opencode stats --json` where it fits. The registry page shows the model table; `.bive/models.json` gets a suggested
  order from the data, applied by the owner. Done when the coordinator cites the table when it picks a fallback.
- **Migration of projects** (M). A project installed with Bive 0.x upgrades by pull request: `bive-upgrade.yml`, a
  `bive-*` workflow built on a maintained template-sync Action (actions-template-sync on the Marketplace;
  alternatives ahmadnassri/action-template-repository-sync, kota65535/github-template-sync-action), opens a pull
  request in the downstream project when Bive tags a release, limited to the inviolable files and `docs/`;
  `.bive/version` is stamped at install; the HANDOFF skeleton gets an *Upgrades* line. Done when the owner's first
  project receives and merges an upgrade pull request.
- **Bive for others** (M). The install prompt tested on an empty repository and on the owner's Python project; README
  for a newcomer; satellites out (0.1 › 5); the first external project in the registry. Done when someone who is not
  the owner runs an issue through the flow.
- **bivel, the light profile** (S). `bivel` is Bive minus the optional modules: the subset the weakest delegates can
  follow. An issue is bivel-grade when a delegate on the last model of `.bive/models.json` completed it unaided, and
  that is also how bivel is maintained: by the weakest models, as a standing test of simplicity. Owner's question: a
  `bivel` branch (long-term support)? Recommendation: a profile (a list of files) first; a branch only once external
  projects need support, because a second branch must be kept true. Done when a fresh project installs bivel alone.

**Order 2 — 0.91 … 0.99, "Bive runs without hands"**:

- **Zero manual steps**: brief → session → review → merge chained by the coordinator; the owner answers the three gates
  as issue comments, from GitHub, wherever they are.
- **Automatic fallback**: on a model error, the coordinator re-creates the session on the next model of
  `.bive/models.json` and names it in the review; the provider search of `docs/PROVIDERS.md` becomes the last resort.
- **Tooled review**: a read-only `reviewer` subagent (OpenCode agents, `edit` and `shell` denied) runs before the
  coordinator's own review and posts findings on the pull request.
- **Multi-machine**: delegates on another machine through an OpenCode server there (`opencode serve --hostname`,
  reached with `--server` over an SSH tunnel, credentials moved with `opencode auth export` and `import`); local models
  through ollama and ollama-cloud (already in `.bive/models.json`); MCP over SSH generalised.
- **Other harnesses**: Console's gateway lets Claude Code, Codex, Hermes and Pi use the same paid and Go models (free
  models stay OpenCode-only); a delegate on another harness only where it does something OpenCode cannot.

**Order 3 — 0.991 …, "Bive improves itself"**:

- The registry and the reports feed the briefs, the prompts' project additions and the model order: failure reasons
  classified per model, brief templates compared per model, rules proposed as pull requests to `.bive/prompts/project/`
  (never the core prompts), accepted by the supervisor.
- Projects report back what they changed in their additions; the common part moves into the template.

**Decisions this plan asks of the owner** (its gate 1): the `bivel` branch or profile; the `project` scope for a
board or issues and milestones only; role prompts as `.opencode/agents/<role>.md`; the order of Order 1 after 0.1.

### Waiting

- Signed registry ids (a challenge, a proof of work, an HMAC token; patch kept in the owner's Claude project): only if noise
  appears on the public page.
- Deploy the filtered Worker (`npx wrangler deploy`): the owner.

## Done

- **0.0 — the template** (2026-11-08, one commit, tag `v0.0`): roles, transmission contract, tight `opencode.jsonc`,
  worktree guard, MCP over SSH, token ratio, inviolable prompts, opt-in registry, Bive's own handoff and roadmap,
  generic coding rules.
